'use strict';

import * as vscode from 'vscode'
import * as PathHelper from 'path'
import * as fs from 'fs'
import * as xml from 'fast-xml-parser'
import * as he from 'he'
import { JUnitSuite, JUnitReport, JUnitCase, JUnitFailure } from './models';
import { ProjectController } from './project_controller';

/**
 * Responsible for managing JUnit integrations, watching for changes in test reports, maybe recognizing test methods
 */
export class JUnitController implements vscode.Disposable {

    private STACK_RE = new RegExp("^at\\s+(.*)\\((.*):(\\d+)\\)$") // (class.method)(filename)(position)
    private projectController : ProjectController
    // Problems by test result XML file path
    private problemMap = new Map<string, vscode.DiagnosticCollection>()
    private disposables : vscode.Disposable[] =  []

    public constructor(projectController: ProjectController) {
        this.projectController = projectController
    }

    public start() {
        let pattern = vscode.workspace.workspaceFolders[0].uri.path+"/**/build/test-results/test/*.{xml}"
        let watcher = vscode.workspace.createFileSystemWatcher(pattern)
        this.disposables.push(watcher)
        watcher.onDidChange(this.onDidChange())
        watcher.onDidDelete(this.onDidDelete())
        watcher.onDidCreate(this.onDidCreate())
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

    private fqcnFromPath(path: string) : string {
        return PathHelper.basename(path, 'xml').replace('TEST-', '')
    }

    private async createProblems(uri: vscode.Uri) {
        console.log(`createProblems(${uri.path})`)
        let fqcn = this.fqcnFromPath(uri.path)
        let problems = vscode.languages.createDiagnosticCollection(fqcn)
        this.disposables.push(problems)
        this.problemMap.set(fqcn, problems)
        this.doUpdateProblems(uri, fqcn, problems)
    }

    private async doUpdateProblems(uri: vscode.Uri, fqcn: string, problems: vscode.DiagnosticCollection) {
        console.log(`doUpdateProblems(${uri.path}, ${fqcn})`)
        problems.clear()
        let pkgs = this.projectController.getPackages()
        fs.readFile(uri.path, (err, data) => {
            if (err) console.log(`Error reading ${uri.path}`, err)
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
                json.testsuite.forEach(ts => {
                    this.processTestSuite(ts, problems)
                })
            }
        })
    }

    private async updateProblems(uri: vscode.Uri) {
        let fqcn = this.fqcnFromPath(uri.path)
        let problems = this.problemMap.get(fqcn)
        if (!problems) this.createProblems(uri)
        else this.doUpdateProblems(uri, fqcn, problems)
    }

    private async removeProblems(uri: vscode.Uri) {
        console.log(`removeProblems(${uri.path})`)
        let fqcn = this.fqcnFromPath(uri.path)
        let problems = this.problemMap.get(fqcn)
        if (!problems) return
        problems.clear()
    }

    private async processTestSuite(suite: JUnitSuite, problems: vscode.DiagnosticCollection) {
        suite.testcase.forEach(async tc => {
            let diagnostics = await this.processTestCase(tc)
            sourceUri = sourceUri ? sourceUri : uri
            problems.set(sourceUri, diagnostics)
        })
    }

    private async processTestCase(tcase: JUnitCase) : Promise<vscode.Diagnostic[]> {
        let sourcePath = await this.projectController.fqcn2Path(tcase.classname)
        let sourceUri = sourcePath ? vscode.Uri.file(sourcePath) : undefined
        let diagnostics : vscode.Diagnostic[] = []
        if (tcase.failure) {
            tcase.failure.forEach(async f => {
                let problem = await this.processFailure(tcase, f, sourceUri)
                diagnostics.push(problem)
            })
            return diagnostics
        }
    }

    private async processFailure(tcase: JUnitCase, fail: JUnitFailure, uri?: vscode.Uri) : Promise<vscode.Diagnostic> {
        let locations : vscode.Location[] = []
        fail.stack.split('\n').forEach(l => {
            let r = this.STACK_RE.exec(l.trim())
            if (r) {
                let classname = r[1]
                let filename = r[2]
                let pos = +r[3]-1
                let found = pkgs.find(p => {return classname.startsWith(p)})
                if (found) {
                    let path = this.projectController.filename2Path(filename)
                    if (path) {
                        let location = new vscode.Location(vscode.Uri.file(path), new vscode.Position(pos,0))
                        locations.push(location)
                    }
                }
            }
        })
        uri = locations.length > 0 && !uri ? locations[0].uri : uri
        let range = locations.length > 0 ? locations[0].range : new vscode.Range(0, 0, 0, 0)
        let problem = new vscode.Diagnostic(range, fail.message, vscode.DiagnosticSeverity.Error)
        problem.source = `${tcase.name} (${tcase.time})`
        let related = []
        locations.slice(1).forEach(l => {
            related.push(new vscode.DiagnosticRelatedInformation(l, ''))
        })
        related.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(uri, new vscode.Position(0,0)), 'Test Results'))
        problem.relatedInformation = related
        return problem
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }

}