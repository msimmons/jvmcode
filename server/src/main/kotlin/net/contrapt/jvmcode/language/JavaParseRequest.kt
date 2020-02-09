package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseRequest

data class JavaParseRequest(
        override val languageId: String = "java",
        override val file: String,
        override var text: String?,
        override val stripCR: Boolean = true
) : ParseRequest
