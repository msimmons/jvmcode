package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseRequest
import net.contrapt.jvmcode.model.ParseResult
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
                ParseSymbolType.TYPEREF -> it.type = importMap[it.type] ?: it.type
                ParseSymbolType.FIELD -> it.type = importMap[it.type] ?: it.type
                ParseSymbolType.VARIABLE ->  it.type = importMap[it.type] ?: it.type
                ParseSymbolType.METHOD -> it.type = importMap[it.type] ?: it.type
                ParseSymbolType.TYPEDEF -> it.type = "$pkgName.${it.name}"
                ParseSymbolType.CONSTRUCTOR -> it.type = "$pkgName.${it.name}"
                else -> {}
            }
        }
    }
}