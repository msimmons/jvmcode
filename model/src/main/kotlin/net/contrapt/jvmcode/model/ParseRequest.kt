package net.contrapt.jvmcode.model

interface ParseRequest {
    val languageId: String
    val file: String
    var text: String?
}
