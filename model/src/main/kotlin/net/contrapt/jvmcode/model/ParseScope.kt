package net.contrapt.jvmcode.model

interface ParseScope {
    val id: Int
    val type: ParseScopeType
    val location: ParseLocation
    val parent: Int?
}