package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.*
import net.contrapt.jvmcode.service.model.JVMCompileRequest
import java.lang.IllegalStateException

class CompileService(val symbolRepository: SymbolRepository) {

    val logger = LoggerFactory.getLogger(javaClass)

    fun compile(request: JVMCompileRequest, compiler: LanguageCompiler?) : CompileResult {
        if (compiler == null) throw IllegalStateException("No compiler found for ${request.languageId}")
        // Find dependents to compile as well
        val dependents = symbolRepository.findDependentsBySource(request.files.first())
        logger.info(dependents)
        val fullRequest = request.copy(files = request.files + dependents)
        val result = compiler.compile(fullRequest)
        return result
    }
}