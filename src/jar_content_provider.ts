'use strict';

import * as vscode from 'vscode';
import * as JSZip from 'jszip'
import { readFile } from 'fs';
import { ClassData } from 'server-models'

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
    private classDataMap = new Map<string, string>() // map of path to classdata for classfiles

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
     * Add a mapping of path to classdata
     */
    addClassData(uri: vscode.Uri, classData: ClassData) {
        let text = JSON.stringify(classData, undefined, 3)
        this.classDataMap.set(uri.toString(), text)
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

    private getContent(uri: vscode.Uri) : Promise<string> {
        if (uri.path.endsWith(".class")) return this.getClassContent(uri)
        else return this.getSourceContent(uri)
    }

    /**
     * Read the contents of the given path from the given source jar file.
     */
    private getSourceContent(uri: vscode.Uri) : Promise<string> {
        let jarFile = uri.fragment
        let path = uri.path.startsWith('/') ? uri.path.substring(1) : uri.path
        return new Promise((resolve, reject) => {
            readFile(jarFile, (err, data) => {
                if (err) {
                    resolve(`Error opening file ${jarFile}\n   ${err}`)
                }
                else {
                    JSZip.loadAsync(data).then(zip => {
                        let entry = zip.file(path)
                        if (!entry) resolve(`No entry found in ${jarFile} for ${path}`)
                        entry.async("string").then((text) =>{
                            this.classDataMap[uri.toString()] = text
                            resolve(text)
                        }).catch(reason => {
                            resolve(`Error in entry.async for ${entry.name} in ${jarFile}\n   ${reason}`)
                        })
                    }).catch(reason => {
                        resolve(`Error in loadAsync for ${jarFile}\n   ${reason}`)
                    })
                }
            })
        })
    }

    /**
     * Get the [ClassData] for the given class file uri and format it for a buffer
     */
    private getClassContent(uri: vscode.Uri) : Promise<string> {
        let key = uri.toString()
        return new Promise((resolve, reject) => {
            resolve(this.classDataMap.has(key) ? this.classDataMap.get(key) : `No ClassData available for ${key}`)
        })
    }
}