'use strict';

import * as vscode from 'vscode'
import { ProjectService } from './project_service';
import { LanguageService } from './language_service'
import { CompileRequest, CompileResult } from 'server-models'

/**
 * Responsible for managing JVM language services
 */
export class LanguageController {

    private projectService: ProjectService
    private languageService: LanguageService
    private problems: vscode.DiagnosticCollection

    public constructor(projectService: ProjectService, languageService: LanguageService) {
        this.projectService = projectService
        this.languageService = languageService
    }

    public start() {
        this.registerLanguage('java', ['java'])
    }

    public registerLanguage(languageId: string, extensions: string[]) {
        // Watch all .java files
        let pattern = vscode.workspace.workspaceFolders[0].uri.path+`/**/*.{${extensions.join(',')}}`
        let watcher = vscode.workspace.createFileSystemWatcher(pattern)
        watcher.onDidChange(this.triggerCompile)
        watcher.onDidDelete(this.triggerCompile)
        // Create diagnostics collection -- should the problems be managed by the language extension?
        this.problems = vscode.languages.createDiagnosticCollection('vsc-java')
    }

    triggerCompile = async (uri: vscode.Uri) => {
        // Do we request output, classpath, sourcepath from jvmcode based on file uri?
        let fileName = uri.fsPath
        let outputDir = vscode.workspace.workspaceFolders[0].uri.path+'/build/classes'
        let classpath = ''//this.projectService.getClasspath()
        let sourcepath = vscode.workspace.workspaceFolders[0].uri.path+'/src/main/java'
        // TODO Find dependent files also
        let request = {files: [fileName], outputDir: outputDir, classpath: classpath, sourcepath: sourcepath, name: 'what'} as CompileRequest
        let result = await this.languageService.requestCompile(request)
        this.problems.clear()
        result.diagnostics.forEach(d => {
            let uri = vscode.Uri.file(d.file)
            let existing = this.problems.get(uri)
            let range = new vscode.Range(d.line-1, d.column-1, d.line-1, d.column-1)
            let severity = d.severity === 'ERROR' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning 
            let diagnostic = new vscode.Diagnostic(range, d.message, severity)
            this.problems.set(uri, existing.concat(diagnostic))
        })
    }
}