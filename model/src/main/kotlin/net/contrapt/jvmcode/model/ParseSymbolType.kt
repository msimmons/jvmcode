package net.contrapt.jvmcode.model

enum class ParseSymbolType {
    BLOCK,
    PACKAGE,
    IMPORT,
    CONTROL,
    TYPEDEF, // Type declaration
    CONSTRUCTOR,
    METHOD,
    FIELD,
    VARIABLE,
    TYPEREF, // Type reference
    SYMDEF, // Variable definition
    SYMREF, // Variable reference
    LITERAL // A literal value
}