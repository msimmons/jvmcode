'use strict';

import * as vscode from 'vscode'

/**
 * Service to return configuration to send to server when necessary
 */
export class ConfigService {

    /**
     * Return a config object to send to server
     */
    public static getConfig() : any {
        let configuration = vscode.workspace.getConfiguration('jvmcode')
        let excludes: string[] = configuration.get('excludes')
        let extensions: string[] = configuration.get('sourceExtensions')
        return { excludes: excludes, extensions: extensions }
    }
}