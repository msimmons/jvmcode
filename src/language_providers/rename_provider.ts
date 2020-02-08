import * as vscode from 'vscode'

/**
 * Requires workspace Symbols
 */
export class JvmRenameProvider implements vscode.RenameProvider {

    provideRenameEdits(document: vscode.TextDocument, position: vscode.Position, newName: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.WorkspaceEdit> {
        console.log(`Rename: ${document.uri} ${position} ${newName}`)
        return undefined
    }

    prepareRename?(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Range | { range: vscode.Range; placeholder: string; }> {
        throw new Error("Method not implemented.");
    }

}