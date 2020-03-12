'use strict';

import * as vscode from 'vscode';
import { ClassData } from 'server-models'

/**
 * Provide content for class files (serialized [ClassData])
 */
export class ClassContentProvider implements vscode.TextDocumentContentProvider {

    /**
     * Uri is of the form jvmcode-class://classdata/path#jarFile
     */
    public scheme = 'jvmcode-class';

	private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    private subscriptions: vscode.Disposable;
    private classDataMap = new Map<string, string>() // map of path to classdata for classes

	public constructor() {
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
     * A map key based on Uri
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
        this.classDataMap.set(this.getUriKey(uri), text)
    }

    /**
     * Get rid of all classdata
     */
    clearResults() {
        this.classDataMap.clear()
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

    /**
     * Get the [ClassData] for the given class file uri and format it for a buffer
     */
    private getContent(uri: vscode.Uri) : string {
        let key = this.getUriKey(uri)
        return this.classDataMap.has(key) ? this.classDataMap.get(key) : `No ClassData available for ${key}`
    }
}