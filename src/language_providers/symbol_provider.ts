import * as vscode from 'vscode'
import { languageController } from '../extension';
import { ProviderResult } from 'vscode';
import { ParseSymbol } from 'server-models'

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

    provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): ProviderResult<vscode.SymbolInformation[] | vscode.DocumentSymbol[]> {
        return new Promise(async (resolve, reject) => {
            let result = await languageController.getParseResult(document)
            if (!result) {
                resolve(undefined)
                return
            }
            let info = result.symbols.filter(s => s.scope == -1).map(s =>{
                let docSymbol = this.createDocSymbol(document, s)
                if (s.children) docSymbol.children = this.symbolTree(document, s)
                return docSymbol
            })
            resolve(info)
        })
    }

    private symbolTree(document: vscode.TextDocument, symbol: ParseSymbol) : vscode.DocumentSymbol[] {
        return symbol.children.filter(s => !["TYPEREF","LITERAL","SYMREF"].includes(s.symbolType)).map(s =>{
            let docSymbol = this.createDocSymbol(document, s)
            if (s.children) docSymbol.children = this.symbolTree(document, s)
            return docSymbol
        })
    }

    private createDocSymbol(document: vscode.TextDocument, symbol: ParseSymbol) : vscode.DocumentSymbol {
        let kind = vscode.SymbolKind.Field
        switch(symbol.symbolType) {
            case "PACKAGE": kind = vscode.SymbolKind.Namespace; break;
            case "IMPORT": kind = vscode.SymbolKind.Module; break;
            case "TYPEDEF": kind = vscode.SymbolKind.Class; break;
            case "CONSTRUCTOR": kind = vscode.SymbolKind.Constructor; break;
            case "METHOD": kind = vscode.SymbolKind.Method; break;
            case "FIELD": kind = vscode.SymbolKind.Field; break;
            case "BLOCK": kind = vscode.SymbolKind.Namespace; break;
            case "CONTROL": kind = vscode.SymbolKind.Namespace; break;
            case "TYPEREF": kind = vscode.SymbolKind.Class; break;
            default: kind = vscode.SymbolKind.Object
        }
        let start = document.positionAt(symbol.location.start)
        let end = document.positionAt(symbol.location.end)
        let scopeEnd = document.positionAt(symbol.scopeEnd.end)
        let fullRange = new vscode.Range(start, scopeEnd)
        let selectionRange = new vscode.Range(start, end)
        return new vscode.DocumentSymbol(symbol.name, symbol.type, kind, fullRange, selectionRange)
    }
}