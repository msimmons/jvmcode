import * as vscode from 'vscode'

/**
 * Requires Symbols
 */
export class JvmTypeDefinitionProvider implements vscode.TypeDefinitionProvider {

    provideTypeDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        return undefined
    }
}