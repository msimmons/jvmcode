import * as vscode from 'vscode'

/**
 * Requires Symbols
 */
export class JvmDefinitionProvider implements vscode.DefinitionProvider {

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        console.log(`Definition: ${document.uri}`)
        return undefined
    }

}