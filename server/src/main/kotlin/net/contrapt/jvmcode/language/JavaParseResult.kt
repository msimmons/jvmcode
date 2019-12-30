package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.ParseResult
import net.contrapt.jvmcode.model.ParseScope
import net.contrapt.jvmcode.model.ParseScopeType
import net.contrapt.jvmcode.model.ParseSymbol
import java.util.*

data class JavaParseResult(
        override val languageId: String = "java",
        override val name: String = "vsc-java",
        override val file: String
) : ParseResult {
    override lateinit var  pkg: ParseSymbol
    override val imports: MutableCollection<ParseSymbol> = mutableListOf()
    override val scopes: MutableCollection<ParseScope> = mutableListOf()
    override val symbols: MutableCollection<ParseSymbol> = mutableSetOf()

    private val scopeStack = Stack<JavaParseScope>()

    init {
        startScope(JavaParseScope(ParseScopeType.SOURCE, JavaParseLocation(0,-1), null))
    }

    fun currentScope() = scopeStack.peek()

    fun startScope(scope: JavaParseScope) {
        scopeStack.push(scope)
        scopes.add(scope)
    }

    fun endScope(end: Int) {
        if (!scopeStack.empty()) {
            val scope = scopeStack.pop()
            scope.location = JavaParseLocation(scope.location.start, end)
        }
    }
}
