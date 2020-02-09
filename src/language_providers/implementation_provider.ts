import * as vscode from 'vscode'

/**
 * Requires Symbols
 */
export class JvmImplementationProvider implements vscode.ImplementationProvider {

    provideImplementation(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        console.log(`Impl: ${document.uri} ${position}`)
        return undefined
    }

}