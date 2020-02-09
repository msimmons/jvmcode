package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseResult
import net.contrapt.jvmcode.model.ParseSymbol

data class JavaParseResult(
        override val languageId: String = "java",
        override val name: String = "vsc-java",
        override val file: String
) : ParseResult {
    override var  pkg: JavaParseSymbol? = null
    override var imports: MutableList<JavaParseSymbol> = mutableListOf()
    override var symbols: MutableList<JavaParseSymbol> = mutableListOf()
    var parseTime = 0L
    val unmatched = mutableListOf<Pair<Int, Int>>()
}
