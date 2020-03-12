import * as vscode from 'vscode'

/**
 * Requires Symbols
 */
export class JvmSignatureProvider implements vscode.SignatureHelpProvider {

    provideSignatureHelp(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.SignatureHelpContext): vscode.ProviderResult<vscode.SignatureHelp> {
        return undefined
    }

}