package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.LanguageRequest

data class JavaLanguageRequest(
        override val name: String = "vsc-java",
        override val languageId: String = "java",
        override val extensions: Collection<String> = setOf("java")

) : LanguageRequest
