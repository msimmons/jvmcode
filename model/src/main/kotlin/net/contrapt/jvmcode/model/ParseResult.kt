package net.contrapt.jvmcode.model

interface ParseResult {
    val languageId: String
    val name: String
    val file: String
    val pkg: ParseSymbol?
    val imports: MutableList<out ParseSymbol>
    val symbols: MutableList<out ParseSymbol>
}
