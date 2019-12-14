import * as vscode from 'vscode'

/**
 * Requires Symbols
 */
export class JvmCompletionProvider implements vscode.CompletionItemProvider {

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        console.log(`Completion: ${document.uri}`)
        console.log(context.triggerCharacter)
        return undefined
    }
        
    resolveCompletionItem?(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        throw new Error("Method not implemented.");
    }

}