'use strict';

import * as vscode from 'vscode';
import * as JSZip from 'jszip'
import { readFile } from 'fs';
import { ClassData } from './class_data/class_data'
import { ProjectRepository } from './project_repository';

/**
 * Provide content for resources found in JAR files
 */
export class JarContentProvider implements vscode.TextDocumentContentProvider {

    /**
     * Uri is of the form jvmcode-jar://groupId.artifactId.version/path#jarFile
     */
    public scheme = 'jvmcode-jar';

	private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    private subscriptions: vscode.Disposable;
    private contentMap = new Map<string, string>() // Map of URI to content -- think about LRU for memory conservation
    private repository: ProjectRepository

    constructor(repository: ProjectRepository) {
        this.repository = repository
		// Listen to the `closeTextDocument`-event which means we must
		// clear the corresponding model object - `ReferencesDocument`
        //this.subscriptions = vscode.workspace.onDidCloseTextDocument(doc => {this.closeDoc(doc)})
    }
    
    dispose() {
		this.subscriptions.dispose();
        this.onDidChangeEmitter.dispose();
        this.clearResults();
    }

    /**
     * The uri without the jarFile
     * @param uri 
     */
    private getUriKey(uri: vscode.Uri) : string {
        return uri.toString()
    }
    
    /**
     * Add a mapping of path to classdata
     */
    addClassData(uri: vscode.Uri, classData: ClassData) {
        let text = JSON.stringify(classData, undefined, 3)
        this.contentMap.set(this.getUriKey(uri), text)
    }

    /**
     * Get rid of all classdata
     */
    clearResults() {
        this.contentMap.clear()
    }

	/** Expose an event to signal changes of _virtual_ documents
	 * to the editor
     */
	get onDidChange() {
		return this.onDidChangeEmitter.event;
	}

    /**
     * Provide the content for the given uri
     * @param uri The uri to provider for
     */
	provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        return this.getContent(uri)
    }

    private getContent(uri: vscode.Uri) : Promise<string> {
        if (uri.path.endsWith(".class")) return this.getClassContent(uri)
        else return this.getSourceContent(uri)
    }

    /**
     * Read the contents of the given path from the given source jar file.
     */
    private async getSourceContent(uri: vscode.Uri) : Promise<string> {
        let jarFile = uri.fragment
        let path = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path
        let buffer = await this.repository.readJarEntry(jarFile, path)
        return buffer.toString('utf8')
    }

    /**
     * Get the [ClassData] for the given class file uri and format it for a buffer
     */
    private getClassContent(uri: vscode.Uri) : Promise<string> {
        let key = this.getUriKey(uri)
        return new Promise((resolve, reject) => {
            resolve(this.contentMap.has(key) ? this.contentMap.get(key) : `No ClassData available for ${key}`)
        })
    }
}