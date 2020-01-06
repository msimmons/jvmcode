package net.contrapt.jvmcode.model

interface LanguageParser {
    fun parse(request: ParseRequest): ParseResult

    companion object {
        val MAP_NAME = "parsers"
    }
}