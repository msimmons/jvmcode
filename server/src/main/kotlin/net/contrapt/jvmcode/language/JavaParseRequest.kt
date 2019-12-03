package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseRequest

data class JavaParseRequest(
        override val languageId: String,
        override val file: String
) : ParseRequest
