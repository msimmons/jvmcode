import * as vscode from 'vscode'
import { ParseSymbol, ParseResult } from 'server-models'
import { LanguageController } from '../language_controller'

/**
 * Requires Symbols
 */
export class JvmDefinitionProvider implements vscode.DefinitionProvider {

    private languageController: LanguageController

    constructor(languageController: LanguageController) {
        this.languageController = languageController
    }

    provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.ProviderResult<vscode.Location | vscode.Location[] | vscode.LocationLink[]> {
        return new Promise(async (resolve, reject) => {
            let result = await this.languageController.getParseResult(document)
            if (!result) {
                resolve(undefined)
                return
            }
            let offset = document.offsetAt(position)
            let symbol = result.symbols.find(s => { return s.location.start <= offset && s.location.end >= offset})
            console.log(symbol)
            let location = this.findLocation(document, offset, symbol, result)
            resolve(location)
        })
    }
    
    private findLocation(document: vscode.TextDocument, offset: number, symbol: ParseSymbol, result: ParseResult) : vscode.Location {
        if (!symbol) return undefined
        switch (symbol.symbolType) {
            case "FIELD":
            case "METHOD":
                return this.selfLocation(document, symbol)
            case "SYMREF": 
                return this.defLocation(document, offset, symbol, result)
            default: undefined
        }
    }

    private selfLocation(document: vscode.TextDocument, symbol: ParseSymbol) : vscode.Location {
        let uri = document.uri
        let start = document.positionAt(symbol.location.start)
        let end = document.positionAt(symbol.location.end)
        let range = new vscode.Range(start, end)
        return new vscode.Location(uri, range)
    }

    private defLocation(document: vscode.TextDocument, offset: number, symbol: ParseSymbol, result: ParseResult) : vscode.Location {
        if (symbol.symbolDef) {
            let def = result.symbols[symbol.symbolDef]
            let uri = document.uri
            let start = document.positionAt(def.location.start)
            let end = document.positionAt(def.location.end)
            let range = new vscode.Range(start, end)
            return new vscode.Location(uri, range)

        }
        return undefined
    }

}