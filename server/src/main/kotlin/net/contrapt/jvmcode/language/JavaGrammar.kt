package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.combinators.*
import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.grammar.parser
import com.github.h0tk3y.betterParse.parser.Parser

object JavaGrammar : Grammar<String>() {

    // Puncuation
    val WS by token("\\s+", ignore = true)
    val NL by token("[\r\n]+", ignore = true)
    val DOT by token("\\.")
    val SEMI by token(";")
    val COMMA by token(",")
    val ASTERISK by token("\\*")
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
    val TIMES by token("\\*")

    val DIVeq by token("/=")
    val DIV by token("/")

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
    val VOLATILE by token("volatile\\b")
    val ABSTRACT by token("abstract\\b")
    val NATIVE by token("native\\b")
    val SYNCHRONIZED by token("native\\b")
    val STRICTFP by token("strictfp\\b")
    val INNER by token("inner\\b")
    val VAL by token("val\\b")

    val CLASS by token("class\\b")
    val INTERFACE by token("interface\\b")
    val ENUM by token("enum\\b")
    val EXTENDS by token("extends\\b")
    val INSTANCEOF by token("instanceof\\b")

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

    //val THIS by token("this\\b")
    val VOID by token("void\\b")
    val BOOLEAN by token("boolean\\b")
    val BYTE by token("byte\\b")
    val CHAR by token("char\\b")
    val SHORT by token("short\\b")
    val INT by token("int\\b")
    val LONG by token("long\\b")
    val DOUBLE by token("double\\b")
    val FLOAT by token("float\\b")

    // Identifier is dot separated thing
    // TODO backticked identifiers
    val IDENT by token("[A-Za-z][.\\w]*")

    // Rules
    //
    val primitiveType by BOOLEAN or BYTE or CHAR or SHORT or INT or LONG or DOUBLE or FLOAT or VOID
    val identList by separated(IDENT, COMMA, false) map {
        it.terms
    }

    val modifier by (PUBLIC or PRIVATE or PROTECTED or STATIC or FINAL or VOLATILE or NATIVE or SYNCHRONIZED or INNER or TRANSIENT or STRICTFP or ABSTRACT)
    val semis by oneOrMore(SEMI)
    // Allow new lines as statement ends?

    // Package
    val packageName by IDENT map {
        val name = it.text
        val start = it.position
        val end = start + name.length-1
        JavaParseSymbol(name, "PACKAGE", JavaParseLocation(start, end), name)
    }
    val packageDecl by (-PACKAGE * packageName * -semis) map {
        it
    }

    // Imports
    val importName by IDENT * optional(ASTERISK) map {
        val name = it.t1.text.trim('.')
        val wild = it.t2 != null
        val start = it.t1.position
        val end = start + it.t1.text.length -1 + (if (wild) 1 else 0)
        JavaParseSymbol(name, "IMPORT", JavaParseLocation(start, end), name).apply { isWild = wild }
    }
    val importDecl by (-IMPORT * optional(STATIC) * importName * -semis) map {
        it.t2.apply { isStatic = it.t1 != null }
    }
    val importDecls by zeroOrMore(importDecl)

    // Annotations
    val annotationValue by (parser(this::annotation) or parser(this::expression) or parser(this::annotationArray)) use {
    }
    val annotationValuePair : Parser<String> by (IDENT * -ASSIGN * annotationValue) map { it.t1.text + it.t2}
    val annotationArray : Parser<String> by (-O_BRACE * separated(annotationValue, COMMA, true) * -C_BRACE) map { it.terms.toString() }
    val annotation by (-AT * IDENT * optional(-O_PAREN and separated(annotationValuePair, COMMA, true) * -C_PAREN)) map {
        println(it.t2)
        AnnotationRef(it.t1.text, it.t1)
    }

    // Should we assume we are parsing line/statement by line/statement?  To more easily handle errors
    // Statements

    // Expressions
    val valueExpression by (IDENT)
    val assignOp by (ASSIGN or PLUSeq or MINUSeq or TIMESeq or DIVeq or BANDeq or BOReq or CARETeq or PCTeq or LSHFTeq or RSHFTeq or RRSHFTeq)
    val assignExpression by (IDENT * -assignOp * valueExpression)

    val infixOp by (OR or AND or BOR or BAND or CARET or EQ or NEQ or RRSHFT or LEQ or LSHFT or GEQ or RSHFT or LT or GT or PLUS or MINUS or TIMES or DIV or PCT)
    val prefixOp by (INC or DEC or NOT or TILDE or PLUS or MINUS)
    val postfixOp by (INC or DEC)

    val prefixExpression by (prefixOp * parser(this::complexExpression))
    val castExpression by (-O_PAREN * (parser(this::expression) or IDENT) * -C_PAREN * parser(this::complexExpression))
    val complexExpression by (IDENT) // 3

    val infixTag by (-infixOp * complexExpression)
    val instanceofTag by (-INSTANCEOF * IDENT)
    val infixExpression by (complexExpression * optional(infixTag or instanceofTag))
    val condTag by (-QUESTION * parser(this::expression) * -COLON * parser(this::condExpression))
    val condExpression : Parser<String> by (infixExpression * optional(condTag)) map { it.t1.t1.text }
    val assignment : Parser<String> by (-assignOp * condExpression) map { it }

    val expression : Parser<String> by (condExpression * optional(assignment)) map {
        "${it.t1} ${it.t2}"
    }

    // Types
    val typeRef by IDENT or primitiveType map {
        it.toString()
    }

    val extendsClause by (-EXTENDS * separated(IDENT, COMMA, false))

    val typeDecl by zeroOrMore(modifier) * -(CLASS or INTERFACE or ENUM) * IDENT * optional(extendsClause) map {
        TypeDecl(it.t2.text, it.t2)
    }

    val blockBegin by O_BRACE map { BlockBegin(it) }
    val blockEnd by C_BRACE map { BlockEnd(it) }

    // Variables
    val variableDecl by (zeroOrMore(modifier) * typeRef * identList * optional(assignment) * SEMI) map {
        it.t3.map {
            VariableDecl(it.text, it)
        }
    }
    val castExpr by -O_PAREN * typeRef * -C_PAREN
    val variableRef by optional(castExpr) * IDENT map {
        VariableRef(it.t2.text, it.t2)
    }
    val variableRefs by separated(variableRef, COMMA, true)

    // Methods
    val methodParam by zeroOrMore(annotation) * typeRef * IDENT
    val methodParams by separated(methodParam, COMMA, true)
    val methodDecl by zeroOrMore(modifier) * optional(typeRef) * IDENT * -O_PAREN * methodParams * -C_PAREN map {
        MethodDecl(it.t3.text, it.t3)
    }
    val methodRef by IDENT * -O_PAREN * variableRefs * -C_PAREN map {
        MethodRef(it.t1.text, it.t1)
    }

    // Statements
    val statement by (IDENT)

    val lineParser by ( packageDecl or importDecl or annotation or typeDecl or variableDecl or methodDecl or methodRef or blockBegin or blockEnd) map {
        it
    }

    val compilationUnit by ( optional(packageDecl) * importDecls * optional(typeDecl) ) map {
        val pkg = it.t1
        val imp = it.t2
        val cls = it.t3
        pkg.toString() + "\n" + imp + "\n" + cls
    }

    override val rootParser: Parser<String>
        get() = compilationUnit
}