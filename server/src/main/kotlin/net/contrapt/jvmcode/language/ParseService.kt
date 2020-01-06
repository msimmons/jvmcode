package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseRequest
import net.contrapt.jvmcode.model.ParseResult
import net.contrapt.jvmcode.model.ParseSymbol
import net.contrapt.jvmcode.model.ParseSymbolType
import net.contrapt.jvmcode.service.SymbolRepository
import java.io.File

class ParseService(val symbolRepository: SymbolRepository) {

    private val parser = JavaParser()

    fun parse(request: ParseRequest) : ParseResult {
        val cached = symbolRepository.getJarEntryByFile(request.file)
        val parseResult = cached?.parseData
        if (parseResult != null) return parseResult
        if (request.text == null) {
            request.text = File(request.file).readText()
        }
        val result = parser.parse(request)
        resolveSymbols(result)
        return result
    }

    fun resolveSymbols(result: ParseResult) {
        val pkgName = result.pkg.name
        val importMap = result.imports.associate { it.name.substringAfterLast(".") to it.name }
        result.symbols.forEach {
            when (it.symbolType) {
                ParseSymbolType.TYPEREF -> it.type = typeRefName(it, importMap[it.type])
                ParseSymbolType.FIELD -> it.type = typeRefName(it,importMap[it.type])
                ParseSymbolType.VARIABLE ->  it.type = typeRefName(it, importMap[it.type])
                ParseSymbolType.METHOD -> it.type = importMap[it.type] ?: it.type
                ParseSymbolType.TYPEDEF -> it.type = "$pkgName.${typeDefName(it, result.symbols)}"
                ParseSymbolType.CONSTRUCTOR -> it.type = "$pkgName.${constructorType(it, result.symbols)}"
                else -> {}
            }
        }
    }

    private fun typeRefName(symbol: ParseSymbol, imported: String?) : String? {
        if ( imported != null ) return imported;
        val names = symbolRepository.getJarEntriesByName(symbol.type ?: "")
        if (!names.isEmpty()) return names[0].fqcn()
        else return symbol.type
    }

    private fun constructorType(symbol: ParseSymbol, symbols: List<ParseSymbol>) : String {
        val type = symbols[symbol.scope]
        return typeDefName(type, symbols)
    }

    private fun typeDefName(symbol: ParseSymbol, symbols: List<ParseSymbol>) : String {
        if (symbol.scope == -1) return symbol.name
        else return "${typeDefName(symbols[symbol.scope], symbols)}.${symbol.name}"
    }

}