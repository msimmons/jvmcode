package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseLocation
import net.contrapt.jvmcode.model.ParseSymbol
import net.contrapt.jvmcode.model.ParseSymbolType

data class JavaParseSymbol(
    override val id: Int,
    override val name: String,
    override var classifier: String,
    override var location: ParseLocation
) : ParseSymbol {
    override var type : String? = null
    override var parent : Int = -1
    override var symbolType : ParseSymbolType = ParseSymbolType.SYMREF
    override val children = mutableListOf<Int>()
    override var scopeEnd: ParseLocation = location
    override var isWild = false
    override var isStatic = false
    override var arrayDim = 0
    override var symbolDef: Int? = null
    override var caller: Int? = null

    override fun toString(): String {
        return "[$parent:$id] $name:$type $symbolType"
    }

}
