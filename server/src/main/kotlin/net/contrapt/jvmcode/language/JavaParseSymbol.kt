package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseLocation
import net.contrapt.jvmcode.model.ParseSymbol

data class JavaParseSymbol(
        override val name: String,
        override val type: String,
        override val location: ParseLocation,
        override val fqcn: String?
) : ParseSymbol {
    override var isWild = false
    override var isStatic = false
}
