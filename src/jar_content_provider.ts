'use strict';

import * as vscode from 'vscode';
import * as JSZip from 'jszip'
import { readFile } from 'fs';

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
    private entries = new Map<string, string>()

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
     * Get rid of all result sets
     */
    clearResults() {
        this.entries.clear()
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
     * Read the contents of the given path from the given jar file
     */
    getContent(uri: vscode.Uri) : Promise<string> {
        let jarFile = uri.fragment
        let path = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path
        return new Promise((resolve, reject) => {
            readFile(jarFile, (err, data) => {
                console.log(err)
                JSZip.loadAsync(data).then(zip => {
                    let entry = zip.file(path)
                    if (!entry) resolve(`No entry found in ${jarFile} for ${path}`)
                    entry.async("string").then((text) =>{
                        this.entries[uri.toString()] = text
                        resolve(text)
                    }).catch(reason => {
                        resolve(`Error in entry.async for ${entry.name}\n   ${reason}`)
                    })
                }).catch(reason => {
                    resolve(`Error in loadAsync for ${jarFile}\n   ${reason}`)
                })
            })
        })
    }
}