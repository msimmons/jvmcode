package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.combinators.*
import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.grammar.parser
import com.github.h0tk3y.betterParse.lexer.TokenMatch
import com.github.h0tk3y.betterParse.parser.Parsed
import com.github.h0tk3y.betterParse.parser.Parser
import io.vertx.core.logging.LoggerFactory
import io.vertx.core.shareddata.Shareable
import net.contrapt.jvmcode.model.LanguageParser
import net.contrapt.jvmcode.model.ParseRequest
import net.contrapt.jvmcode.model.ParseResult
import net.contrapt.jvmcode.model.ParseSymbolType
import java.io.File

/**
 * array init
 * annotation param defs
 */
class JavaParser : Grammar<Any>(), LanguageParser, Shareable {

    val logger = LoggerFactory.getLogger(javaClass)

    class MatchProcessor(val block: (ParseContext) -> Unit)

    // Comments
    val BEGIN_COMMENT by token("/\\*")
    val END_COMMENT by token("\\*/")
    val LINE_COMMENT by token("//.*", ignore = true)

    // Puncuation
    val NL by token("[\r\n]+", ignore = true)
    val WS by token("\\s+", ignore = true)
    val SEMI by token(";")
    val COLON by token(":")
    val COMMA by token(",")
    val QUESTION by token("\\?")
    val O_BRACE by token("\\{")
    val C_BRACE by token("}")
    val O_PAREN by token("\\(")
    val C_PAREN by token("\\)")
    val O_BRACKET by token("\\[")
    val C_BRACKET by token("]")

    // Operators
    val INFIX_OPERATOR by token("(==|!=|<=|>=|&&|\\|\\||instanceof\\b)")
    val ASSIGN by token("(>>>|<<|>>|\\|\\||-|\\+|\\*|/|%|\\^|&)?=")

    val GT by token(">")
    val LT by token("<")
    val AMPERSAND by token("&")

    // Keywords
    val PACKAGE by token("package\\b")
    val IMPORT by token("import\\b")

    val SYNCRONIZED by token("synchronized\\b")
    val MODIFIER by token("(public|private|protected|final|transient|threadsafe|volatile|abstract|native|strictfp|inner|static)\\b")
    val DECLARE by token("(class|interface|enum|@interface)\\b")
    val AT by token("@")

    val VAR by token("var\\b")
    val EXTENDS by token("extends\\b")
    val IMPLEMENTS by token("implements\\b")

    val NEW by token("new\\b")

    val THROWS by token("throws\\b")

    val THROW by token("throw\\b")
    val RETURN by token("return\\b")

    val GOTO by token("(break|continue)\\b")
    val LABEL by token("(case|default)\\b")
    val CONTROL by token("(if|else|switch|for|while|do|try|catch|finally|default)\\b")
    val TYPE by token("(void|boolean|byte|char|short|int|long|double|float)\\b")

    val FALSE by token("false\\b")
    val TRUE by token("true\\b")
    val NULL by token("null\\b")
    val CHAR_LITERAL by token("'[\\\\]?\\w'")
    val UNICODE_LITERAL by token("'\\\\[uU][0-9a-fA-F]{4}'")
    val STRING_LITERAL by token("\"([^\"]|\"\"')*\"")
    val HEX_LITERAL by token ("0[xX][0-9a-fA-F_]*")
    val BIN_LITERAL by token("0[bB][_01]*")
    val OCT_LITERAL by token("0[0-7_]*")
    val NUM_LITERAL by token("([-]?[0-9]+(\\.[0-9_]*)?(E[-+]?[0-9_]+)?)[FfL]?|([-]?\\.[0-9_]+(E[-+]?[0-9_]+)?)[FfL]?")
    val WILD_IDENT by  token("[a-zA-Z_\$][.\\w]*[\\w](\\.\\*)")
    val IDENT by token("[a-zA-Z_\$][.\\w]*")
    val DOT by token("\\.")
    val OTHER by token(".")

    val OPERATOR by INFIX_OPERATOR or QUESTION or GT or LT or COLON or AMPERSAND
    val LITERAL by STRING_LITERAL or BIN_LITERAL or CHAR_LITERAL or HEX_LITERAL or NUM_LITERAL or OCT_LITERAL or UNICODE_LITERAL or FALSE or TRUE or NULL
    val MODIFIERS by zeroOrMore(MODIFIER or SYNCRONIZED)

    // Rules
    val literal by LITERAL
    val typeRef by TYPE or IDENT
    val symRef by IDENT
    val typeName by IDENT
    val varName by IDENT * zeroOrMore(O_BRACKET * C_BRACKET) map { it.t1 to it.t2.size }
    val fieldName by IDENT * zeroOrMore(O_BRACKET * C_BRACKET) map { it.t1 to it.t2.size }
    val methodName by IDENT
    val constructorName by IDENT

    val varNames by separated(varName, COMMA) map {
        it.terms
    }
    val typeSpec by typeRef * optional(parser(::typeArgs)) * zeroOrMore(O_BRACKET * C_BRACKET) map {
        Triple(it.t1, it.t3.size, it.t2)
    }
    fun addTypeSpec(ctx: ParseContext, typeSpec: Triple<TokenMatch, Int, MatchProcessor?>) : JavaParseSymbol {
        typeSpec.third?.block?.invoke(ctx)
        return ctx.addSymbol(typeSpec.first, ParseSymbolType.TYPEREF).apply { arrayDim = typeSpec.second }
    }

    val typeArg by typeSpec or (-QUESTION * -EXTENDS * typeSpec) map {
        MatchProcessor { ctx ->
            addTypeSpec(ctx, it)
        }
    }
    val typeArgs : Parser<MatchProcessor> by LT * separated(typeArg, COMMA, true) * GT map {
        MatchProcessor { ctx ->
            it.t2.terms.forEach { it.block(ctx) }
        }
    }

    val typeParam by typeRef * optional(-EXTENDS * separated(typeSpec, AMPERSAND)) map {
        (typeRef, typeSpecs) ->
        MatchProcessor { ctx ->
            ctx.addSymbol(typeRef, ParseSymbolType.SYMREF)
            typeSpecs?.terms?.forEach { addTypeSpec(ctx, it) }
        }
    }
    val typeParams by LT * separated(typeParam, COMMA, true) * GT map {
        MatchProcessor { ctx ->

        }
    }

    val annotationScalar by literal or symRef or parser(::annotationRef) map {
        MatchProcessor { ctx ->
            when(it) {
                is TokenMatch -> { if (it.type == IDENT) ctx.addSymbol(it, ParseSymbolType.SYMREF)}
                is MatchProcessor -> it.block(ctx)
                else -> {}
            }
        }
    }
    val annotationArray by -O_BRACE * separated(annotationScalar, COMMA, true) * -C_BRACE map {
        MatchProcessor { ctx ->
            it.terms.forEach { it.block(ctx) }
        }
    }
    val annotationParam by (annotationScalar or annotationArray) * optional(-ASSIGN * (annotationScalar or annotationArray)) map {
        MatchProcessor { ctx ->
            it.t1.block(ctx)
            it.t2?.block?.invoke(ctx)
        }
    }
    val annotationRef: Parser<MatchProcessor> by -AT * (typeRef) * optional(-O_PAREN * separated(annotationParam, COMMA, true) * -C_PAREN) map {
        MatchProcessor { ctx ->
            it.t2?.terms?.forEach { param ->
                param.block(ctx)
            }
            ctx.addSymbol(it.t1, ParseSymbolType.TYPEREF)
        }
    }
    val extendsClause by optional(-EXTENDS * separated(typeSpec, COMMA)) * optional(-IMPLEMENTS * separated(typeSpec, COMMA)) map {
        (extends, implements) ->
        MatchProcessor { ctx ->
            extends?.terms?.forEach { addTypeSpec(ctx, it) }
            implements?.terms?.forEach { addTypeSpec(ctx, it) }
        }
    }
    val throwsClause by optional(-THROWS * separated(typeRef, COMMA)) map {
        MatchProcessor { ctx ->
            it?.terms?.forEach { ctx.addSymbol(it, ParseSymbolType.TYPEREF) }
        }
    }

    val paramDef by zeroOrMore(annotationRef) * -optional(MODIFIER) * typeSpec * varName map { (annotations, typeSpec, varName) ->
        MatchProcessor { ctx ->
            annotations.forEach { it.block(ctx) }
            val type = ctx.addSymbol(typeSpec.first, ParseSymbolType.TYPEREF).apply { arrayDim = typeSpec.second }
            ctx.addSymbol(varName.first, ParseSymbolType.VARIABLE, "", type.name).apply {
                arrayDim = varName.second + type.arrayDim
            }
            typeSpec.third?.block?.invoke(ctx)
        }
    }
    val paramDefs by -O_PAREN * separated(paramDef, COMMA, true) * -C_PAREN map {
        MatchProcessor { ctx ->
            it.terms.forEach { it.block(ctx) }
        }
    }

    val literalExp by LITERAL map {MatchProcessor{}}
    val varExp by (IDENT or TYPE) * zeroOrMore(-O_BRACKET * parser(::expression) * -C_BRACKET) map {
        MatchProcessor { ctx ->
            ctx.addSymbolRef(it.t1)
            it.t2.forEach { it.block(ctx) }
        }
    }
    val castExp by -O_PAREN * typeSpec * -C_PAREN * parser(::expression) map {
        MatchProcessor {ctx->
            addTypeSpec(ctx, it.t1)
            it.t2.block(ctx)
        }
    }
    val methodExp by IDENT * optional(typeArgs) * -O_PAREN * separated(parser(::expression), COMMA, true) * -C_PAREN map {
        MatchProcessor{ctx->
            ctx.addSymbolRef(it.t1)
            it.t2?.block?.invoke(ctx)
            it.t3.terms.forEach { it.block(ctx) }
        }
    }
    val newArrayExp by -NEW * varExp * optional(typeArgs) * zeroOrMore(O_BRACKET * C_BRACKET) map {
        MatchProcessor { ctx ->
            it.t1.block(ctx)
        }
    }
    val newExp by -NEW * varExp * optional(typeArgs) * -O_PAREN * separated(parser(::expression), COMMA, true) * -C_PAREN map {
        MatchProcessor{ ctx ->
            it.t1.block(ctx)
            it.t2?.block?.invoke(ctx)
            it.t3.terms.forEach { it.block(ctx) }
        }
    }
    val loopExp by typeSpec * varName * -COLON * parser(::expression) map {
        MatchProcessor { ctx ->
            val type = addTypeSpec(ctx, it.t1)
            ctx.addSymbol(it.t2.first, ParseSymbolType.VARIABLE, "", type.name).apply { arrayDim = it.t2.second }
            it.t3.block(ctx)
        }
    }
    val initExp by typeSpec * varNames * -ASSIGN * parser(::expression) map {
        MatchProcessor { ctx ->
            val type = addTypeSpec(ctx, it.t1)
            it.t2.forEach {
                ctx.addSymbol(it.first, ParseSymbolType.VARIABLE, "", type.name).apply { arrayDim = it.second }
            }
            it.t3.block(ctx)
        }
    }
    val arrayExp by oneOrMore(-O_BRACKET * optional(parser(::expression)) * -C_BRACKET) map {
        MatchProcessor { ctx ->
            it.forEach { it?.block?.invoke(ctx) }
        }
    }
    val compoundExp by -O_PAREN * parser(::expression) * -C_PAREN map {
        MatchProcessor { ctx ->
            it.block(ctx)
        }
    }

    val expression : Parser<MatchProcessor> by oneOrMore(
        initExp or loopExp or methodExp or arrayExp or castExp or varExp or literalExp or compoundExp or
            OPERATOR or OTHER or DOT or ASSIGN or LABEL or RETURN or THROW or GOTO or NEW or COMMA
    ) map {
        MatchProcessor{ ctx ->
            it.forEach {m ->
                when (m) {
                    is MatchProcessor -> m.block(ctx)
                }
            }
        }
    }

    val Block : Parser<MatchProcessor> by optional(MODIFIER) * O_BRACE map {
        MatchProcessor { ctx ->
            ctx.addSymbol(it.t2, ParseSymbolType.BLOCK, it.t1?.text ?: "", createScope = true)
        }
    }

    val PackageDecl by -PACKAGE * IDENT * -SEMI map {
        MatchProcessor { ctx ->
            ctx.result.pkg = ctx.addSymbol(it, ParseSymbolType.PACKAGE)
        }
    }

    val ImportDecl by -IMPORT * optional(MODIFIER) * (IDENT or WILD_IDENT) map {
        MatchProcessor { ctx ->
            val imp = ctx.addSymbol(it.t2, ParseSymbolType.IMPORT).apply {
                isWild = it.t2.type == WILD_IDENT
                isStatic = it.t1 != null
            }
            ctx.result.imports.add(imp)
        }
    }

    val TypeDef by zeroOrMore(annotationRef) * MODIFIERS * DECLARE * typeName * optional(typeArgs) * extendsClause * -O_BRACE map {
        (annotations, mods, declare, name, generics, extends) ->
        MatchProcessor { ctx ->
            annotations.forEach { ann -> ann.block(ctx) }
            val symType = when(declare.text) {
                "class" -> ParseSymbolType.CLASS
                "interface" -> ParseSymbolType.INTERFACE
                "enum" -> ParseSymbolType.ENUM
                "@interface" -> ParseSymbolType.INTERFACE
                else -> ParseSymbolType.OBJECT
            }
            generics?.block?.invoke(ctx)
            ctx.addSymbol(name, symType, createScope = true)
            extends.block(ctx)
            ctx.addThis(name, symType)
        }
    }

    val ConstructorDef by zeroOrMore(annotationRef) * MODIFIERS * constructorName * paramDefs * throwsClause * O_BRACE map { (annotations, mods, name, params, throws) ->
        MatchProcessor { ctx ->
            annotations.forEach { it.block(ctx) }
            ctx.addSymbol(name, ParseSymbolType.CONSTRUCTOR, createScope = true)
            params.block(ctx)
            throws.block(ctx)
        }
    }

    val MethodDef by zeroOrMore(annotationRef) * MODIFIERS * optional(typeParams) * typeSpec * methodName * paramDefs * throwsClause * (O_BRACE or SEMI) map {
        (annotations, _, typeParams, typespec, name, params, throws, term) ->
        MatchProcessor { ctx ->
            annotations.forEach { it.block(ctx) }
            typeParams?.block?.invoke(ctx)
            throws.block(ctx)
            val type = addTypeSpec(ctx, typespec)
            ctx.addSymbol(name, ParseSymbolType.METHOD, "", type.name, createScope = true)
            params.block(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }

    val VarDef by zeroOrMore(annotationRef) * MODIFIERS * -VAR * varNames * optional(-ASSIGN * expression ) * -SEMI map {
        (annotations, _, names, expression) ->
        MatchProcessor { ctx->
            annotations.forEach { it.block(ctx) }
            names.forEach { ctx.addSymbol(it.first, ParseSymbolType.VARIABLE).apply { arrayDim = it.second } }
            expression?.block?.invoke(ctx)
        }
    }

    val FieldDef by zeroOrMore(annotationRef) * MODIFIERS * typeSpec * separated(fieldName, COMMA) * optional(-ASSIGN * expression ) * (SEMI or O_BRACE) map {
        (annotations, _, typespec, names, expression, term) ->
        MatchProcessor { ctx ->
            annotations.forEach { it.block(ctx) }
            typespec.third?.block?.invoke(ctx)
            val type = ctx.addSymbol(typespec.first, ParseSymbolType.TYPEREF).apply { arrayDim = typespec.second }
            val symbolType = if (ctx.inType()) ParseSymbolType.FIELD else ParseSymbolType.VARIABLE
            names.terms.forEach { ctx.addSymbol(it.first, symbolType, "", type.name).apply { arrayDim = it.second } }
            expression?.block?.invoke(ctx)
            if (term.type == O_BRACE) ctx.addSymbol(term, ParseSymbolType.BLOCK, createScope = true)
        }
    }

    val simpleControl by oneOrMore(CONTROL) * O_BRACE map {
        MatchProcessor { ctx ->
            ctx.addSymbol(it.t1.last(), ParseSymbolType.CONTROL, it.t1.last().text, it.t1.last().text, createScope = true)
        }
    }
    val statementControl by oneOrMore(CONTROL) * expression * SEMI map {
        MatchProcessor { ctx ->
            it.t2.block(ctx)
        }
    }
    val complexControl by oneOrMore(CONTROL or SYNCRONIZED) * -O_PAREN * separated(optional(expression), SEMI) * -C_PAREN * optional(expression) * (O_BRACE or SEMI) map {
        (controls, params, expression, term) ->
        MatchProcessor { ctx ->
            ctx.addSymbol(controls.last(), ParseSymbolType.CONTROL, controls.last().text, controls.last().text, createScope = true)
            params.terms.forEach { it?.block?.invoke(ctx) }
            expression?.block?.invoke(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }
    val ControlStatement by optional(IDENT * COLON) * (simpleControl or statementControl or complexControl) map {
        MatchProcessor { ctx ->
            it.t2.block(ctx)
        }
    }

    val Statement by optional(expression) * (SEMI or O_BRACE or C_BRACE) map { (expr, term) ->
        MatchProcessor { ctx ->
            expr?.block?.invoke(ctx)
            if (term.type == O_BRACE) ctx.addSymbol(term, ParseSymbolType.BLOCK, createScope = true)
            if (term.type == C_BRACE) ctx.endScope(term)
        }
    }

    val CloseBlock : Parser<MatchProcessor> by C_BRACE map {
        MatchProcessor { ctx ->
            ctx.endScope(it)
        }
    }

    val Rules : Parser<MatchProcessor> = Block or PackageDecl or ImportDecl or TypeDef or ConstructorDef or MethodDef or VarDef or FieldDef or
        ControlStatement or CloseBlock or Statement

    private fun processToken(context: ParseContext, token: TokenMatch, inComment: Boolean) {
        if (inComment) return
        when (token.type) {
            O_PAREN -> context.parenCount++
            C_PAREN -> context.parenCount--
        }
        when (token.type) {
            WS, NL, LINE_COMMENT -> {}
            else -> context.tokens.add(token)
        }
    }

    private fun processTokens(context: ParseContext, token: TokenMatch) {
        if (context.tokens.size == 0) return
        if (context.parenCount > 0) return
        //println("Trying ${context.tokens.first()} -> ${context.tokens.last()}")
        val parsed = Rules.tryParse(context.tokens.asSequence())
        when (parsed) {
            is Parsed -> parsed.value.block(context)
            else -> logger.warn("NO MATCH: (${token.row})\n   ${context.tokens}")
        }
        context.clear()
    }

    override fun parse(request: ParseRequest) : JavaParseResult {
        val context = ParseContext(request as JavaParseRequest)
        var tokens = this.tokenizer.tokenize(request.text ?: "")
        var inComment = false
        val start = System.currentTimeMillis()
        tokens.forEach {
            when (it.type) {
                BEGIN_COMMENT -> inComment = true
                END_COMMENT -> inComment = false
                else -> processToken(context, it, inComment)
            }
            when (it.type) {
                O_BRACE, SEMI, C_BRACE -> processTokens(context, it)
            }
        }
        context.result.parseTime = System.currentTimeMillis()-start
        return context.result
    }

    override val rootParser: Parser<Any>
        get() = TODO("not implemented") //To change initializer of created properties use File | Settings | File Templates.
}
