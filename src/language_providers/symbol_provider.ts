import * as vscode from 'vscode'

/**
 * Requires Symbols and workspace Symbols
 */
export class JvmSymbolProvider implements vscode.DocumentSymbolProvider, vscode.WorkspaceSymbolProvider {

    provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[]> {
        console.log(`WSSym: ${query}`)
        return undefined
    }

    resolveWorkspaceSymbol?(symbol: vscode.SymbolInformation, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation> {
        throw new Error("Method not implemented.");
    }

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        console.log(`Sym: ${document.uri}`)
        return undefined
    }

}