package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseLocation

data class JavaParseLocation(
        override val start: Int,
        override val end: Int
) : ParseLocation
