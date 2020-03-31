import * as vscode from 'vscode'
import { ProviderResult } from 'vscode';
import { ParseSymbol, ParseSymbolType } from '../language_model'
import { LanguageController } from '../language_controller';

/**
 * Requires Symbols and workspace Symbols
 */
export class JvmSymbolProvider implements vscode.DocumentSymbolProvider, vscode.WorkspaceSymbolProvider {

    controller: LanguageController
    
    constructor(languageController: LanguageController) {
        this.controller = languageController
    }

    provideWorkspaceSymbols(query: string, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation[]> {
        console.log(`WSSym: ${query}`)
        return undefined
    }

    resolveWorkspaceSymbol?(symbol: vscode.SymbolInformation, token: vscode.CancellationToken): vscode.ProviderResult<vscode.SymbolInformation> {
        throw new Error("Method not implemented.");
    }

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        return new Promise(async (resolve, reject) => {
            let result = await this.controller.getParseResult(document)
            if (!result) {
                resolve(undefined)
                return
            }
            let info = result.symbols.filter(s => s.parent == -1 && ![ParseSymbolType.IMPORT, ParseSymbolType.PACKAGE].includes(s.symbolType)).map(s =>{
                let docSymbol = this.createDocSymbol(document, s)
                if (s.children) docSymbol.children = this.symbolTree(document, s, result.symbols)
                return docSymbol
            })
            resolve(info)
        })
    }

    private symbolTree(document: vscode.TextDocument, symbol: ParseSymbol, symbols: ParseSymbol[]) : vscode.DocumentSymbol[] {
        return symbol.children.filter(s => ![ParseSymbolType.TYPEREF, ParseSymbolType.LITERAL, ParseSymbolType.SYMREF].includes(symbols[s].symbolType)).map(s =>{
            let docSymbol = this.createDocSymbol(document, symbols[s])
            if (symbols[s].children) docSymbol.children = this.symbolTree(document, symbols[s], symbols)
            return docSymbol
        })
    }

    private createDocSymbol(document: vscode.TextDocument, symbol: ParseSymbol) : vscode.DocumentSymbol {
        let kind = this.getSymbolKind(symbol)
        let start = document.positionAt(symbol.location.start)
        let end = document.positionAt(symbol.location.end)
        let scopeEnd = symbol.scopeEnd ? document.positionAt(symbol.scopeEnd.end) : end
        let fullRange = new vscode.Range(start, scopeEnd)
        let selectionRange = end.compareTo(scopeEnd) <= 0 ? new vscode.Range(start, end) : fullRange
        let arrayDim = "[]".repeat(symbol.arrayDim)
        let tag = this.getSymbolTag(symbol)
        return new vscode.DocumentSymbol(`${symbol.name}${tag} ${symbol.classifier}`, `${symbol.type}${arrayDim}`, kind, fullRange, selectionRange)
    }

    private getSymbolTag(symbol: ParseSymbol): string {
        switch(symbol.symbolType) {
            case ParseSymbolType.CONSTRUCTOR: 
            case ParseSymbolType.METHOD: 
                return "()"
            default: return ""
        }
    }

    private getSymbolKind(symbol: ParseSymbol) : vscode.SymbolKind {
        switch(symbol.symbolType) {
            case ParseSymbolType.CLASS: return vscode.SymbolKind.Class
            case ParseSymbolType.INTERFACE: return vscode.SymbolKind.Interface
            case ParseSymbolType.ENUM: return vscode.SymbolKind.Enum
            case ParseSymbolType.ANNOTATION: return vscode.SymbolKind.Class
            case ParseSymbolType.CONSTRUCTOR: return vscode.SymbolKind.Constructor
            case ParseSymbolType.METHOD: return vscode.SymbolKind.Method
            case ParseSymbolType.FIELD: return vscode.SymbolKind.Field
            case ParseSymbolType.THIS: return vscode.SymbolKind.Field
            case ParseSymbolType.VARIABLE: return vscode.SymbolKind.Variable
            case ParseSymbolType.BLOCK: return vscode.SymbolKind.Namespace
            case ParseSymbolType.CONTROL: return vscode.SymbolKind.Namespace
            case ParseSymbolType.TYPEREF: return vscode.SymbolKind.Constant
            case ParseSymbolType.TYPEPARAM: return vscode.SymbolKind.TypeParameter
            default: return vscode.SymbolKind.Object
        }
    }
}