'use strict';

import * as vscode from 'vscode'
import { LanguageService } from './language_service'
import { CompileRequest, CompileResult, LanguageRequest, ParseRequest } from 'server-models'
import { languageService } from './extension';
import { ProjectController } from './project_controller';
import * as provider from './language_providers'

/**
 * Responsible for managing JVM language services
 */
export class LanguageController implements vscode.Disposable {

    private languageService: LanguageService
    private projectController: ProjectController
    private problemCollections = new Map<string, vscode.DiagnosticCollection>()
    private disposables : vscode.Disposable[] =  []

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
        watcher.onDidChange(this.onDidChange(request))
        watcher.onDidDelete(this.onDidDelete(request))
        vscode.workspace.onDidOpenTextDocument(this.onDidOpen(request))
        // Create diagnostics collection -- should the problems be managed by the language extension?
        this.problemCollections.set(request.name, vscode.languages.createDiagnosticCollection(request.name))
        // Register all the providers
        this.registerProviders(request)
    }

    onDidChange(request: LanguageRequest) {
        return async (uri: vscode.Uri) => {
            this.requestCompile(request.languageId, uri)
        }
    }

    onDidDelete(request: LanguageRequest) {
        return async (uri: vscode.Uri) => {
            this.requestCompile(request.languageId, uri)
        }
    }

    onDidOpen(request: LanguageRequest) {
        return async (doc: vscode.TextDocument) => {
            this.requestParse(doc)
        }
    }

    /**
     * Register all the providers (for a specific language?)
     */
    public registerProviders(request: LanguageRequest) {
        let fileSelector = { scheme: 'file', language: request.languageId } as vscode.DocumentSelector
        let allSelector = { language: request.languageId } as vscode.DocumentSelector
        this.disposables.push(vscode.languages.registerCodeActionsProvider(fileSelector, new provider.JvmActionProvider())) // Action types?
        this.disposables.push(vscode.languages.registerCodeLensProvider(fileSelector, new provider.JvmCodeLensProvider()))
        this.disposables.push(vscode.languages.registerCompletionItemProvider(fileSelector, new provider.JvmCompletionProvider())) // Trigger chars?
        this.disposables.push(vscode.languages.registerDefinitionProvider(allSelector, new provider.JvmDefinitionProvider()))
        this.disposables.push(vscode.languages.registerHoverProvider(allSelector, new provider.JvmHoverProvider()))
        this.disposables.push(vscode.languages.registerImplementationProvider(allSelector, new provider.JvmImplementationProvider()))
        this.disposables.push(vscode.languages.registerReferenceProvider(allSelector, new provider.JvmReferenceProvider()))
        this.disposables.push(vscode.languages.registerRenameProvider(fileSelector, new provider.JvmRenameProvider()))
        this.disposables.push(vscode.languages.registerSignatureHelpProvider(fileSelector, new provider.JvmSignatureProvider())) // Meta for trigger chars
        let symbolProvider = new provider.JvmSymbolProvider()
        this.disposables.push(vscode.languages.registerDocumentSymbolProvider(fileSelector, symbolProvider)) // metadata?
        this.disposables.push(vscode.languages.registerWorkspaceSymbolProvider(symbolProvider))
        this.disposables.push(vscode.languages.registerTypeDefinitionProvider(allSelector, new provider.JvmTypeDefinitionProvider()))
    }

    /**
     * Request compilation and put the diagnostics in the right place
     */
    async requestCompile(languageId: string, uri: vscode.Uri) {
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

    /**
     * Request parse and deal with the results
     */
    async requestParse(doc: vscode.TextDocument) {
        let request = {languageId: doc.languageId, file: doc.uri.path} as ParseRequest
        let result = await this.languageService.requestParse(request)
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }

}