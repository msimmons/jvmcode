package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.lexer.TokenMatch
import net.contrapt.jvmcode.model.ParseSymbolType
import java.util.*

data class ParseContext(
    val request: JavaParseRequest,
    val result: JavaParseResult = JavaParseResult(file = request.file),
    var parenCount: Int = 0,
    var inAssignment: Boolean = false,
    val tokens: MutableList<TokenMatch> = mutableListOf(),
    val scopes: Stack<JavaParseSymbol> = Stack()
) {

    private fun nextId() = result.symbols.size
    private fun scopeId() = if (scopes.empty()) -1 else scopes.peek().id
    fun inType() : Boolean {
        return if (scopes.empty()) false
        else when(scopes.peek().symbolType) {
            ParseSymbolType.OBJECT, ParseSymbolType.ENUM, ParseSymbolType.INTERFACE, ParseSymbolType.CLASS -> true
            else -> false
        }
    }

    fun addSymbol(token: TokenMatch, symbolType: ParseSymbolType, classifier: String = "", type: String? = null, createScope: Boolean = false): JavaParseSymbol {
        val name = token.text
        val start = token.position
        val end = start + name.length - 1
        val id = nextId()
        val symbol = JavaParseSymbol(id, name, classifier, JavaParseLocation(start, end)).apply {
            this.type = type ?: name
            this.symbolType = symbolType
            parent = scopeId()
        }
        add(symbol)
        val padding = "  ".repeat(scopes.size)
        println("$padding:$token:$symbol")
        if (createScope) {
            println("Start Scope: ${symbol}")
            scopes.push(symbol)
        }
        return symbol
    }

    fun addThis(token: TokenMatch, symbolType: ParseSymbolType) {
        val name = "this"
        val start = token.position
        val end = token.position
        val id = nextId()
        val symbol = JavaParseSymbol(id, name, "", JavaParseLocation(start, end)).apply {
            this.type = token.text
            this.symbolType = symbolType
            parent = scopeId()
        }
        add(symbol)
    }

    fun addSuper(token: TokenMatch, symbolType: ParseSymbolType) {
        val name = "super"
        val start = token.position
        val end = token.position
        val id = nextId()
        val symbol = JavaParseSymbol(id, name, "", JavaParseLocation(start, end)).apply {
            this.type = token.text
            this.symbolType = symbolType
            parent = scopeId()
        }
        add(symbol)
    }

    fun addSymbolRef(token: TokenMatch) {
        val names = token.text
        var offset = 0
        names.split(".").forEachIndexed { i, n ->
            val start = token.position + offset
            val end = start + n.length - 1
            offset = offset + n.length + 1
            val id = nextId()
            val symbol = JavaParseSymbol(id, n, "", JavaParseLocation(start, end)).apply {
                this.type = type ?: name
                this.symbolType = ParseSymbolType.SYMREF
                parent = scopeId()
                caller = if (i == 0) null else id - 1
            }
            //println("   ${token.text} $offset $symbol")
            add(symbol)
        }
    }

    private fun add(symbol: JavaParseSymbol) {
        //println(symbol)
        result.symbols.add(symbol)
        if (!scopes.empty()) scopes.peek().children.add(symbol.id)
    }

    fun endScope(token: TokenMatch) {
        if (!scopes.empty()) {
            val scope = scopes.pop()
            scope.scopeEnd = JavaParseLocation(token.position, token.position)
            println("End Scope: ${scope}")
        }
    }

    fun clear() {
        inAssignment = false
        tokens.clear()
    }
}