package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.lexer.TokenMatch
import com.github.h0tk3y.betterParse.parser.Parser
import io.vertx.core.logging.LoggerFactory
import io.vertx.core.shareddata.Shareable
import net.contrapt.jvmcode.model.LanguageParser
import net.contrapt.jvmcode.model.ParseRequest
import net.contrapt.jvmcode.model.ParseResult
import net.contrapt.jvmcode.model.ParseSymbolType
import java.io.File
import java.util.*

class JavaParser : Grammar<Any>(), LanguageParser, Shareable {

    private val logger = LoggerFactory.getLogger(javaClass)

    // Comments
    val BEGIN_COMMENT by token("/\\*")
    val END_COMMENT by token("\\*/")
    val LINE_COMMENT by token("//.*")

    // Puncuation
    val NL by token("[\r\n]+")
    val WS by token("\\s+")
    val SEMI by token(";")
    val COLON by token(":")
    val COMMA by token(",")
    val AT by token("@")
    val O_BRACE by token("\\{")
    val C_BRACE by token("}")
    val O_PAREN by token("\\(")
    val C_PAREN by token("\\)")
    val O_BRACKET by token("\\[")
    val C_BRACKET by token("]")

    // Operators
    val OPERATOR by token("(==|!=|<=|>=|&&|\\|\\|)")
    val ASSIGN by token("(>>>|<<|>>|\\|\\||-|\\+|\\*|/|%|\\^|&)?=")

    val GT by token(">")
    val LT by token("<")

    // Keywords
    val PACKAGE by token("package\\b")
    val IMPORT by token("import\\b")

    val MODIFIER by token("(public|private|protected|final|transient|threadsafe|volatile|abstract|native|strictfp|inner|static)\\b")
    val DECLARE by token("(class|interface|enum)\\b")
    val VAR by token("var\\b")
    val EXTENDS by token("extends\\b")
    val IMPLEMENTS by token("implements\\b")

    val NEW by token("new\\b")
    val INSTANCEOF by token("instanceof\\b")

    val THROWS by token("throws\\b")

    val THROW by token("throw\\b")
    val RETURN by token("return\\b")

    val GOTO by token("(break|continue)\\b")
    val LABEL by token("(case|default)\\b")
    val CONTROL by token("(if|else|switch|for|while|do|try|catch|finally|synchronized)\\b")
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

    private fun charForToken(token: TokenMatch?) : String {
        return when (token?.type) {
            null -> ""
            MODIFIER -> "M"
            PACKAGE -> "P"
            IMPORT -> "I"
            DECLARE -> "D"
            TYPE -> "T"
            VAR -> "V"
            EXTENDS, IMPLEMENTS -> "E"
            CONTROL -> "C"
            GOTO -> "G"
            LABEL -> "L"
            NEW -> "N"
            RETURN, THROW -> "R"
            INSTANCEOF -> "o"
            THROWS -> "W"
            IDENT, WILD_IDENT -> "n"
            CHAR_LITERAL, BIN_LITERAL, HEX_LITERAL, NUM_LITERAL, STRING_LITERAL, UNICODE_LITERAL, OCT_LITERAL, TRUE, FALSE, NULL -> "l"
            ASSIGN -> "="
            OTHER, OPERATOR -> "o"
            else -> token.text
        }
    }

    abstract class ParseRule {

        val PARAMS_RE = "\\(.*\\)"

        fun matches(pattern: String): MatchResult? {
            return rule.matchEntire(pattern)
        }

        fun addThis(context: ParseContext, group: MatchGroup, symbolType: ParseSymbolType) {
            val token = context.tokens[group.range.first]
            val name = "this"
            val start = token.position
            val end = token.position
            val id = context.nextId()
            val symbol = JavaParseSymbol(id, name, "", JavaParseLocation(start, end)).apply {
                this.type = token.text
                this.symbolType = symbolType
                parent = context.scopeId()
            }
            context.add(symbol)
        }

        fun addSymbol(context: ParseContext, group: MatchGroup, symbolType: ParseSymbolType, classifier: String = "", type: String? = null) : JavaParseSymbol {
            val token = context.tokens[group.range.first]
            return addSymbol(context, token, symbolType, classifier, type)
        }

        fun addSymbol(context: ParseContext, token: TokenMatch, symbolType: ParseSymbolType, classifier: String = "", type: String? = null): JavaParseSymbol {
            val name = token.text
            val start = token.position
            val end = start + name.length - 1
            val id = context.nextId()
            val symbol = JavaParseSymbol(id, name, classifier, JavaParseLocation(start, end)).apply {
                this.type = type ?: name
                this.symbolType = symbolType
                parent = context.scopeId()
            }
            context.add(symbol)
            val padding = "  ".repeat(context.scopes.size)
            //println("$padding:$token:$symbol")
            return symbol
        }

        fun addSymbolRef(context: ParseContext, token: TokenMatch) {
            val names = token.text
            var offset = 0
            names.split(".").forEachIndexed { i, n ->
                val start = token.position + offset
                val end = start + n.length - 1
                offset = offset + n.length + 1
                val id = context.nextId()
                val symbol = JavaParseSymbol(id, n, "", JavaParseLocation(start, end)).apply {
                    this.type = type ?: name
                    this.symbolType = ParseSymbolType.SYMREF
                    parent = context.scopeId()
                    caller = if (i == 0) null else id - 1
                }
                //println("   ${token.text} $offset $symbol")
                context.add(symbol)
            }
        }

        abstract val re: String
        abstract val rule: Regex
        open fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {}
        open fun createSymbols(context: ParseContext, group: MatchGroup?) : List<JavaParseSymbol> { return listOf() }
    }

    val Block = object : ParseRule() {
        override val re = "(M)?[{]"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            val block = addSymbol(context, context.tokens.first(), ParseSymbolType.BLOCK).apply {
                type = "<block>"
            }
            context.startScope(block)
        }
    }

    val Annotation = object : ParseRule() {
        override val re = "@n(?:\\(.*\\))?"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?) : List<JavaParseSymbol> {
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val n = if (i+1 < group.value.length-1) group.value[i+1] else ' '
                val t = context.tokens[j]
                val symbolType = if (n == '=') ParseSymbolType.SYMREF else ParseSymbolType.TYPEREF
                when (c) {
                    'n' -> addSymbol(context, t, symbolType)
                }
            }
            return listOf()
        }
    }

    val Generic = object : ParseRule() {
        override val re = "<.*>"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?) : List<JavaParseSymbol> {
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                when (c) {
                    'n' -> addSymbol(context, t, ParseSymbolType.TYPEREF)
                }
            }
            return listOf()
        }
    }

    val Dimension = object : ParseRule() {
        override val re = "(?:\\[])*"
        override val rule = re.toRegex()
    }

    val Extends = object : ParseRule() {
        override val re = "[En<>,?]*"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?) : List<JavaParseSymbol> {
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                when (c) {
                    'n' -> addSymbol(context, t, ParseSymbolType.TYPEREF)
                }
            }
            return listOf()
        }
    }

    /** The left hand side of an assignment */
    val Lhs = object : ParseRule() {
        override val re = "[NTn(o][Tnlo:.,()<>\\[\\]]*="
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?): List<JavaParseSymbol> {
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                when (c) {
                    'n' -> addSymbolRef(context, t)
                }
            }
            return listOf()
        }
    }

    /** The right hand side of an assignment or a standalone expression */
    val Rhs = object : ParseRule() {
        override val re = "[Nnl(o{][NTnl.,()o:<>=\\[\\]]*"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?): List<JavaParseSymbol> {
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                when (c) {
                    'n' -> addSymbolRef(context, t)
                }
            }
            return listOf()
        }
    }

    val ValueList = object : ParseRule() {
        override val re = "${Rhs.re}[}]?"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?): List<JavaParseSymbol> {
            return Rhs.createSymbols(context, group)
        }
    }

    val Params = object : ParseRule() {
        override val re = "\\([@Tnl=()<E?o>,.\\[\\]]*\\)"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?) : List<JavaParseSymbol> {
            val symbols = mutableListOf<JavaParseSymbol>()
            var parenCount = -1
            var annotationCount = 0
            var fieldType: JavaParseSymbol? = null
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                when (c) {
                    '(', '<' -> parenCount++
                    ')', '>' -> parenCount--
                    '@' -> annotationCount++
                    'T', 'n' -> {
                        if (annotationCount > 0) {
                            symbols.add(addSymbol(context, t, ParseSymbolType.TYPEREF))
                            annotationCount--
                        }
                        else if (parenCount > 0) symbols.add(addSymbol(context, t, ParseSymbolType.TYPEREF))
                        else if (fieldType == null) {
                            fieldType = addSymbol(context, t, ParseSymbolType.TYPEREF)
                            symbols.add(fieldType as JavaParseSymbol)
                        }
                        else {
                            symbols.add(addSymbol(context, t, ParseSymbolType.VARIABLE, "", fieldType?.name))
                        }
                    }
                    ',' -> {
                        parenCount = 0
                        annotationCount = 0
                        fieldType = null
                    }
                }
            }
            return symbols.toList()
        }
    }

    val Throws = object : ParseRule() {
        override val re = "Wn(?:,n)*"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?) : List<JavaParseSymbol> {
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                when (c) {
                    'n' -> addSymbol(context, t, ParseSymbolType.TYPEREF)
                }
            }
            return listOf()
        }
    }

    val PackageDecl = object : ParseRule() {
        override val re = "Pn;"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            val token = context.tokens.first { it.type == IDENT }
            context.result.pkg = addSymbol(context, token, ParseSymbolType.PACKAGE).apply {
                type = "<package>"
            }
        }
    }

    val ImportDecl = object : ParseRule() {
        override val re = "I(M)?n;"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            val token = context.tokens.first { it.type == IDENT || it.type == WILD_IDENT }
            context.result.imports.add(addSymbol(context, token, ParseSymbolType.IMPORT).apply {
                isWild = token.text.endsWith("*")
                isStatic = !match.groupValues[1].isEmpty()
                type = "<import>"
            })
        }
    }

    val TypeDef = object : ParseRule() {
        override val re = "(${Annotation.re})*(M*)(D)(n)(${Generic.re})?(${Extends.re})[{]"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            Annotation.createSymbols(context, match.groups[1])
            val typeGroup = match.groups[3]
            val symbolType = if (typeGroup != null) {
                when(context.tokens[typeGroup.range.first].text) {
                    "class" -> ParseSymbolType.CLASS
                    "interface" -> ParseSymbolType.INTERFACE
                    "enum" -> ParseSymbolType.ENUM
                    else -> ParseSymbolType.OBJECT
                }
            }
            else {
                ParseSymbolType.OBJECT
            }
            val typedef = addSymbol(context, match.groups[4]!!, symbolType, match.groupValues[5])
            Generic.createSymbols(context, match.groups[5])
            context.startScope(typedef)
            addThis(context, match.groups[4]!!, symbolType)
            Extends.createSymbols(context, match.groups[6])
        }
    }

    val ConstructorDef = object : ParseRule() {
        override val re = "(${Annotation.re})*(M*)(n)(${Params.re})(${Throws.re})?[{]"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            Annotation.createSymbols(context, match.groups[1])
            val ident = addSymbol(context, match.groups[3]!!, ParseSymbolType.CONSTRUCTOR)
            Throws.createSymbols(context, match.groups[3])
            context.startScope(ident)
            val params = Params.createSymbols(context, match.groups[4])
            ident.classifier = "(" + params.filter { it.symbolType == ParseSymbolType.TYPEREF }.joinToString { it.name } + ")"
        }
    }

    val MethodDef = object : ParseRule() {
        override val re = "(${Annotation.re})*(M*)(${Generic.re})?([Tn])(${Generic.re})?(${Dimension.re})(n)(${Params.re})(${Throws.re})?[{;]"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            Annotation.createSymbols(context, match.groups[1])
            Generic.createSymbols(context, match.groups[3])
            val type = addSymbol(context, match.groups[4]!!, ParseSymbolType.TYPEREF)
            Generic.createSymbols(context, match.groups[5])
            val ident = addSymbol(context, match.groups[7]!!, ParseSymbolType.METHOD, type.name)
            Throws.createSymbols(context, match.groups[9])
            context.startScope(ident)
            val params = Params.createSymbols(context, match.groups[8])
            ident.classifier = "(" + params.filter { it.symbolType == ParseSymbolType.TYPEREF }.joinToString { it.name } + ")"
            ident.arrayDim = match.groupValues[6]
            if (terminating?.type == SEMI) context.endScope(terminating)
        }
    }

    val FieldDef = object : ParseRule() {
        override val re = "(${Annotation.re})*(M*)([VTn])(${Generic.re})?(${Dimension.re})(n${Dimension.re})(,n${Dimension.re})*(=${Rhs.re})?[{;]?"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            Annotation.createSymbols(context, match.groups[1])
            val type = if (match.groups[3]?.value == "V") null else addSymbol(context, match.groups[3]!!, ParseSymbolType.TYPEREF)
            Generic.createSymbols(context, match.groups[4])
            val symbolType = if (context.inType()) ParseSymbolType.FIELD else ParseSymbolType.VARIABLE
            addSymbol(context, match.groups[6]!!, symbolType, "", type?.name).apply {
                arrayDim = match.groupValues[5]
            }
            val fieldList = match.groups[7]
            fieldList?.range?.forEachIndexed { i, j ->
                val c = fieldList.value[i]
                val t = context.tokens[j]
                when (c) {
                    'n' -> addSymbol(context, t, symbolType, "", type?.name).apply { arrayDim = match.groupValues[5] }
                }
            }
            Rhs.createSymbols(context, match.groups[8])
            if (terminating?.type == O_BRACE) context.startScope(addSymbol(context, terminating, ParseSymbolType.BLOCK))
        }
    }

    val Statement = object : ParseRule() {
        override val re = "(${Lhs.re})?(${Rhs.re})?[{;]?"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            Lhs.createSymbols(context, match.groups[1])
            Rhs.createSymbols(context, match.groups[2])
            if (terminating?.type == O_BRACE) context.startScope(addSymbol(context, terminating, ParseSymbolType.BLOCK))
        }
    }

    val FinalStatement = object : ParseRule() {
        override val re = "R(${Rhs.re})?[;{]?"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            Rhs.createSymbols(context, match.groups[1])
        }
    }

    val ControlParams = object : ParseRule() {
        override val re = "\\(.*\\)"
        //override val re = "\\([NTnl=;:,.<>o()\\[\\]]*\\)"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, group: MatchGroup?): List<JavaParseSymbol> {
            val stripped = group?.value?.replaceFirst("(", "")?.trimEnd(')')
            val patterns = stripped?.split(";")
            patterns?.forEach {
                val match = findMatch(it)
                println("    $it ${match?.first} ${match?.second}")
            }
            group?.range?.forEachIndexed { i, j ->
                val c = group.value[i]
                val t = context.tokens[j]
                //println("    $c $t")
            }
            return listOf()
        }
    }

    val ControlStatement = object : ParseRule() {
        override val re = "C+(${ControlParams.re})?[RG]?(${Lhs.re})?(${Rhs.re})?[{;]"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            val symbol = addSymbol(context, context.tokens.first(), ParseSymbolType.CONTROL).apply {
                type = "<control>"
            }
            context.startScope(symbol)
            ControlParams.createSymbols(context, match.groups[1])
            Lhs.createSymbols(context, match.groups[2])
            Rhs.createSymbols(context, match.groups[3])
            if (terminating?.type == SEMI) context.endScope(terminating)
        }
    }

    val Label = object : ParseRule() {
        override val re = "([Ln][ln]?):"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            if (match.groups[1]?.value == "n") {
                addSymbol(context, match.groups[1]!!, ParseSymbolType.VARIABLE)
            }
        }
    }

    val Goto  = object : ParseRule() {
        override val re = "G(n)?[;]"
        override val rule = re.toRegex()
        override fun createSymbols(context: ParseContext, match: MatchResult, terminating: TokenMatch?) {
            if (match.groups[1]?.value == "n") {
                addSymbol(context, match.groups[1]!!, ParseSymbolType.SYMREF)
            }
        }
    }

    val rules = listOf(
        Block,
        Label,
        Goto,
        PackageDecl,
        ImportDecl,
        ConstructorDef,
        TypeDef,
        MethodDef,
        FieldDef,
        FinalStatement,
        ControlStatement,
        Statement,
        ValueList
    )

    data class ParseContext(
        val request: JavaParseRequest,
        val result: JavaParseResult = JavaParseResult(file = request.file),
        var parenCount: Int = 0,
        var inAssignment: Boolean = false,
        val tokens: MutableList<TokenMatch> = mutableListOf(),
        val scopes: Stack<JavaParseSymbol> = Stack()
    ) {
        private val logger = LoggerFactory.getLogger(javaClass)
        fun nextId() = result.symbols.size
        fun scopeId() = if (scopes.empty()) -1 else scopes.peek().id
        fun inType() : Boolean {
            return if (scopes.empty()) false
            else when(scopes.peek().symbolType) {
                ParseSymbolType.OBJECT, ParseSymbolType.ENUM, ParseSymbolType.INTERFACE, ParseSymbolType.CLASS -> true
                else -> false
            }
        }
        fun add(symbol: JavaParseSymbol) {
            //println(symbol)
            result.symbols.add(symbol)
            if (!scopes.empty()) scopes.peek().children.add(symbol.id)
        }

        fun startScope(symbol: JavaParseSymbol) {
            //println("Start Scope: ${symbol}")
            scopes.push(symbol)
        }

        fun endScope(token: TokenMatch) {
            if (!scopes.empty()) {
                val scope = scopes.pop()
                scope.scopeEnd = JavaParseLocation(token.position, token.position)
                //println("End Scope: ${scope}")
            }
        }

        fun clear() {
            inAssignment = false
            tokens.clear()
        }
    }

    override fun parse(request: ParseRequest) : ParseResult {
        val context = ParseContext(request as JavaParseRequest)
        var tokens = this.tokenizer.tokenize(request.text ?: "")
        var inComment = false
        tokens.forEach {
            when (it.type) {
                BEGIN_COMMENT -> inComment = true
                END_COMMENT -> inComment = false
                else -> if (!inComment) processToken(context, it)
            }
        }
        return context.result
    }

    private fun processToken(context: ParseContext, token: TokenMatch) {
        when (token.type) {
            O_BRACE -> processTokens(context, token)
            C_BRACE -> processTokens(context, token)
            O_PAREN -> {context.parenCount++; context.tokens.add(token)}
            C_PAREN -> {context.parenCount--; context.tokens.add(token)}
            SEMI -> processTokens(context, token)
            COLON -> processTokens(context, token)
            ASSIGN, RETURN, THROW -> processTokens(context, token)
            LINE_COMMENT -> {}
            NL -> {}
            WS -> {}
            else -> context.tokens.add(token)
        }
    }

    private fun findMatch(pattern: String) : Pair<ParseRule, MatchResult>? {
        var matchResult: MatchResult? = null
        val rule = rules.firstOrNull {
            matchResult = it.matches(pattern)
            matchResult != null
        }
        if (rule != null && matchResult != null) return  rule to matchResult!!
        else return null
    }

    private fun processTokens(context: ParseContext, terminating: TokenMatch? = null) {
        if (terminating != null) context.tokens.add(terminating)
        when (terminating?.type) {
            SEMI -> if (context.parenCount > 0) return
            COLON -> if (context.inAssignment || context.parenCount > 0) return
            ASSIGN -> {context.inAssignment = true && context.parenCount == 0; return}
            RETURN, THROW -> {context.inAssignment = true; return}
            O_PAREN -> {context.parenCount++; return}
            C_PAREN -> {context.parenCount--; return}
        }
        if (!context.tokens.isEmpty()) {
            val pattern = context.tokens.joinToString("") { charForToken(it) }
            val row = context.tokens.first().row
            val match = findMatch(pattern)
            if (match != null) {
                //println("[$row]: $pattern -> ${rule.javaClass.simpleName}")
                match.first.createSymbols(context, match.second, terminating)
            }
            else if (terminating == null) {
                return
            }
            else if (pattern != "}"){
                println("=== UNMATCHED PATTERN: [$row]: $pattern  ====")
            }
        }
        if (terminating?.type == C_BRACE) context.endScope(terminating)
        context.clear()
    }

    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val parser = JavaParser()
            val path = "/home/mark/work/jvmcode/server/src/test/resources/Test.java"
            val text = File(path).readText()
            val request = JavaParseRequest(file = path, text = text)
            //val result = parser.parse(request)
            val result = parser.parse(request)
/*
            result.symbols.filter { !listOf(ParseSymbolType.TYPEREF, ParseSymbolType.CONTROL, ParseSymbolType.SYMREF).contains(it.symbolType) }
                .forEach { println(it) }
*/

        }

        val code = """
/** 
 * hello
 a multiline comment here
 and more
 and more
 *
 */
package net.contrapt.jvmcode.language;

import java.math.BigDecimal;
import java.math.*;
import static net.contrapt.FOO;

@ClassAnnotation(value="foo")
public class TryIt extends Object implements Serializable, Comparable {

    static {
       System.properties.set("name", "value");
    }
    
    public TryIt(int a, java.lang.String b[]) {}

    String[][] foo, bar[][];

    private abstract Integer abstractMethod(int p1, String[] p2);

    private void aMethod(int a, String b, @ann("bar") Long c) {
       tl.set(new SoftReference<>(ob));
       v = 3;
       v += 3;
       v -= 3;
       v >>>=3;
       v *= 3;
       v /= 3;
       v %=3;
       v <<=3;
       v >>=3;
       v &= 3;
       v ^= 3;
       // Operator
       v && 3;
       v || 3;
       v > 3;
       v < 3;
       v <= 3;
       v != 3;
       v >= 3;
       v == 3;
       b.length().trim().subtring(1, 4);
       @JsonProperty("foo") int a;
       int b = 0b10_1010100;
       int c, d = '\n';
       char u >>>= '\uaf30';
       int foo = 2 + 3++ - 8 + bar && foo/bar | biz;
       byte[] bb = x > 2 ? false : 8 +2;
       f = g[0][1];
       f[0] = 3;
       if (8 == 3) {
          g = 1 +3;
          g = this.aMethod();
       }
       for (int i=0; i<1; i++) x = (3+2)*y;
       for ( String s : strings) {
          doSomething(s);
       }
       x = new Foo();
       x.doSomething(x, y, foo());
       y = x.aField;
       try {
           while (x == y) {
              doSomething();
           }
       }
       catch (Exception e) {
          System.println("hello");
       }
       finally {
          somethingElse();
       }
        if (isLatin1()) {
            for (int i = 0; i < n; i++) {
                if ((val[i] & 0xff) != cs.charAt(i)) {
                    return false;
                }
            }
        } else {
            if (!StringUTF16.contentEquals(val, cs, n)) {
                return false;
            }
        }
        return new String[] {"a", "b", variable, "d"};
        return true;
    }
    
    @MethodAnnotation
    public abstract <T extends String<T>> int genericMethod(Class<T> clazz[]) throws IllegalStateException;
    
    static class AnInnerOne<T extends List<String>> {
       public AnInnerOne(@JsonName("foo") int foo) {
       
          i == 3;
          ((String)i).hello(i,jk)[3] = 'c';
          switch(3) {
             case 8:
                x = 8 +3; 
                break;
             case 7:
             default:
          }
       }
    }
    
     private static final ThreadLocal<StringCoding.Result>
            resultCached = new ThreadLocal<>() {
                protected StringCoding.Result initialValue() {
                    return new StringCoding.Result();
                }};

     ;

}

package org.slf4j.event;

import org.slf4j.Marker;

/**
 * 
 * @author ceki
 * @since 1.7.15
 */
public interface LoggingEvent {

    Level getLevel();

    Marker getMarker();

    String getLoggerName();

    String getMessage();

    String getThreadName();

    Object[] getArgumentArray();

    long getTimeStamp();

    Throwable getThrowable();

}
enum MyEnum {
   ONE,
   TWO,
   TRHEE
}
/*
null
*/
        """.trimIndent()
    }

    override val rootParser: Parser<Any>
        get() = TODO("not implemented") //To change initializer of created properties use File | Settings | File Templates.
}
