import * as vscode from 'vscode'
import { LanguageController } from '../language_controller'

/**
 * Requires Symbols
 */
export class JvmHoverProvider implements vscode.HoverProvider {

    private languageController: LanguageController

    constructor(languageController: LanguageController) {
        this.languageController = languageController
    }

    provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Hover> {
        return new Promise(async (resolve, reject) => {
            let result = await this.languageController.getParseResult(document)
            let offset = document.offsetAt(position)
            let symbol = result.symbols.find(s => { return s.location.start <= offset && s.location.end >= offset})
            if (symbol) {
                let start = document.positionAt(symbol.location.start)
                let end = document.positionAt(symbol.location.end)
                let range = new vscode.Range(start, end)
                let content = JSON.stringify(symbol)
                resolve(new vscode.Hover(content, range))
            }
            else {
                resolve(undefined)
            }
        })
    }

}