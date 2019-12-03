package net.contrapt.jvmcode.model

interface ParseResult {
    val languageId: String
    val name: String
    val file: String
    val symbols: String
}
