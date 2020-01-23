package net.contrapt.jvmcode.model

interface ParseSymbol {
    val id: Int
    val name: String
    val classifier: String
    val symbolType: ParseSymbolType
    var location: ParseLocation
    val scopeEnd: ParseLocation
    var type: String?
    val parent: Int
    val children: MutableList<Int>

    var isWild: Boolean
    var isStatic: Boolean
    var arrayDim: Int
    var symbolDef: Int?
    var caller: Int?
}