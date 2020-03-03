'use strict';

import * as vscode from 'vscode'

/**
 * Service to return configuration to send to server when necessary
 */
export class IconService {

    context: vscode.ExtensionContext
    constructor(context: vscode.ExtensionContext) {
        this.context = context
    }

    /**
     * Return a config object to send to server
     */
    public getIconPath(iconName: string) : string {
        return this.context.asAbsolutePath(`resources/${iconName}`)
    }

}