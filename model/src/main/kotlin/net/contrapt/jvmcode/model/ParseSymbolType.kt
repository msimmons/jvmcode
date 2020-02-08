package net.contrapt.jvmcode.model

enum class ParseSymbolType(val isDef: Boolean = false, val isMember: Boolean = false) {
    BLOCK,
    PACKAGE,
    IMPORT,
    CONTROL,
    CLASS(true),
    INTERFACE(true),
    ANNOTATION(true),
    ENUM(true),
    OBJECT(true),
    CONSTRUCTOR(true),
    METHOD(true, true),
    FIELD(true, true),
    VARIABLE(true),
    TYPEREF, // Type reference
    SYMREF, // Variable reference
    TYPEPARAM, // A generic type parameter <K,V>
    THIS, // special field for this
    LITERAL // A literal value
}