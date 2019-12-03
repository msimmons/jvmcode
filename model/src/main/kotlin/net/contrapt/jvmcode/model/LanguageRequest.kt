package net.contrapt.jvmcode.model

interface LanguageRequest {
    val name: String
    val languageId: String
    val extensions: Collection<String>
}
