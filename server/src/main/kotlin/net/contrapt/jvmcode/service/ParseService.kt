package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.*
import java.io.File
import java.lang.IllegalStateException

class ParseService(val symbolRepository: SymbolRepository) {

    private val logger = LoggerFactory.getLogger(javaClass)

    fun parse(request: ParseRequest, parser: LanguageParser?) : ParseResult {
         val cached = symbolRepository.getJarEntryByFile(request.file)
        val parseResult = cached?.parseData
        if (parseResult != null) return parseResult
        if ( parser == null ) throw IllegalStateException("No parser found for ${request.languageId}")
        if (request.text.isNullOrEmpty()) {
            request.text = cached?.text ?: File(request.file).readText()
        }
        if (request.stripCR) request.text = request.text?.replace("\r", "")
        val result = parser.parse(request)
        resolveSymbols(result)
        return result
    }

    fun resolveSymbols(result: ParseResult) {
        val pkgName = result.pkg?.name ?: ""
        val importMap = result.imports.associate { it.name.substringAfterLast(".") to it.name }
        result.symbols.forEach {
            when (it.symbolType) {
                ParseSymbolType.TYPEREF -> it.type = typeRefName(it, importMap, pkgName)
                ParseSymbolType.FIELD -> it.type = typeRefName(it,importMap, pkgName)
                ParseSymbolType.VARIABLE ->  it.type = typeRefName(it, importMap, pkgName)
                ParseSymbolType.METHOD -> it.type = typeRefName(it, importMap, pkgName)
                ParseSymbolType.TYPEDEF -> it.type = "$pkgName.${typeDefName(it, result.symbols)}"
                ParseSymbolType.CONSTRUCTOR -> it.type = "$pkgName.${constructorType(it, result.symbols)}"
                else -> {}
            }
        }
    }

    private fun typeRefName(symbol: ParseSymbol, importMap: Map<String, String>, pkg: String) : String? {
        // If it is imported, use that
        val imported = importMap[symbol.type]
        if ( imported != null) return imported;
        // Otherwise, look for all the unqualified names that match
        val names = symbolRepository.getJarEntriesByName(symbol.type ?: "")
        val autoType = if (names.size == 1) names[0] else null // Is it auto-imported?
        val wildTypes = names.filter { importMap.values.contains("${it.pkg}.*") }
        val packageType = names.firstOrNull { it.pkg == pkg } // Is it in the same package?
        return when {
            autoType != null -> autoType.fqcn()
            wildTypes.isNotEmpty() -> wildTypes.first().fqcn()
            packageType != null -> packageType.fqcn()
            else -> symbol.type
        }
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