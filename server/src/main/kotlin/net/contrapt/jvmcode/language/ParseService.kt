package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseRequest
import net.contrapt.jvmcode.model.ParseResult
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
        return parser.parse(request)
    }
}