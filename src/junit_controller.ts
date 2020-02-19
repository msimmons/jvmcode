'use strict';

import * as vscode from 'vscode'
import * as PathHelper from 'path'
import * as fs from 'fs'
import * as xml from 'fast-xml-parser'
import * as he from 'he'
import { JUnitSuite, JUnitReport, JUnitCase, JUnitFailure } from './models';
import { ProjectController } from './project_controller';
import { ConfigService } from './config_service';

/**
 * Responsible for managing JUnit integrations, watching for changes in test reports, maybe recognizing test methods
 */
export class JUnitController implements vscode.Disposable {

    private STACK_RE = new RegExp("^at\\s+(.*)\\((.*):(\\d+)\\)$") // (class.method)(filename)(position)
    private projectController : ProjectController
    // Problems by test result XML file path
    private problemMap = new Map<string, vscode.DiagnosticCollection>()
    private resultsMap = new Map<string, JUnitReport>()
    private disposables : vscode.Disposable[] =  []
    private testStatusItem : vscode.StatusBarItem

    public constructor(projectController: ProjectController) {
        this.projectController = projectController
    }

    public start() {
        let dir = ConfigService.getConfig().testResultsDir
        let pattern = vscode.workspace.workspaceFolders[0].uri.path+`/${dir}/**/*.xml`
        let watcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false)
        this.disposables.push(watcher)
        watcher.onDidChange(this.onDidChange())
        watcher.onDidDelete(this.onDidDelete())
        watcher.onDidCreate(this.onDidCreate())
        // Watch the directory for 'cleans'
        let dirWatcher = vscode.workspace.createFileSystemWatcher(vscode.workspace.workspaceFolders[0].uri.path+`/${dir}/*`, true, true, false)
        this.disposables.push(dirWatcher)
        dirWatcher.onDidDelete(this.onDidDeleteDir())

        this.testStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
        this.testStatusItem.tooltip = 'Test Results'
        this.testStatusItem.command = 'jvmcode.show-test-results'
        this.updateStatus()
        this.testStatusItem.show()
        this.disposables.push(this.testStatusItem)

        this.disposables.push(vscode.commands.registerCommand('jvmcode.show-test-results', async () => {
            this.showTestResults()
        }))
    }

    private updateStatus() {
        this.testStatusItem.text = `$(beaker) ${this.problemMap.size}`
    }

    onDidCreate() {
        return async (uri: vscode.Uri) => {
            this.createProblems(uri)
        }
    }

    onDidChange() {
        return async (uri: vscode.Uri) => {
            this.updateProblems(uri)
        }
    }

    onDidDelete() {
        return async (uri: vscode.Uri) => {
            this.removeProblems(uri)
        }
    }

    onDidDeleteDir() {
        return async (uri: vscode.Uri) => {
            this.removeDir(uri)
        }
    }

    private fqcnFromPath(path: string) : string {
        return PathHelper.basename(path, '.xml').replace('TEST-', '')
    }

    private async createProblems(uri: vscode.Uri) {
        let fqcn = this.fqcnFromPath(uri.path)
        if (!this.problemMap.has(uri.path)) {
            let problems = vscode.languages.createDiagnosticCollection(fqcn)
            this.disposables.push(problems)
            this.problemMap.set(uri.path, problems)
        }
        let problems = this.problemMap.get(uri.path)
        this.doUpdateProblems(uri, fqcn, problems)
    }

    private async doUpdateProblems(uri: vscode.Uri, fqcn: string, problems: vscode.DiagnosticCollection) {
        this.updateStatus()
        problems.clear()
        let localPackages = this.projectController.getPackages()
        fs.readFile(uri.path, (err, data) => {
            if (err) console.error(`Error reading ${uri.path}`, err)
            else {
                let json = xml.parse(data.toString(), {
                    ignoreAttributes: false, 
                    attributeNamePrefix:'', 
                    textNodeName:'stack', 
                    trimValues: true, 
                    arrayMode: true,
                    attrValueProcessor: (val) => {return he.decode(val)},
                    tagValueProcessor: (val) => {return he.decode(val)}
                }) as JUnitReport
                this.resultsMap.set(uri.path, json)
                json.testsuite.forEach(ts => {
                    this.processTestSuite(uri, ts, problems, localPackages)
                })
            }
        })
    }

    private async updateProblems(uri: vscode.Uri) {
        let fqcn = this.fqcnFromPath(uri.path)
        let problems = this.problemMap.get(uri.path)
        if (!problems) this.createProblems(uri)
        else this.doUpdateProblems(uri, fqcn, problems)
    }

    private async removeProblems(uri: vscode.Uri) {
        this.resultsMap.delete(uri.path)
        let problems = this.problemMap.get(uri.path)
        if (!problems) return
        problems.clear()
    }

    private removeDir(uri: vscode.Uri) {
        this.problemMap.forEach((value, key) => {
            if (key.startsWith(uri.path)) {
                value.clear()
                this.resultsMap.delete(key)
            }
        })
    }
    
    private async processTestSuite(xmlUri: vscode.Uri, suite: JUnitSuite, problems: vscode.DiagnosticCollection, packages: string[]) {
        let suitePath = await this.projectController.fqcn2Path(suite.name)
        let suiteUri = suitePath ? vscode.Uri.file(suitePath) : xmlUri
        suite.testcase.forEach(async tc => {
            let diagnostics = await this.processTestCase(tc, packages)
            if (diagnostics.length > 0) {
                let xmlDiag = new vscode.Diagnostic(new vscode.Range(0,0,0,0), "XML Test Results", vscode.DiagnosticSeverity.Information)
                let xmlLocation = new vscode.Location(xmlUri, new vscode.Position(0, 0))
                xmlDiag.relatedInformation = [new vscode.DiagnosticRelatedInformation(xmlLocation, `Tests: ${suite.tests} Failures: ${suite.failures} Skipped: ${suite.skipped} Errors: ${suite.errors}`)]
                diagnostics.push(xmlDiag)
                problems.set(suiteUri, diagnostics)
            }
        })
    }

    private async processTestCase(tcase: JUnitCase, packages: string[]) : Promise<vscode.Diagnostic[]> {
        let diagnostics : vscode.Diagnostic[] = []
        if (tcase.failure) {
            tcase.failure.forEach(async f => {
                let problem = await this.processFailure(tcase, f, packages)
                diagnostics.push(problem)
            })
        }
        return diagnostics
    }

    private async processFailure(tcase: JUnitCase, fail: JUnitFailure, packages: string[]) : Promise<vscode.Diagnostic> {
        let related : vscode.DiagnosticRelatedInformation[] = []
        fail.stack.split('\n').forEach(l => {
            let r = this.STACK_RE.exec(l.trim())
            if (r) {
                let classname = r[1]
                let filename = r[2]
                let pos = +r[3]-1
                let found = packages.find(p => {return classname.startsWith(p)})
                if (found) {
                    let path = this.projectController.filename2Path(filename)
                    if (path) {
                        let location = new vscode.Location(vscode.Uri.file(path), new vscode.Position(pos,0))
                        related.push(new vscode.DiagnosticRelatedInformation(location, `${classname} (${filename}: ${pos+1})`))
                    }
                }
            }
        })
        let range = new vscode.Range(0, 0, 0, 0)
        let problem = new vscode.Diagnostic(range, fail.message, vscode.DiagnosticSeverity.Error)
        problem.source = `${tcase.name} (${tcase.time})`
        problem.relatedInformation = related
        return problem
    }

    private async showTestResults() {
        let items = Array.from(this.resultsMap.keys())
        vscode.window.showQuickPick(items).then(item => {
            if (item) {
                vscode.workspace.openTextDocument({language: "json", content: JSON.stringify(this.resultsMap.get(item))})
            }
        })

    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }

}