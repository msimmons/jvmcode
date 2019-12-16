package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.combinators.*
import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.grammar.tryParseToEnd
import com.github.h0tk3y.betterParse.parser.Parser
import com.github.h0tk3y.betterParse.parser.UnparsedRemainder
import net.contrapt.jvmcode.language.JavaGrammar.getValue
import net.contrapt.jvmcode.language.JavaGrammar.provideDelegate

class NewJavaGrammar : Grammar<Any>() {

    // Comments
    val O_COMMENT by token("/\\*")
    val C_COMMENT by token("\\*/")
    val ANYTHING by token(".*")

    // Puncuation
    val WS by token("\\s+", ignore = true)
    val NL by token("[\r\n]+", ignore = true)
    val SEMI by token(";", ignore = true)
    val DOT by token("\\.")
    val COMMA by token(",")
    val ASTERISK by token("\\*[^/]")
    val AT by token("@")
    val O_BRACE by token("\\{")
    val C_BRACE by token("}")
    val O_PAREN by token("\\(")
    val C_PAREN by token("\\)")
    val O_BRACKET by token("\\[")
    val C_BRACKET by token("]")
    val QUESTION by token("\\?")
    val COLON by token(":")

    // Operators
    val EQ by token("==")
    val ASSIGN by token("=")

    val PLUSeq by token("\\+=")
    val INC by token("\\++")
    val PLUS by token("\\+")

    val MINUSeq by token("-=")
    val DEC by token("--")
    val MINUS by token("-")

    val TIMESeq by token("\\*=")
    val TIMES by token("\\*[^/]")

    val DIVeq by token("/=")
    val DIV by token("/[^*/]")

    val AND by token("&&")
    val BANDeq by token("&=")
    val BAND by token("&")

    val OR by token("\\|\\|")
    val BOReq by token("\\|=")
    val BOR by token("\\|")

    val CARETeq by token("^=")
    val CARET by token("\\^")

    val PCTeq by token("%=")
    val PCT by token("%")

    val LSHFTeq by token("<<=")
    val LSHFT by token("<<")
    val LEQ by token("<=")
    val LT by token("<")
    val RRSHFTeq by token(">>>=")
    val RRSHFT by token(">>>")
    val RSHFTeq by token(">>=")
    val RSHFT by token(">>")
    val GEQ by token(">=")
    val GT by token(">")

    val NEQ by token("!=")
    val NOT by token("!")

    val TILDE by token("~")

    // Keywords
    val PACKAGE by token("package\\b")
    val IMPORT by token("import\\b")

    val PUBLIC by token("public\\b")
    val PRIVATE by token("private\\b")
    val PROTECTED by token("protected\\b")
    val STATIC by token("static\\b")
    val FINAL by token("final\\b")
    val TRANSIENT by token("transient\\b")
    val THREADSAFE by token("threadsafe\\b")
    val VOLATILE by token("volatile\\b")
    val ABSTRACT by token("abstract\\b")
    val NATIVE by token("native\\b")
    val SYNCHRONIZED by token("native\\b")
    val STRICTFP by token("strictfp\\b")
    val INNER by token("inner\\b")
    val VAL by token("val\\b")
    val VAR by token("var\\b")

    val NEW by token("new\\b")
    val CLASS by token("class\\b")
    val INTERFACE by token("interface\\b")
    val ENUM by token("enum\\b")
    val EXTENDS by token("extends\\b")
    val IMPLEMENTS by token("implements\\b")
    val INSTANCEOF by token("instanceof\\b")
    val SUPER by token("super\\b")

    val IF by token("if\\b")
    val ELSE by token("else\\b")
    val SWITCH by token("switch\\b")
    val CASE by token("case\\b")
    val DEFAULT by token("default\\b")
    val FOR by token("for\\b")
    val WHILE by token("while\\b")
    val DO by token("do\\b")
    val TRY by token("try\\b")
    val CATCH by token("catch\\b")
    val FINALLY by token("finally\\b")
    val THROW by token("throw\\b")
    val BREAK by token("break\\b")
    val CONTINUE by token("continue\\b")
    val RETURN by token("return\\b")

    val THIS by token("this\\b")
    val VOID by token("void\\b")
    val BOOLEAN by token("boolean\\b")
    val BYTE by token("byte\\b")
    val CHAR by token("char\\b")
    val SHORT by token("short\\b")
    val INT by token("int\\b")
    val LONG by token("long\\b")
    val DOUBLE by token("double\\b")
    val FLOAT by token("float\\b")
    val FALSE by token("false\\b")
    val TRUE by token("true\\b")
    val NULL by token("null\\b")

    val IDENT by token("[a-zA-Z_\$][\\w]*")

    // RULES
    val identifier by IDENT
    val packageName by separated(identifier, DOT, true)
    val qualifiedName by separated(identifier, DOT, true)
    val wildcardName by qualifiedName * DOT * ASTERISK

    val modifier by PUBLIC or PRIVATE or PROTECTED or STATIC or FINAL or NATIVE or SYNCHRONIZED or ABSTRACT or THREADSAFE or TRANSIENT
    val typeName by BOOLEAN or BYTE or CHAR or SHORT or INT or FLOAT or LONG or DOUBLE or VOID or qualifiedName
    val typeSpec by typeName * zeroOrMore(O_BRACKET * C_BRACKET)

    val packageDecl by PACKAGE * packageName * SEMI
    val importDecl by IMPORT * optional(STATIC) * (wildcardName or qualifiedName) * SEMI

    val typeDecl by zeroOrMore(modifier) * (CLASS or INTERFACE or ENUM) * identifier * optional(EXTENDS * qualifiedName) * optional(IMPLEMENTS * separated(qualifiedName, COMMA))
    val constructorDecl by zeroOrMore(modifier) * identifier * O_PAREN * C_PAREN
    val methodDecl by zeroOrMore(modifier) * typeSpec * identifier * O_PAREN * C_PAREN * zeroOrMore(O_BRACKET * C_BRACKET)
    val identifierList by separated(identifier * zeroOrMore(O_BRACKET * C_BRACKET), COMMA, true)
    val variableDecl by zeroOrMore(modifier) * typeSpec * identifierList * SEMI

    val blockBegin by optional(STATIC) * O_BRACE
    val blockEnd by C_BRACE

    val unit by optional(packageDecl) * zeroOrMore(importDecl) * optional(typeDecl) * zeroOrMore(blockBegin or blockEnd or variableDecl or methodDecl)

    override val rootParser = unit

    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val grammar = NewJavaGrammar()
            val tokens = grammar.tokenizer.tokenize(code).forEach { println(it) }
/*
                    .filter {
                var inComment = false
                val doParse = when(it.type) {
                    grammar.O_COMMENT -> {inComment = true; false}
                    grammar.C_COMMENT -> {inComment = false; false}
                    else -> true
                }
                println("$doParse || $inComment: ${it.text}")
                doParse && !inComment
            }.asSequence()
*/
/*
            val result = NewJavaGrammar().tryParse(tokens)
            println(result)
            when(result) {
                is UnparsedRemainder -> {
                    println(code.substring(result.startsWith.position))
                }
            }
*/
        }

        val code = """
/**
a coment
let's 
* see
*/
package net.contrapt.jvmcode.language;

import java.math.BigDecimal;
import java.math.*;
import static net.contrapt.FOO;

public class TryIt {

    static {
    }

    String[][] foo, bar[][];

    void aMethod() {}

}
        """.trimIndent()
    }
}