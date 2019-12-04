package net.contrapt.jvmcode.model

interface ParseScope {
    val location: ParseLocation
    val symbols: Collection<ParseSymbol>
    val scopes: Collection<ParseScope>
}