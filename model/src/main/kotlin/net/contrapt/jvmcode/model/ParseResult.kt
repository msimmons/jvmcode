package net.contrapt.jvmcode.model

interface ParseResult {
    val languageId: String
    val name: String
    val file: String
    val pkg: ParseSymbol
    val imports: Collection<ParseSymbol>
    val scopes: Collection<ParseScope>
    val symbols: Collection<ParseSymbol>
}
