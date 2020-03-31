'use strict';

import * as vscode from 'vscode'
import { CompileRequest, LanguageRequest, ParseRequest, ParseResult } from './language_model'
import { ProjectController } from './project_controller';
import * as provider from './language_providers'
import { TreeNode, LanguageNode } from './models';
import { LanguageTreeProvider } from './language_tree_provider';
import { languageController } from './extension';
import { JavaProvider } from './java_language/java_provider';

/**
 * Responsible for managing JVM language services
 */
export class LanguageController implements vscode.Disposable {

    private projectController: ProjectController
    private languageMap = new Map<string, LanguageRequest>()
    private problemCollections = new Map<string, vscode.DiagnosticCollection>()
    private disposables : vscode.Disposable[] =  []
    private parseResults = new Map<string, Promise<ParseResult>>()
    private rootNodes: Array<LanguageNode> = []
    private languageTree: LanguageTreeProvider
    private started: boolean = false

    public constructor(projectController: ProjectController) {
        this.projectController = projectController
    }

    public start() {
        if (this.started) return
        this.languageTree = new LanguageTreeProvider(languageController)
        vscode.window.registerTreeDataProvider(this.languageTree.viewId, this.languageTree)
    }

    /**
     * API exposed to other extensions to request language support
     * @param request 
     */
    public registerLanguage(request: LanguageRequest) {
        this.start()
        this.languageMap.set(request.languageId, request)
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
        this.rootNodes.push(new LanguageNode(request))
        this.languageTree.update()
    }

    onDidChange(request: LanguageRequest) {
        return async (uri: vscode.Uri) => {
            this.requestCompile(request.languageId, uri)
        }
    }

    onDidDelete(request: LanguageRequest) {
        return async (uri: vscode.Uri) => {
            // TODO remove problems for this URI
            this.requestCompile(request.languageId, uri)
        }
    }

    onDidOpen(request: LanguageRequest) {
        return async (doc: vscode.TextDocument) => {
            //if (doc.uri.scheme === 'file') this.requestParse(doc)
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
        let completionProvider = new provider.JvmCompletionProvider(request, this, this.projectController)
        this.disposables.push(vscode.languages.registerCompletionItemProvider(fileSelector, completionProvider, ...request.triggerChars))
        this.disposables.push(vscode.languages.registerDefinitionProvider(allSelector, new provider.JvmDefinitionProvider(this)))
        this.disposables.push(vscode.languages.registerHoverProvider(allSelector, new provider.JvmHoverProvider(this)))
        this.disposables.push(vscode.languages.registerImplementationProvider(allSelector, new provider.JvmImplementationProvider()))
        this.disposables.push(vscode.languages.registerReferenceProvider(allSelector, new provider.JvmReferenceProvider()))
        this.disposables.push(vscode.languages.registerRenameProvider(fileSelector, new provider.JvmRenameProvider()))
        this.disposables.push(vscode.languages.registerSignatureHelpProvider(fileSelector, new provider.JvmSignatureProvider())) // Meta for trigger chars
        let symbolProvider = new provider.JvmSymbolProvider(this)
        this.disposables.push(vscode.languages.registerDocumentSymbolProvider(allSelector, symbolProvider)) // metadata?
        this.disposables.push(vscode.languages.registerWorkspaceSymbolProvider(symbolProvider))
        this.disposables.push(vscode.languages.registerTypeDefinitionProvider(allSelector, new provider.JvmTypeDefinitionProvider()))
    }

    /**
     * Clear all problems for the given name
     * @param name the [LanguageRequest.name]
     */
    public clearProblems(name: string) {
        let problems = this.problemCollections.get(name)
        if (problems) problems.clear()
    }

    public getRootNodes() : LanguageNode[] {
        return this.rootNodes
    }

    public getChildren(element: TreeNode) : TreeNode[] {
        return element.children()
    }

    /**
     * Request compilation and put the diagnostics in the right place
     */
    async requestCompile(languageId: string, uri: vscode.Uri) {
        if (uri.scheme != "file") {
            console.debug(`Skip compile of non-file schema ${uri}`)
            return
        }
        let context = this.projectController.getFileContext(uri)
        if (!context) {
            console.debug(`Skip compile of ${languageId} ${uri.path}`)
            return
        }
        let language = this.languageMap.get(languageId)
        if (!language) {
            console.debug(`No handler found for ${languageId}`)
            return
        }
        let classpath = this.projectController.getClasspath()
        let request = {languageId: languageId, files: [context.path], outputDir: context.outputDir, classpath: classpath, sourcepath: context.sourceDir, name: language.name} as CompileRequest
        vscode.window.withProgress({location: vscode.ProgressLocation.Window}, async (progress) => {
            progress.report({message: 'Compiling...'})
            let result = await language.compile(request)
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
        })
    }

    /**
     * Request parse and deal with the results
     */
    private async requestParse(doc: vscode.TextDocument) : Promise<ParseResult> {
        let key = doc.uri.toString()
        if (!doc.isDirty && this.parseResults.has(key)) return this.parseResults.get(key)
        let language = this.languageMap.get(doc.languageId)
        if (!language) {
            console.debug(`No handler found for ${doc.languageId}`)
            return undefined
        }
        let text = doc.getText()
        let request = {languageId: doc.languageId, file: doc.uri.path, text: text} as ParseRequest
        let promise = language.parse(request)
        this.parseResults.set(key, promise)
        return promise
    }

    /**
     * Get ParseResult for the given doc
     */
    async getParseResult(doc: vscode.TextDocument) : Promise<ParseResult> {
        return this.requestParse(doc)
    }

    /**
     * Get the [Location] of the given FQCN type reference
     */
    async getRefLocation(fqcn: string) : Promise<vscode.Location> {
        let uri = await this.projectController.getFqcnUri(fqcn)
        // TODO parse text to find position
        new vscode.Location(uri, new vscode.Position(0,0))
        return uri ? new vscode.Location(uri, new vscode.Position(0,0)) : undefined
    }

    dispose() {
        this.disposables.forEach(d => d.dispose())
    }

}