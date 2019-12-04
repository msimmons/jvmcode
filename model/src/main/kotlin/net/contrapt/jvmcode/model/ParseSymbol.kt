package net.contrapt.jvmcode.model

interface ParseSymbol {
    val name: String
    val type: String
    val location: ParseLocation
    val fqcn: String?

    var isWild: Boolean
    var isStatic: Boolean
}