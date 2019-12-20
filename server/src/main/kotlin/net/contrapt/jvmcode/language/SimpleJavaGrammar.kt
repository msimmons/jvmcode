package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.lexer.TokenMatch
import com.github.h0tk3y.betterParse.parser.Parser
import kotlin.system.measureTimeMillis

class SimpleJavaGrammar : Grammar<Any>() {

    // Comments
    val BEGIN_COMMENT by token("/\\*")
    val END_COMMENT by token("\\*/")
    val LINE_COMMENT by token("//.*", ignore = true)

    // Puncuation
    val NL by token("[\r\n]+", ignore = false)
    val WS by token("\\s+", ignore = true)
    val SEMI by token(";", ignore = false)
    val COMMA by token(",", ignore = true)
    val AT by token("@")
    val O_BRACE by token("\\{")
    val C_BRACE by token("}")
    val O_PAREN by token("\\(", ignore = false)
    val C_PAREN by token("\\)", ignore = false)
    val O_BRACKET by token("\\[")
    val C_BRACKET by token("]")

    // Operators
    val OPERATOR by token("[=+-/&|^%<>!~:?]", ignore = true)

    // Keywords
    val PACKAGE by token("package\\b")
    val IMPORT by token("import\\b")

    val MODIFIER by token("(public|private|protected|final|transient|threadsafe|volatile|abstract|native|synchronized|strictfp|inner|static)\\b")
    val DECLARE by token("(class|interface|enum)\\b")
    val VAR by token("var\\b")
    val EXTENDS by token("extends\\b")
    val IMPLEMENTS by token("implements\\b")

    val NEW by token("new\\b")
    val INSTANCEOF by token("instanceof\\b")

    val IF by token("if\\b")
    val ELSE by token("else\\b", ignore = true)
    val SWITCH by token("switch\\b")
    val CASE by token("case\\b", ignore = true)
    val DEFAULT by token("default\\b", ignore = true)
    val FOR by token("for\\b")
    val WHILE by token("while\\b")
    val DO by token("do\\b")
    val TRY by token("try\\b")
    val CATCH by token("catch\\b")
    val FINALLY by token("finally\\b")
    val THROW by token("throw\\b", ignore = true)
    val BREAK by token("break\\b", ignore = true)
    val CONTINUE by token("continue\\b", ignore = true)
    val RETURN by token("return\\b", ignore = true)

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
    val THIS by token("this\\b")
    val SUPER by token("super\\b")
    val WILD_IDENT by  token("[a-zA-Z_\$][.\\w]*[\\w](\\.\\*)")
    val IDENT by token("[a-zA-Z_\$][.\\w]*")
    val OTHER by token(".", ignore = true)

    val DOT by token("\\.")
    val ASTERISK by token("\\*")
    // RULES

    data class ParseExpression(
            var context: TokenMatch? = null,
            var modifiers: MutableCollection<TokenMatch> = mutableListOf(),
            var type: TokenMatch? = null,
            var decltype: TokenMatch? = null,
            var identifier: TokenMatch? = null,
            var extends: TokenMatch? = null,
            var implements: MutableCollection<TokenMatch> = mutableListOf()
    ) {

        fun clear() {
            context = null
            modifiers.clear()
            type = null
            decltype = null
            identifier = null
            extends = null
            implements.clear()
        }
    }

    fun tokenizeOnly(text: String) {
        var tokens = this.tokenizer.tokenize(text)
        var tokenCount = 0
        var inComment = false
        var curExpression = ParseExpression()
        val elapsed = measureTimeMillis {
            tokens.forEach {
                tokenCount++;
                when (it.type) {
                    BEGIN_COMMENT -> inComment = true
                    END_COMMENT -> inComment = false
                    else -> if (!inComment) processToken(it, curExpression)
                }
            }
        }
    }

    private fun createSymbol(expression: ParseExpression) {
        println(expression)
        /*
        val ident = expression.idents.last()
        val name = ident.text
        val start = ident.position
        val end = start + name.length - 1
        val types = when (expression.initial?.type) {
            PACKAGE -> ParseSymbolType.TYPEREF to name
            IMPORT -> ParseSymbolType.TYPEREF to name
            IDENT -> ParseSymbolType.SYMREF to name
            TYPE -> ParseSymbolType.SYMDEF to tokens.first().text
            DECLARE -> ParseSymbolType.TYPEDEF to name
            else -> ParseSymbolType.TYPEREF to name
        }
        val symbol = JavaParseSymbol(name, JavaParseLocation(start, end)).apply {
            symbolType = types.first
            type = types.second
        }
        println("    ${symbol}")
        return symbol
*/
    }

    private fun processToken(token: TokenMatch, expression: ParseExpression) {
        when (token.type) {
            PACKAGE -> expression.context = token
            IMPORT -> expression.context = token
            MODIFIER -> expression.modifiers.add(token)
            DECLARE -> expression.context = token
            VAR -> expression.context = token
            TYPE -> expression.context = token
            AT -> expression.context = token
            EXTENDS, IMPLEMENTS -> expression.context = token
            IDENT, WILD_IDENT -> {
                when (expression.context?.type) {
                    TYPE -> {
                        expression.context = token
                        expression.identifier = token
                    }
                    AT -> expression.identifier = token
                    PACKAGE, IMPORT -> expression.identifier = token
                    DECLARE -> {
                        expression.decltype = expression.context
                        expression.identifier = token
                    }
                    VAR -> {
                        expression.decltype = expression.context
                        expression.identifier = token
                    }
                    EXTENDS -> expression.extends = token
                    IMPLEMENTS -> expression.implements.add(token)
                    null -> {
                        expression.context = token
                        expression.identifier = token
                        expression.type = token
                    }
                }
            }
            SEMI, O_BRACE, C_BRACE, O_PAREN, C_PAREN, OPERATOR -> {
                //if (curTokens.size > 0) println(curTokens)
                if (expression.identifier != null) {
                    createSymbol(expression)
                }
                expression.clear()
            }
        }
    }

    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val grammar = SimpleJavaGrammar()
            grammar.tokenizeOnly(code)
            //grammar.tryParseToEnd(grammar.tokenizer.tokenize(code))
            //grammar.lenientParse(code)
        }

        val code = """
/** hello
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
public class TryIt implements Serializable {

    static {
    }
    
    public TryIt(int a, java.lang.String b[]) {}

    String[][] foo, bar[][];

    void aMethod() {
       int a;
       int b = 0b10_1010100;
       int c, d = '\n';
       char u >>>= '\uaf30';
       int foo = 2 + 3++ - 8 + bar && foo/bar | biz;
       byte bb = x > 2 ? false : 8 +2;
       f = g[0][1];
       f[0] = 3;
       if (8 == 3) {
          g = 1 +3;
          g = this.aMethod();
       }
       for (int i=0; i<1; i++) x = (3+2)*y;
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
    }
    
    @MethodAnnotation
    public <T extends String<T>> int genericMethod(Class<T> clazz[]);
    
    static class AnInnerOne<T extends List<String>> {
       public AnInnerOne(@JsonName("foo") int foo)
    }

}
        """.trimIndent()
    }

    override val rootParser: Parser<Any>
        get() = TODO("not implemented") //To change initializer of created properties use File | Settings | File Templates.
}
