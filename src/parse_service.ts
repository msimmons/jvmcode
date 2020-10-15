import { ParseRequest, ParseResult, LanguageRequest, ParseSymbolType, ParseSymbol } from "./language_model";
import { ProjectRepository } from "./project_repository";

export class ParseService {

    private repository: ProjectRepository

    constructor(repository: ProjectRepository) {
        this.repository = repository
    }

    public async parse(request: ParseRequest, language: LanguageRequest) : Promise<ParseResult> {
        let result = await language.parse(request)
        this.resolveSymbols(result, language)
        return result
    }

    /**
     * Resolve symbol types as much as possible
     * @param result 
     * @param language 
     */
    public resolveSymbols(result: ParseResult, language: LanguageRequest) {
        let pkgName = result.pkg ? result.pkg.name ? result.pkg.name : "" : ""
        let importMap = new Map<string, string>()
        language.imports.concat(result.imports.map(i=>i.name)).forEach(imp => {
            let key = imp.split('.').slice(-1)[0]
            key = key === '*' ? imp : key
            importMap.set(key, imp)
        })
        importMap.set(pkgName, pkgName)
        result.symbols.forEach(sym => {
            switch(sym.symbolType) {
                case ParseSymbolType.TYPEREF:
                case ParseSymbolType.FIELD:
                case ParseSymbolType.VARIABLE:
                case ParseSymbolType.METHOD: sym.type = this.typeRefName(sym, importMap, pkgName); break;
                case ParseSymbolType.CLASS:
                case ParseSymbolType.INTERFACE:
                case ParseSymbolType.ENUM:
                case ParseSymbolType.THIS:
                case ParseSymbolType.OBJECT: sym.type = `${pkgName}.${this.typeDefName(sym, result.symbols)}`; break;
                case ParseSymbolType.CONSTRUCTOR: sym.type = `${pkgName}.${this.constructorType(sym, result.symbols)}`; break;
                default: {}
            }
        })
        result.symbols.forEach(sym =>{
            if (sym.symbolType === ParseSymbolType.SYMREF) {
                this.resolveSymRef(sym, result.symbols)
            }
            if (sym.symbolDef == null) sym.type = this.typeRefName(sym, importMap, pkgName)
        })
    }

    private typeRefName(sym: ParseSymbol, importMap: Map<string, string>, pkg: string) : string {
        // If it is imported, use that
        let imported = importMap.get(sym.type)
        if (imported) return imported;
        let imports = Array.from(importMap.values())
        // Look for a local class in same package
        let classes = this.repository.findClassDataByName(sym.type ? sym.type : '')
        let localClass = classes.find(c => c.pkg === pkg)
        if (localClass) return localClass.fqcn
        // Otherwise, look for all the unqualified names that match
        let entries = this.repository.findJarEntriesByName(sym.type ? sym.type : '')
        // Is it auto imported?
        let autoType = entries.find(entry => imports.includes(entry.pkg))
        if (autoType) return autoType.fqcn
        // Is it wildcard imported?
        let wildType = entries.find(entry => imports.includes(`${entry.pkg}.*`))
        if (wildType) return wildType.fqcn
        // Is it in the same package (but from a jar)
        let packageType = entries.find(entry => entry.pkg === pkg)
        if (packageType) return packageType.fqcn
        // Otherwise, leave as is
        return sym.type
    }

    private typeDefName(sym: ParseSymbol, symbols: ParseSymbol[]) : string {
        if (sym.parent == -1) return sym.name
        else {
            let parentName = this.typeDefName(symbols[sym.parent], symbols)
            return `"${parentName}.${sym.name}`
        }
    }

    private constructorType(sym: ParseSymbol, symbols: ParseSymbol[]) : string {
        let type = (sym.parent > -1) ? symbols[sym.parent] : sym
        return this.typeDefName(type, symbols)
    }

    private resolveSymRef(sym: ParseSymbol, symbols: ParseSymbol[]) {
        let caller = (sym.caller) ? symbols[sym.caller] : undefined
        sym.symbolDef = caller ? (caller.name === 'this' ? this.findSymbolDef(sym, sym.parent, symbols, true) : undefined) : this.findSymbolDef(sym, sym.parent, symbols)
        sym.type = sym.symbolDef ? symbols[sym.symbolDef].type : undefined
    }

    private findSymbolDef(sym: ParseSymbol, parent: number, symbols: ParseSymbol[], isThis?: boolean) : number {
        if (parent == -1) return undefined
        if (parent == sym.id) return undefined
        let def = symbols[parent].children.reverse().find(id => {
            let child = symbols[id]
            return child.name == sym.name &&
                ((isThis && this.isMember(sym.symbolType)) || (!isThis && this.isDef(child.symbolType)))
        })
        if (!def) return this.findSymbolDef(sym, symbols[parent].parent, symbols)
        else return def
    }

    private isMember(type: ParseSymbolType) : boolean {
        return [
            ParseSymbolType.INTERFACE,
            ParseSymbolType.ANNOTATION,
            ParseSymbolType.ENUM,
            ParseSymbolType.OBJECT,
            ParseSymbolType.CONSTRUCTOR,
            ParseSymbolType.METHOD,
            ParseSymbolType.FIELD,
            ParseSymbolType.VARIABLE
        ].includes(type)
    }

    private isDef(type: ParseSymbolType) : boolean {
        return [ParseSymbolType.METHOD, ParseSymbolType.FIELD, ParseSymbolType.VARIABLE].includes(type)
    }
}