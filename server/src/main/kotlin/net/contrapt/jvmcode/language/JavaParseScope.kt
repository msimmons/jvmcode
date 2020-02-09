package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseLocation
import net.contrapt.jvmcode.model.ParseScope
import net.contrapt.jvmcode.model.ParseScopeType

data class JavaParseScope(
        override val type: ParseScopeType,
        override var location: ParseLocation,
        override val parent: Int?
) : ParseScope {

    override val id: Int

    init {
        id = ++scopeId
    }

    companion object {
        private var scopeId = 0
    }
}
