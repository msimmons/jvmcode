'use strict';

import * as vscode from 'vscode';
import { Uri } from 'vscode';

/**
 * Provide content for resources found in JAR files
 */
export class JarContentProvider implements vscode.TextDocumentContentProvider {

    /**
     * Uri is of the form jvmcode-jar://groupId.artifactId.version/package/name
     */
	public scheme = 'jvmcode-jar';

	private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    private subscriptions: vscode.Disposable;
    private entries = {}

	public constructor() {
		// Listen to the `closeTextDocument`-event which means we must
		// clear the corresponding model object - `ReferencesDocument`
        //this.subscriptions = vscode.workspace.onDidCloseTextDocument(doc => {this.closeDoc(doc)})
    }
    
    /**
     * Update the view based on the new jar entry
     * @param uri The uri to update
     * @param entry new JarEntryData to update with
     */
    update(uri: Uri, content: string) {
        this.entries[uri.toString()] = content
        this.onDidChangeEmitter.fire(uri);
    }

    dispose() {
		this.subscriptions.dispose();
        this.onDidChangeEmitter.dispose();
        this.clearResults();
	}

    /**
     * Get rid of all result sets
     */
    clearResults() {
        this.entries = {}
    }

	/** Expose an event to signal changes of _virtual_ documents
	 * to the editor
     */
	get onDidChange() {
		return this.onDidChangeEmitter.event;
	}

    /**
     * Provide the html content for the given uri (queryId)
     * @param uri The uri to provider for
     */
	provideTextDocumentContent(uri: vscode.Uri): string | Thenable<string> {
        if ( !this.entries.hasOwnProperty(uri.toString()) ) return ''
        else return this.entries[uri.toString()]
    }

}