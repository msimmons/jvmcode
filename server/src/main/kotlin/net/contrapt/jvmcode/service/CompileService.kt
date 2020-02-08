package net.contrapt.jvmcode.service

import net.contrapt.jvmcode.model.*
import java.lang.IllegalStateException

class CompileService(val symbolRepository: SymbolRepository) {

    fun compile(request: CompileRequest, compiler: LanguageCompiler?) : CompileResult {
        if (compiler == null) throw IllegalStateException("No compiler found for ${request.languageId}")
        // Find dependents to compile as well
        val result = compiler.compile(request)
        return result
    }
}