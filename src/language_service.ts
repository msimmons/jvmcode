'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server';
import { CompileRequest, CompileResult, ParseRequest } from 'server-models'
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
     * Listen for language service registrations
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
     * Indicate we are ready for language verticle to start
     */
    public startLanguage() {
        server.send('jvmcode.start-language', {})
    }

    /**
     * Request that a buffer be parsed by an appropriate language service
     * @param file 
     */
    public async requestParse(request: ParseRequest) {
        let reply = await server.send('jvmcode.request-parse', request)
        return reply.body
    }

    /**
     * Request compilation of the given files
     */
    public async requestCompile(request: CompileRequest) : Promise<CompileResult> {
        let reply = await server.send('jvmcode.request-compile', request)
        return reply.body
    }

}