package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.combinators.*
import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.grammar.parser
import com.github.h0tk3y.betterParse.lexer.TokenMatch
import com.github.h0tk3y.betterParse.parser.Parsed
import com.github.h0tk3y.betterParse.parser.Parser
import com.github.h0tk3y.betterParse.parser.tryParseToEnd
import io.vertx.core.logging.LoggerFactory
import io.vertx.core.shareddata.Shareable
import net.contrapt.jvmcode.model.LanguageParser
import net.contrapt.jvmcode.model.ParseRequest
import net.contrapt.jvmcode.model.ParseSymbolType

/**
 *
 */
class JavaParser : Grammar<Any>(), LanguageParser, Shareable {

    val logger = LoggerFactory.getLogger(javaClass)

    class MatchProcessor(val block: (ParseContext) -> Unit)
    class MatchProducer(val block: (ParseContext, Boolean) -> JavaParseSymbol)

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
    val PIPE by token("\\|")
    val SUPER by token("super\\b")

    // Keywords
    val PACKAGE by token("package\\b")
    val IMPORT by token("import\\b")

    val SYNCRONIZED by token("synchronized\\b")
    val ASSERT by token("assert\\b")
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
    val CASE by token("case\\b")
    val DEFAULT by token("default\\b")
    val IF_WHILE_SWITCH by token("(if|while|switch)\\b")
    val ELSE by token("else\\b")
    val DO by token("do\\b")
    val FINALLY by token("finally\\b")
    val FOR by token("for\\b")
    val TRY by token("try\\b")
    val CATCH by token("catch\\b")
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
    val ELLIPSIS by token("\\.\\.\\.")
    val DOT by token("\\.")
    val OTHER by token(".")

    val OPERATOR by INFIX_OPERATOR or GT or LT or AMPERSAND or PIPE
    val LITERAL by STRING_LITERAL or BIN_LITERAL or CHAR_LITERAL or HEX_LITERAL or NUM_LITERAL or OCT_LITERAL or UNICODE_LITERAL or FALSE or TRUE or NULL
    val MODIFIERS by zeroOrMore(MODIFIER or SYNCRONIZED or DEFAULT)

    // Rules
    val literal by LITERAL
    val typeRef by TYPE or IDENT or SUPER
    val symRef by IDENT or SUPER
    val typeName by IDENT
    val varName by IDENT * zeroOrMore(O_BRACKET * C_BRACKET) map { it.t1 to it.t2.size }
    val fieldName by IDENT * zeroOrMore(O_BRACKET * C_BRACKET) map { it.t1 to it.t2.size }
    val methodName by IDENT
    val constructorName by IDENT

    val varNames by separated(varName, COMMA) map {
        it.terms
    }

    val typeSpec by (typeRef or QUESTION) * optional(parser(::typeArgs)) * zeroOrMore(O_BRACKET * C_BRACKET) * -optional(ELLIPSIS) map {
        MatchProducer { ctx, scope ->
            it.t2?.block?.invoke(ctx)
            ctx.addSymbol(it.t1, ParseSymbolType.TYPEREF, createScope = scope).apply { arrayDim = it.t3.size }
        }
    }

    val symSpec by symRef * optional(parser(::typeArgs)) * zeroOrMore(O_BRACKET * C_BRACKET) map {
        MatchProducer { ctx, scope ->
            it.t2?.block?.invoke(ctx)
            ctx.addSymbol(it.t1, ParseSymbolType.SYMREF, createScope = scope).apply { arrayDim = it.t3.size }
        }
    }

    val typeArg by typeSpec * optional(-(EXTENDS or SUPER) * typeSpec) map {
        MatchProcessor { ctx ->
            it.t1.block(ctx, false)
        }
    }

    val typeArgs : Parser<MatchProcessor> by LT * separated(typeArg, COMMA, true) * GT map {
        MatchProcessor { ctx ->
            ctx.logMatch("typeArgs", it.t1)
            it.t2.terms.forEach { it.block(ctx) }
        }
    }

    // Generic parameter definition
    val typeParam by (typeRef or QUESTION) * optional(-(EXTENDS or SUPER) * separated(typeSpec, AMPERSAND)) map {
        (typeRef, typeSpecs) ->
        MatchProcessor { ctx ->
            ctx.logMatch("typeArgs", typeRef)
            val types = typeSpecs?.terms?.map { it.block(ctx, false) }
            val type = types?.firstOrNull()?.type
            if (typeRef.type != QUESTION)
                ctx.addSymbol(typeRef, ParseSymbolType.TYPEPARAM, type = type)
        }
    }

    val typeParams by -LT * separated(typeParam, COMMA, true) * -GT map {
        MatchProcessor { ctx ->
            it.terms.forEach { it.block(ctx) }
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
            extends?.terms?.forEach { it.block(ctx, false) }
            implements?.terms?.forEach { it.block(ctx, false) }
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
            //val type = ctx.addSymbol(typeSpec.first, ParseSymbolType.TYPEREF).apply { arrayDim = typeSpec.second }
            val type = typeSpec.block(ctx, false)
            ctx.addSymbol(varName.first, ParseSymbolType.VARIABLE, "", type.name).apply {
                arrayDim = varName.second + type.arrayDim
            }
            //typeSpec.third?.block?.invoke(ctx)
        }
    }

    val paramDefs by -O_PAREN * separated(paramDef, COMMA, true) * -C_PAREN map {
        MatchProcessor { ctx ->
            it.terms.forEach { it.block(ctx) }
        }
    }

    val literalExp by LITERAL map {MatchProcessor{}}

    val arrayLiteral by -O_BRACE * separated(parser(::Expression), COMMA, true) * -C_BRACE map {
        MatchProcessor { ctx ->
            ctx.logMatch("arrayLiteral")
            it.terms.forEach { it.block(ctx) }
        }
    }

    val varExp by (IDENT or TYPE) * zeroOrMore(-O_BRACKET * parser(::Expression) * -C_BRACKET) map {
        MatchProcessor { ctx ->
            ctx.logMatch("varExp")
            ctx.addSymbolRef(it.t1)
            it.t2.forEach { it.block(ctx) }
        }
    }

    val castExp by -O_PAREN * typeSpec * -C_PAREN * parser(::Expression) map {
        MatchProcessor {ctx->
            ctx.logMatch("castExp")
            it.t1.block(ctx, false)
            it.t2.block(ctx)
        }
    }

    val methodRef by symRef * optional(typeArgs) * -O_PAREN * separated(parser(::Expression), COMMA, true) * -C_PAREN map {
        MatchProcessor{ctx->
            ctx.logMatch("methodRef")
            ctx.addSymbolRef(it.t1)
            it.t2?.block?.invoke(ctx)
            it.t3.terms.forEach { it.block(ctx) }
        }
    }

    val newExp by -NEW * typeSpec * -O_PAREN * separated(parser(::Expression), COMMA, true) * -C_PAREN * optional(O_BRACE) map {
        MatchProcessor{ ctx ->
            ctx.logMatch("newExp")
            val createScope = it.t3 != null
            it.t1.block(ctx, createScope)
            it.t2.terms.forEach { it.block(ctx) }
        }
    }

    val arrayRef by oneOrMore(-O_BRACKET * optional(parser(::Expression)) * -C_BRACKET) map {
        MatchProcessor { ctx ->
            ctx.logMatch("arrayRef")
            it.forEach { it?.block?.invoke(ctx) }
        }
    }

    val newArray by -NEW * typeSpec * (arrayLiteral or arrayRef) map {
        MatchProcessor { ctx ->
            ctx.logMatch("newArray")
            it.t1.block(ctx, false)
        }
    }

    val assignmentExp by -ASSIGN * parser(::Expression) map {
        MatchProcessor { ctx ->
            ctx.logMatch("assignmentExp")
            it.block(ctx)
        }
    }

    val varInit by typeSpec * varNames * assignmentExp map {
        MatchProcessor { ctx ->
            ctx.logMatch("varInit")
            val type = it.t1.block(ctx, false)
            it.t2.forEach {
                ctx.addSymbol(it.first, ParseSymbolType.VARIABLE, "", type.name).apply { arrayDim = it.second }
            }
            it.t3.block(ctx)
        }
    }

    val compoundExp by -O_PAREN * parser(::Expression) * -C_PAREN map {
        MatchProcessor { ctx ->
            ctx.logMatch("compoundExp")
            it.block(ctx)
        }
    }

    val elvisExp by -QUESTION * parser(::Expression) * -COLON map {
        MatchProcessor { ctx ->
            ctx.logMatch("elvisExp")
            it.block(ctx)
        }
    }

    val labelExp by -(CASE or DEFAULT) * optional(parser(::Expression)) * -COLON map {
        MatchProcessor { ctx ->
            ctx.logMatch("labelExp")
            it?.block?.invoke(ctx)
        }
    }

    val assertExp by -ASSERT * parser(::Expression) * optional(-COLON * parser(::Expression)) map {
        MatchProcessor { ctx ->
            it.t1.block(ctx)
            it.t2?.block?.invoke(ctx)
        }
    }

    //java.security.AccessController.doPrivileged ( new java.security.PrivilegedAction < > ( ) { public Void run ( ) { values.setAccessible ( true ) ; return null ; } } )
    val Expression : Parser<MatchProcessor> by oneOrMore(
        varInit or methodRef or arrayRef or castExp or varExp or literalExp or
            compoundExp or arrayLiteral or newExp or newArray or elvisExp or labelExp or assertExp or
            OPERATOR or OTHER or DOT or ASSIGN or RETURN or THROW or GOTO or COMMA) map {
        MatchProcessor{ ctx ->
            ctx.logMatch("Expression", null)
            it.forEach {m ->
                when (m) {
                    is MatchProcessor -> m.block(ctx)
                    is MatchProducer -> m.block(ctx, false)
                }
            }
        }
    }

    val statementLabel by IDENT * COLON map {
        MatchProcessor { ctx ->
            ctx.addSymbol(it.t1, ParseSymbolType.SYMREF, type = "label")
        }
    }

    val Block : Parser<MatchProcessor> by optional(MODIFIER) * optional(statementLabel) * O_BRACE map {
        MatchProcessor { ctx ->
            ctx.logMatch("Block", it.t3)
            it.t2?.block?.invoke(ctx)
            ctx.addBlock(it.t3)
        }
    }

    val PackageDecl by -PACKAGE * IDENT * SEMI map {
        MatchProcessor { ctx ->
            ctx.result.pkg = ctx.addSymbol(it.t1, ParseSymbolType.PACKAGE)
        }
    }

    val ImportDecl by -IMPORT * optional(MODIFIER) * (IDENT or WILD_IDENT) * SEMI map {
        MatchProcessor { ctx ->
            val imp = ctx.addSymbol(it.t2, ParseSymbolType.IMPORT).apply {
                isWild = it.t2.type == WILD_IDENT
                isStatic = it.t1 != null
            }
            ctx.result.imports.add(imp)
        }
    }

    val TypeDef by zeroOrMore(annotationRef) * MODIFIERS * DECLARE * typeName * optional(typeParams) * extendsClause * O_BRACE map {
        (annotations, _, declare, name, generics, extends) ->
        MatchProcessor { ctx ->
            ctx.logMatch("TypeDef", name)
            annotations.forEach { ann -> ann.block(ctx) }
            val symType = when(declare.text) {
                "class" -> ParseSymbolType.CLASS
                "interface" -> ParseSymbolType.INTERFACE
                "enum" -> ParseSymbolType.ENUM
                "@interface" -> ParseSymbolType.ANNOTATION
                else -> ParseSymbolType.OBJECT
            }
            ctx.addSymbol(name, symType, createScope = true)
            generics?.block?.invoke(ctx)
            extends.block(ctx)
            ctx.addThis(name)
        }
    }

    val ConstructorDef by zeroOrMore(annotationRef) * MODIFIERS * constructorName * paramDefs * throwsClause * O_BRACE map {
        (annotations, _, name, params, throws) ->
        MatchProcessor { ctx ->
            ctx.logMatch("ConstructorDef", name)
            annotations.forEach { it.block(ctx) }
            ctx.addSymbol(name, ParseSymbolType.CONSTRUCTOR, createScope = true)
            params.block(ctx)
            throws.block(ctx)
        }
    }

    val MethodDef by zeroOrMore(annotationRef) * MODIFIERS * optional(typeParams) * typeSpec * methodName * paramDefs *
        -optional(O_BRACKET * C_BRACKET) * throwsClause * optional(-DEFAULT * parser(::Expression)) * (SEMI or O_BRACE) map {
        (annotations, _, typeParams, typespec, name, params, throws, def, term) ->
        MatchProcessor { ctx ->
            ctx.logMatch("MethodDef", name)
            annotations.forEach { it.block(ctx) }
            throws.block(ctx)
            val type = typespec.block(ctx, false)
            ctx.addSymbol(name, ParseSymbolType.METHOD, "", type.name, createScope = true)
            typeParams?.block?.invoke(ctx)
            params.block(ctx)
            def?.block?.invoke(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }

    val VarDef by zeroOrMore(annotationRef) * MODIFIERS * -VAR * varNames * optional(assignmentExp) * optional(SEMI) map {
        (annotations, _, names, expression) ->
        MatchProcessor { ctx->
            ctx.logMatch("VarDef", names.first().first)
            annotations.forEach { it.block(ctx) }
            names.forEach { ctx.addSymbol(it.first, ParseSymbolType.VARIABLE).apply { arrayDim = it.second } }
            expression?.block?.invoke(ctx)
        }
    }

    val FieldDef by zeroOrMore(annotationRef) * MODIFIERS * typeSpec * separated(fieldName, COMMA) * optional(assignmentExp) * optional(SEMI) map {
        (annotations, _, typespec, names, expression) ->
        MatchProcessor { ctx ->
            ctx.logMatch("FieldDef", names.terms.first().first)
            annotations.forEach { it.block(ctx) }
            val type = typespec.block(ctx, false)
            val symbolType = if (ctx.inType()) ParseSymbolType.FIELD else ParseSymbolType.VARIABLE
            names.terms.forEach { ctx.addSymbol(it.first, symbolType, "", type.name).apply { arrayDim = it.second } }
            expression?.block?.invoke(ctx)
        }
    }

    val ifControl by (IF_WHILE_SWITCH or SYNCRONIZED) * -O_PAREN * Expression * -C_PAREN * optional(Expression) * (O_BRACE or SEMI) map {
        (control, exp1, exp2, term) ->
        MatchProcessor { ctx ->
            ctx.logMatch("ifControl", control)
            ctx.addSymbol(control, ParseSymbolType.CONTROL, classifier = "", type="", createScope = true)
            exp1.block(ctx)
            exp2?.block?.invoke(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }

    val elseControl by (ELSE or DO or TRY or FINALLY) * optional(Expression) * (O_BRACE or SEMI) map {
        (control, exp1, term) ->
        MatchProcessor { ctx ->
            ctx.logMatch("elseControl", control)
            ctx.addSymbol(control, ParseSymbolType.CONTROL, classifier = "", type="", createScope = true)
            exp1?.block?.invoke(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }

    val elseIfControl by ELSE * (ifControl or elseControl) map {
        MatchProcessor { ctx ->
            ctx.logMatch("elseIfControl", it.t1)
            it.t2.block(ctx)
        }
    }

    val forControl by (FOR or TRY) * -O_PAREN * separated(optional(Expression), SEMI, true) * -C_PAREN * optional(Expression) * (O_BRACE or SEMI) map {
        (control, exps, exp, term) ->
        MatchProcessor { ctx ->
            ctx.logMatch("forControl", control)
            ctx.addSymbol(control, ParseSymbolType.CONTROL, classifier = "", type = "", createScope = true)
            exps.terms.forEach { it?.block?.invoke(ctx) }
            exp?.block?.invoke(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }

    val forLoop by FOR * -O_PAREN * typeSpec * varName * -COLON * Expression * -C_PAREN * optional(Expression) * (O_BRACE or SEMI) map {
        (control, typespec, name, exp1, exp2, term) ->
        MatchProcessor { ctx ->
            ctx.logMatch("forLoop", control)
            ctx.addSymbol(control, ParseSymbolType.CONTROL, classifier = "", type = "", createScope = true)
            val type = typespec.block(ctx, false)
            ctx.addSymbol(name.first, ParseSymbolType.VARIABLE, "", type.name).apply { arrayDim = name.second }
            exp1.block(ctx)
            exp2?.block?.invoke(ctx)
            if (term.type == SEMI) ctx.endScope(term)
        }
    }

    val catchControl by CATCH * -O_PAREN * separated(typeSpec, PIPE) * varName * -C_PAREN * O_BRACE map {
        (control, typespecs, name, _) ->
        MatchProcessor { ctx ->
            ctx.logMatch("catchControl", control)
            ctx.addSymbol(control, ParseSymbolType.CONTROL, classifier = "", type = "", createScope = true)
            typespecs.terms.forEach { ts ->
                val type = ts.block(ctx, false)
                ctx.addSymbol(name.first, ParseSymbolType.VARIABLE, "", type.name).apply { arrayDim = name.second }
            }
        }
    }

    val ControlStatement by optional(statementLabel) * (ifControl or forControl or forLoop or elseIfControl or elseControl or catchControl) map {
        MatchProcessor { ctx ->
            it.t1?.block?.invoke(ctx)
            it.t2.block(ctx)
        }
    }

    val Statement by optional(statementLabel) * optional(Expression) * SEMI map {
        (label, expr, term) ->
        MatchProcessor { ctx ->
            ctx.logMatch("Statement", term)
            label?.block?.invoke(ctx)
            expr?.block?.invoke(ctx)
            if (term.type == O_BRACE) ctx.addSymbol(term, ParseSymbolType.BLOCK, createScope = true)
            if (term.type == C_BRACE) ctx.endScope(term)
        }
    }

    val CloseBlock : Parser<MatchProcessor> by C_BRACE map {
        MatchProcessor { ctx ->
            ctx.logMatch("CloseBlock", it)
            ctx.endScope(it)
        }
    }

    val Rules : Parser<MatchProcessor> = Block or PackageDecl or ImportDecl or TypeDef or ConstructorDef or MethodDef or VarDef or FieldDef or
        ControlStatement or CloseBlock or Statement or Expression

    private fun processToken(context: ParseContext, token: TokenMatch, inComment: Boolean) {
        if (inComment) return
        when (token.type) {
            O_PAREN -> context.parenCount++
            C_PAREN -> context.parenCount--
            O_BRACE -> context.braceCount++
            C_BRACE -> context.braceCount--
            ASSIGN -> context.inAssignment = true
        }
        when (token.type) {
            WS, NL, LINE_COMMENT -> {}
            O_BRACE, SEMI -> {
                context.tokens.add(token)
                processTokens(context, token)
            }
            C_BRACE -> {
                processTokens(context, token)
                context.tokens.add(token)
                processTokens(context, token)
            }
            else -> context.tokens.add(token)
        }
    }

    private fun processTokens(context: ParseContext, token: TokenMatch) {
        if (context.tokens.size == 0) return
        if (context.parenCount > 0) return
        //println("Trying ${context.tokens.first()} -> ${context.tokens.last()}")
        val parsed = Rules.tryParseToEnd(context.tokens.asSequence())
        when (parsed) {
            is Parsed -> {
                parsed.value.block(context)
                context.clear()
            }
            else -> {
                if (token.type != O_BRACE && token.type != C_BRACE) {
                    logger.warn("NO MATCH: (${token.row})\n   ${context.tokens}\n   ${context.tokens.joinToString(" ") { it.text }}")
                    context.setUnmatched()
                    context.clear()
                }
                else {
                    logger.debug("CONTINUING WITH ${token.type}")
                }
            }
        }
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
        }
        context.result.parseTime = System.currentTimeMillis()-start
        return context.result
    }

    override val rootParser: Parser<Any>
        get() = TODO("not implemented") //To change initializer of created properties use File | Settings | File Templates.
}
