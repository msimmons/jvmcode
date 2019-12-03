'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server';
import { CompileRequest, CompileResult } from 'server-models'
import { server } from './extension';

/**
 * Service to make language related requests to JvmServer on behalf of other components.
 */
export class LanguageService {

    private server: JvmServer
    private languageListeners = [] // Array of language callbacks

    public constructor(server: JvmServer) {
        this.server = server
        this.server.registerConsumer('jvmcode.language', this.languageListener)
    }

    /**
     * List for language service registrations
     * @param callback 
     */
    private languageListener = (error, result) => {
        if (error || !result) {
            console.error('Got a language event with bad payload', error)
        }
        else {
            let languageInfo = result.body
            this.languageListeners.forEach((listener) => {
                listener(languageInfo)
            })
            // Name of language
            // What file extensions it covers
            // Is there any need for other listeners?
        }
    }

    /**
     * Register a listener for incoming language requests
     * @param callback(project: JvmProject)
     */
    public registerLanguageListener(callback) {
        this.languageListeners.push(callback)
    }

    /**
     * Request that a buffer be parsed by an appropriate language service
     * @param file 
     */
    public requestParse(file: vscode.Uri) {

    }

    /**
     * Request compilation of the given files
     */
    public async requestCompile(request: CompileRequest) : Promise<CompileResult> {
        let reply = await server.send('jvmcode.request-compile', request)
        return reply.body
    }

}