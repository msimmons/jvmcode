import * as vscode from 'vscode'

/**
 * Requires Symbols
 */
export class JvmHoverProvider implements vscode.HoverProvider {

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        console.log(`Hover: ${document.uri} ${position}`)
        return undefined
    }

}