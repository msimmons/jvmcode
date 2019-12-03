package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseResult

data class JavaParseResult(
        override val languageId: String = "java",
        override val name: String = "vsc-java",
        override val file: String,
        override val symbols: String
) : ParseResult
