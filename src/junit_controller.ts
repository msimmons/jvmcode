'use strict';

import * as vscode from 'vscode'
import * as PathHelper from 'path'
import * as fs from 'fs'
import * as xml from 'fast-xml-parser'
import { JUnitSuite, JUnitReport } from './models';

/**
 * Responsible for managing JUnit integrations, watching for changes in test reports, maybe recognizing test methods
 */
export class JUnitController implements vscode.Disposable {

    // Problems by test result XML file path
    private problemMap = new Map<string, vscode.DiagnosticCollection>()
    private disposables : vscode.Disposable[] =  []

    public constructor() {
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
        fs.readFile(uri.path, (err, data) => {
            if (err) console.log(`Error reading ${uri.path}`, err)
            else {
                let json = xml.parse(data.toString(), {ignoreAttributes: false, attributeNamePrefix:'', textNodeName:'stack', trimValues: true, arrayMode: true}) as JUnitReport
                console.log(json)
                json.testsuite.forEach(ts => {
                    ts.testcase.forEach(tc => {
                        if (tc.failure) {
                            tc.failure.forEach(f => {
                                console.log(tc.failure)
                            })
                        }
                    })
                })
            }
        })       
    }

    private async updateProblems(uri: vscode.Uri) {
        let fqcn = this.fqcnFromPath(uri.path)
        let problems = this.problemMap.get(fqcn)
        if (problems) this.createProblems(uri)
        else this.doUpdateProblems(uri, fqcn, problems)
    }

    private async removeProblems(uri: vscode.Uri) {
        console.log(`removeProblems(${uri.path})`)
        let fqcn = this.fqcnFromPath(uri.path)
        let problems = this.problemMap.get(fqcn)
        if (!problems) return
        problems.clear()
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }

}