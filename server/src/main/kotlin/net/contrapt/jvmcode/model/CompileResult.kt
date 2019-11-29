package net.contrapt.jvmcode.model

data class CompileResult(
        val diagnostics: MutableList<Diagnostic> = mutableListOf()
)
