package net.contrapt.jvmcode.model

interface ParseSymbol {
    val id: Int
    val name: String
    val symbolType: ParseSymbolType
    val location: ParseLocation
    val scopeEnd: ParseLocation
    val type: String?
    val scope: Int
    val children: Collection<ParseSymbol>

    var isWild: Boolean
    var isStatic: Boolean
}