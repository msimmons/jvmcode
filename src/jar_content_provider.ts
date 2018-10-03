'use strict';

import * as vscode from 'vscode';
import { Uri } from 'vscode';
import { JarEntryData } from './models';

/**
 * Provide content for resources found in JAR files
 */
export class JarContentProvider implements vscode.TextDocumentContentProvider {

    /**
     * Uri is of the form kradle-jarcontent://groupId.artifactId.version/package/name
     */
	public scheme = 'jvmcode-jar';

	private onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    private subscriptions: vscode.Disposable;
    private entries = {}
    private context: vscode.ExtensionContext

	public constructor(context: vscode.ExtensionContext) {
        this.context = context
		// Listen to the `closeTextDocument`-event which means we must
		// clear the corresponding model object - `ReferencesDocument`
        //this.subscriptions = vscode.workspace.onDidCloseTextDocument(doc => {this.closeDoc(doc)})
    }
    
    /**
     * Update the view based on the new sqlStatement
     * @param uri The uri to update
     * @param entry new JarEntryData to update with
     */
    update(uri: Uri, entry: JarEntryData) {
        this.entries[uri.path] = {entry: entry}
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
        if ( !this.entries.hasOwnProperty(uri.path) ) return ''
        else return this.entries[uri.path].entry.text
        /**
        let text = this.entries[uri.path].entry.text
        return `
        <html>
        <body>
        <pre><code>${text}</code></pre>
        <!--textarea disabled="true" style="border: none;background-color:white;width=100%;height=100%">${text}</textarea-->
        </body>
        </html>
        `
        */
    }
    
    getScriptUri(fileName: string) : Uri {
        return vscode.Uri.file(this.context.asAbsolutePath('ui/'+fileName))
    }

}