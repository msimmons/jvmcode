package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseLocation
import net.contrapt.jvmcode.model.ParseSymbol
import net.contrapt.jvmcode.model.ParseSymbolType

data class JavaParseSymbol(
    override val id: Int,
    override val name: String,
    override val location: ParseLocation
) : ParseSymbol {
    override var type : String? = null
    override var scope : Int = -1
    override var symbolType : ParseSymbolType = ParseSymbolType.SYMREF
    override val children = mutableListOf<ParseSymbol>()
    override var scopeEnd: ParseLocation = location
    override var isWild = false
    override var isStatic = false

    override fun toString(): String {
        return "[$scope:$id] $name:$type $symbolType"
    }
}
