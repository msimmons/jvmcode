import * as vscode from 'vscode'

/**
 * Languages provide Diagnostic -> Action mappings which can be looked up here
 */
export class JvmActionProvider implements vscode.CodeActionProvider {

    provideCodeActions(document: vscode.TextDocument, range: vscode.Range | vscode.Selection, context: vscode.CodeActionContext, token: vscode.CancellationToken): vscode.ProviderResult<(vscode.Command | vscode.CodeAction)[]> {
        // Can we extend our Diagnositc object to include actions?
        return undefined
    }

}