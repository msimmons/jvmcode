'use strict';

import * as vscode from 'vscode'
import {JvmConfig} from "server-models"

/**
 * Service to return configuration to send to server when necessary
 */
export class ConfigService {

    /**
     * Return a config object to send to server
     */
    public static getConfig() : JvmConfig {
        let configuration = vscode.workspace.getConfiguration('jvmcode')
        let excludes: string[] = configuration.get('excludes') as string[]
        let extensions: string[] = configuration.get('sourceExtensions') as string[]
        let jmodIncludes: string[] = configuration.get('jmodIncludes') as string[]
        let srcLocation: string = configuration.get('srcLocation') as string
        return { excludes: excludes, extensions: extensions, jmodIncludes: jmodIncludes, srcLocation: srcLocation}
    }
}