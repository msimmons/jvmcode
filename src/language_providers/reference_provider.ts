import * as vscode from 'vscode'

/**
 * Requires workspace Symbols
 */
export class JvmReferenceProvider implements vscode.ReferenceProvider {

    provideReferences(document: vscode.TextDocument, position: vscode.Position, context: vscode.ReferenceContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location[]> {
        return undefined
    }

}