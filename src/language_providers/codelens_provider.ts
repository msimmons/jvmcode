import * as vscode from 'vscode'

export class JvmCodeLensProvider implements vscode.CodeLensProvider {

    onDidChangeCodeLenses?: vscode.Event<void>;    
    
    provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens[]> {
        // Run/Degug main (ClassData)
        // Run/Debug test (ClassData)
        console.log(`Lens: ${document.uri}`)
        return undefined
    }

    resolveCodeLens?(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        throw new Error("Method not implemented.");
    }

}