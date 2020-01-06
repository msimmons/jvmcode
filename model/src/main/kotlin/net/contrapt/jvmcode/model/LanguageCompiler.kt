package net.contrapt.jvmcode.model

interface LanguageCompiler {
    fun compile(request: CompileRequest) : CompileResult

    companion object {
        val MAP_NAME = "compilers"
    }
}