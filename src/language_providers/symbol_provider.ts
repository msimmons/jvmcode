import * as vscode from 'vscode'
import { ProviderResult } from 'vscode';
import { ParseSymbol } from 'server-models'
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
            let info = result.symbols.filter(s => s.parent == -1 && !["IMPORT", "PACKAGE"].includes(s.symbolType)).map(s =>{
                let docSymbol = this.createDocSymbol(document, s)
                if (s.children) docSymbol.children = this.symbolTree(document, s, result.symbols)
                return docSymbol
            })
            resolve(info)
        })
    }

    private symbolTree(document: vscode.TextDocument, symbol: ParseSymbol, symbols: ParseSymbol[]) : vscode.DocumentSymbol[] {
        return symbol.children.filter(s => !["TYPEREF","LITERAL","SYMREF"].includes(symbols[s].symbolType)).map(s =>{
            let docSymbol = this.createDocSymbol(document, symbols[s])
            if (symbols[s].children) docSymbol.children = this.symbolTree(document, symbols[s], symbols)
            return docSymbol
        })
    }

    private createDocSymbol(document: vscode.TextDocument, symbol: ParseSymbol) : vscode.DocumentSymbol {
        let kind = this.getSymbolKind(symbol)
        let start = document.positionAt(symbol.location.start)
        let end = document.positionAt(symbol.location.end)
        let scopeEnd = document.positionAt(symbol.scopeEnd.end)
        let fullRange = new vscode.Range(start, scopeEnd)
        let selectionRange = new vscode.Range(start, end)
        let arrayDim = "[]".repeat(symbol.arrayDim)
        let tag = this.getSymbolTag(symbol)
        return new vscode.DocumentSymbol(`${symbol.name}${tag} ${symbol.classifier}`, `${symbol.type}${arrayDim}`, kind, fullRange, selectionRange)
    }

    private getSymbolTag(symbol: ParseSymbol): string {
        switch(symbol.symbolType) {
            case "CONSTRUCTOR": 
            case "METHOD": 
                return "()"
            default: return ""
        }
    }

    private getSymbolKind(symbol: ParseSymbol) : vscode.SymbolKind {
        switch(symbol.symbolType) {
            case "CLASS": return vscode.SymbolKind.Class
            case "INTERFACE": return vscode.SymbolKind.Interface
            case "ENUM": return vscode.SymbolKind.Enum
            case "ANNOTATION": return vscode.SymbolKind.Class
            case "CONSTRUCTOR": return vscode.SymbolKind.Constructor
            case "METHOD": return vscode.SymbolKind.Method
            case "FIELD": return vscode.SymbolKind.Field
            case "THIS": return vscode.SymbolKind.Field
            case "VARIABLE": return vscode.SymbolKind.Variable
            case "BLOCK": return vscode.SymbolKind.Namespace
            case "CONTROL": return vscode.SymbolKind.Namespace
            case "TYPEREF": return vscode.SymbolKind.Constant
            case "TYPEPARAM": return vscode.SymbolKind.TypeParameter
            default: return vscode.SymbolKind.Object
        }
    }
}