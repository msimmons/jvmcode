package net.contrapt.jvmcode.parser

import com.github.h0tk3y.betterParse.lexer.TokenMatch

abstract class Locatable(val name: String, token: TokenMatch) {
    val row = token.row
    val col = token.column
    val pos = token.position

    override fun toString(): String {
        return "${this::class.simpleName} $name @ $row, $col"
    }
}