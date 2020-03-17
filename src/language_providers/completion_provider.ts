import * as vscode from 'vscode'
import { LanguageController } from '../language_controller';
import { ProjectController } from '../project_controller';
import { ParseResult, LanguageRequest } from 'server-models';

/**
 * Requires Symbols
 */
export class JvmCompletionProvider implements vscode.CompletionItemProvider {

    private request: LanguageRequest
    private langController: LanguageController
    private projController: ProjectController
    private incompleteCount = 0
    private symbolItems: Promise<vscode.CompletionItem[]> = Promise.resolve([])
    private classItems: Promise<vscode.CompletionItem[]> = Promise.resolve([])
    private jarItems: Promise<vscode.CompletionItem[]> = Promise.resolve([])

    constructor(request: LanguageRequest, langController: LanguageController, projController: ProjectController) {
        this.request = request
        this.langController = langController
        this.projController = projController
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        switch (context.triggerKind) {
            case vscode.CompletionTriggerKind.Invoke: return this.completeForInvoke(document, position, token, context)
            case vscode.CompletionTriggerKind.TriggerCharacter: return this.completeForTrigger(document, position, token, context)
            case vscode.CompletionTriggerKind.TriggerForIncompleteCompletions: return this.completeForIncomplete(document, position, token, context)
        }
    }

    private getImportEdits(doc: vscode.TextDocument, pos: vscode.Position, fqcn: string, pkg: string, pr: ParseResult) : vscode.TextEdit[] {
        let allImports = this.request.imports.concat(pr.imports.map(i => i.name))
        let exists = allImports.find(i => i === fqcn || i === `${pkg}.*`) || pkg === pr.pkg.name
        if (exists) return []
        let beforeLine = undefined
        if (pr.imports.length > 0) {
            let imp = pr.imports.find(i => fqcn < i.name)
            if (imp) {
                beforeLine = doc.positionAt(imp.location.start).line
            }
            if (!beforeLine) {
                beforeLine = doc.positionAt(pr.imports[pr.imports.length-1].location.start).line+1
            }
        }
        else {
            let sym = pr.symbols.find(s => s.symbolType != "PACKAGE")
            if (sym) {
                beforeLine = doc.positionAt(sym.location.start).line
            }
        }
        let position = (beforeLine) ? new vscode.Position(beforeLine, 0) : new vscode.Position(pos.line, 0)
        let range = new vscode.Range(position, position)
        return [new vscode.TextEdit(range, `import ${fqcn}\n`)]
    }
        
    resolveCompletionItem?(item: vscode.CompletionItem, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CompletionItem> {
        throw new Error("Method not implemented.");
    }

    private getSymbolItems(document: vscode.TextDocument, position: vscode.Position, parseResult: Promise<ParseResult>) : Promise<vscode.CompletionItem[]> {
        let range = document.getWordRangeAtPosition(position)
        let wordStart = document.offsetAt(range.start)
        let wordEnd = document.offsetAt(range.end)
        return parseResult.then(pr => {
            let symbol = pr.symbols.find(s => s.location.start >= wordStart && s.location.end <= wordEnd)
            let inScope = pr.symbols.filter(s => s.parent <= symbol.parent && !["IMPORT","PACKAGE","SYMREF"].includes(s.symbolType))
            let items = []
            inScope.map(s => {
                let item = new vscode.CompletionItem(s.name, vscode.CompletionItemKind.Field)
                item.detail = `${s.symbolType} ${s.type}`
                item.sortText = `0:${s.name}`
                items.push(item)
            })
            return items
        })
    }

    private completeForInvoke(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[] | vscode.CompletionList> {
        let range = document.getWordRangeAtPosition(position)
        let word = document.getText(range).toLocaleLowerCase()
        this.incompleteCount = 0
        let parseResult = this.langController.getParseResult(document)
        let classResult = this.projController.getClassData()
        let jarResult = this.projController.getJarEntryNodes()
        this.symbolItems = this.getSymbolItems(document, position, parseResult)
        parseResult.then(parsed =>{
            this.classItems = classResult.then(items => {
                return items.filter(i => i.name.toLocaleLowerCase().startsWith(word) && !i.name.includes('$')).map(i => {
                    let ndx = i.name.lastIndexOf('.')
                    let name = i.name.substr(ndx + 1)
                    let pkg = i.name.substr(0, ndx)
                    let item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class)
                    item.detail = pkg
                    item.sortText = `1:${name}`
                    item.additionalTextEdits = this.getImportEdits(document, position, `${pkg}.${name}`, pkg, parsed)
                    return item
                })
            })
            this.jarItems = Promise.all([jarResult, parseResult]).then(data => {
                let items = data[0]
                let parsed = data[1]
                return items.filter(i => i.data.type === "CLASS" && i.name.toLocaleLowerCase().startsWith(word) && !i.name.includes('$')).map(i => {
                    let name = i.name
                    let pkg = i.package.name
                    let item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class)
                    item.detail = pkg
                    // Sorted by auto imports, imports then others
                    let sort = (parsed.imports.includes[`${pkg}.${name}`]) ? '8' : (this.request.imports.includes[pkg]) ? '7': '9'
                    item.sortText = `${sort}:${name}:${pkg}`
                    item.additionalTextEdits = this.getImportEdits(document, position, `${pkg}.${name}`, pkg, parsed)
                    return item
                })
            })
        })
        return this.symbolItems.then(data => new vscode.CompletionList(data, true))
    }

    private completeForIncomplete(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionList> {
        this.incompleteCount++
        if (this.incompleteCount == 1) {
            return Promise.all([this.symbolItems, this.classItems]).then(all => {
                let items = all[0].concat(all[1])
                return new vscode.CompletionList(items, true)
            })
        }
        else {
            return Promise.all([this.symbolItems, this.classItems, this.jarItems]).then(
                all => {
                    let items = all[0].concat(all[1]).concat(all[2])
                    return new vscode.CompletionList(items, false)
                })
        }
    }

    private completeForTrigger(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext): vscode.ProviderResult<vscode.CompletionItem[]> {
        console.log(`Triggered by ${context.triggerCharacter}`)
        return []
    }

}