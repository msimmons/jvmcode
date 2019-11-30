package net.contrapt.jvmcode.model

data class JavaCompileResult(
        override val diagnostics: MutableList<JavaDiagnostic> = mutableListOf()
) : CompileResult
