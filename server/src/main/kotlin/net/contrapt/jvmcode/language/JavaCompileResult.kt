package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.CompileResult

data class JavaCompileResult(
        override val languageId: String = "java",
        override val name: String = "vsc-java",
        override val diagnostics: MutableList<JavaDiagnostic> = mutableListOf()
) : CompileResult
