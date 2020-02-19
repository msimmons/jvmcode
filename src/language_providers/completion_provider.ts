import * as vscode from 'vscode'
import { LanguageController } from '../language_controller';
import { ProjectController } from '../project_controller';

/**
 * Requires Symbols
 */
export class JvmCompletionProvider implements vscode.CompletionItemProvider {

    private langController: LanguageController
    private projController: ProjectController

    constructor(langController: LanguageController, projController: ProjectController) {
        this.langController = langController
        this.projController = projController
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        console.log(`Completion: ${document.uri}`)
        console.log(context.triggerCharacter)
        let range = document.getWordRangeAtPosition(position)
        let word = document.getText(range).toLocaleLowerCase()
        console.log(`Start ${Date.now()}`)
        let classItems = this.projController.getClassData().then(d => {
            console.log(`class ${Date.now()}`)
            return d.filter(i => i.name.toLocaleLowerCase().includes(word) && !i.name.includes('$')).map(i => new vscode.CompletionItem(i.name, vscode.CompletionItemKind.Class))}
        )
        let jarItems = this.projController.getJarEntryNodes().then(d => {
            console.log(`jar ${Date.now()}`)
            return d.filter(i => i.name.toLocaleLowerCase().includes(word) && !i.name.includes('$')).map(i => new vscode.CompletionItem(i.name, vscode.CompletionItemKind.Class))}
        )
        return Promise.all([classItems, jarItems]).then(data => {
            console.log(`all ${Date.now()}`)
            return data[0].concat(data[1])
        })
    }
        
    resolveCompletionItem?(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        throw new Error("Method not implemented.");
    }

}