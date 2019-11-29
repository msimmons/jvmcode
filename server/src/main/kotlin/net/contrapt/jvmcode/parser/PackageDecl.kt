package net.contrapt.jvmcode.parser

import com.github.h0tk3y.betterParse.lexer.TokenMatch

class PackageDecl(name: String, token: TokenMatch) : Locatable(name, token)
class ImportDecl(name: String, token: TokenMatch, val isWild: Boolean) : Locatable(name, token) {
    var isStatic = false
}
class AnnotationRef(name: String, token: TokenMatch) : Locatable(name, token)
class TypeDecl(name: String, token: TokenMatch) : Locatable(name, token)
class VariableDecl(name: String, token: TokenMatch) : Locatable(name, token)
class VariableRef(name: String, token: TokenMatch) : Locatable(name, token)
class MethodDecl(name: String, token: TokenMatch) : Locatable(name, token)
class MethodRef(name: String, token: TokenMatch) : Locatable(name, token)

class BlockBegin(token: TokenMatch) : Locatable("block", token)
class BlockEnd(token: TokenMatch) : Locatable("block", token)
