'use strict';

import * as vscode from 'vscode'
import {LocalConfig} from './models'

/**
 * Service to return configuration to send to server when necessary
 */
export class ConfigService {

    /**
     * Return a config object to send to server
     */
    public static getConfig() : LocalConfig {
        let configuration = vscode.workspace.getConfiguration('jvmcode')
        let javaHome: string = configuration.get('javaHome') as string
        let excludes: string[] = configuration.get('excludes') as string[]
        let extensions: string[] = configuration.get('sourceExtensions') as string[]
        let jmodIncludes: string[] = configuration.get('jmodIncludes') as string[]
        let srcLocation: string = configuration.get('srcLocation') as string
        let outputDirMap: string[] = configuration.get('outputDirMap') as string[]
        let testResultsDir: string = configuration.get('testResultsDir') as string
        return { javaHome: javaHome, excludes: excludes, extensions: extensions, jmodIncludes: jmodIncludes, srcLocation: srcLocation, outputDirMap: outputDirMap, testResultsDir: testResultsDir }
    }

    public static getJavaCommand() : string {
        return vscode.workspace.getConfiguration('jvmcode').get('javaCommand') as string
    }
}