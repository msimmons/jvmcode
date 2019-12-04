package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseResult
import net.contrapt.jvmcode.model.ParseScope
import net.contrapt.jvmcode.model.ParseSymbol

data class JavaParseResult(
        override val languageId: String = "java",
        override val name: String = "vsc-java",
        override val file: String
) : ParseResult {
    override lateinit var  pkg: ParseSymbol
    override val imports: Collection<ParseSymbol> = mutableListOf()
    override val scopes: Collection<ParseScope> = mutableListOf()
}
