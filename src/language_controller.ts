'use strict';

import * as vscode from 'vscode'
import { LanguageService } from './language_service'
import { CompileRequest, CompileResult, LanguageRequest, ParseRequest } from 'server-models'
import { languageService } from './extension';
import { ConfigService } from './config_service';
import { PathRootNode } from './models';
import { ProjectController } from './project_controller';

/**
 * Responsible for managing JVM language services
 */
export class LanguageController {

    private languageService: LanguageService
    private projectController: ProjectController
    private problemCollections = new Map<string, vscode.DiagnosticCollection>()

    public constructor(languageService: LanguageService, projectController: ProjectController) {
        this.languageService = languageService
        this.projectController = projectController
        this.registerLanguageListener()
    }

    public start() {
        // Temporarily trigger the language verticle to send request
        languageService.startLanguage()
    }

    /** 
     * Register a consumer for language requests
     */
    private registerLanguageListener() {
        this.languageService.registerLanguageListener((languageRequest: LanguageRequest) => {
            this.registerLanguage(languageRequest)
        })
    }

    public registerLanguage(request: LanguageRequest) {
        // Watch files with the requested extensions
        let pattern = vscode.workspace.workspaceFolders[0].uri.path+`/**/*.{${request.extensions.join(',')}}`
        let watcher = vscode.workspace.createFileSystemWatcher(pattern)
        watcher.onDidChange(this.requestCompile(request.languageId))
        watcher.onDidDelete(this.requestCompile(request.languageId))
        vscode.workspace.onDidOpenTextDocument(this.requestParse)
        // Create diagnostics collection -- should the problems be managed by the language extension?
        this.problemCollections.set(request.name, vscode.languages.createDiagnosticCollection(request.name))
    }

    /**
     * Request compilation and put the diagnostics in the right place
     */
    requestCompile(languageId: string) {
        return async (uri: vscode.Uri) => {
            let context = this.projectController.getFileContext(uri)
            let classpath = this.projectController.getClasspath()
            // TODO Find dependent files also
            let request = {languageId: languageId, files: [context.path], outputDir: context.outputDir, classpath: classpath, sourcepath: context.sourceDir, name: 'vsc-java'} as CompileRequest
            let result = await this.languageService.requestCompile(request)
            let problems = this.problemCollections.get(result.name)
            problems.clear()
            result.diagnostics.forEach(d => {
                let uri = vscode.Uri.file(d.file)
                let existing = problems.get(uri)
                let range = new vscode.Range(d.line-1, d.column-1, d.line-1, d.column-1)
                let severity = d.severity === 'ERROR' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning 
                let diagnostic = new vscode.Diagnostic(range, d.message, severity)
                problems.set(uri, existing.concat(diagnostic))
            })
        }
    }

    /**
     * Request parse and deal with the results
     */
    requestParse = async (doc: vscode.TextDocument) => {
        let request = {languageId: doc.languageId, file: doc.uri.path} as ParseRequest
        let result = await this.languageService.requestParse(request)
    }

}