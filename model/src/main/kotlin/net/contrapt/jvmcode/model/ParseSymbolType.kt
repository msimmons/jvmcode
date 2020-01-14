package net.contrapt.jvmcode.model

enum class ParseSymbolType(val isDef: Boolean = false, val isMember: Boolean = false) {
    BLOCK,
    PACKAGE,
    IMPORT,
    CONTROL,
    CLASS(true),
    INTERFACE(true),
    ENUM(true),
    OBJECT(true),
    CONSTRUCTOR(true),
    METHOD(true, true),
    FIELD(true, true),
    VARIABLE(true),
    TYPEREF, // Type reference
    SYMREF, // Variable reference
    LITERAL // A literal value
}