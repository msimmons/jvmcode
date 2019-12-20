package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.grammar.Grammar
import com.github.h0tk3y.betterParse.lexer.TokenMatch
import com.github.h0tk3y.betterParse.parser.Parser
import java.io.File
import java.util.*
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
    val THROWS by token("throws\\b")
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

    val currentTokens = mutableListOf<TokenMatch>()
    val regexes = listOf(
        "Pn;".toRegex() to "package",
        "IM?n;".toRegex() to "import",
        "M*Dn(<.*>)?[En<>,]*\\{".toRegex() to "typeDef",
        "@n(\\(.*\\))?".toRegex() to "annotation",
        "M*n\\(.*\\)(W[n,]*)?[{]".toRegex() to "constructorDef",
        "M*(<(.*)>)?[Tn](\\[])*n\\(.*\\)(W[n,]*)?[{;]".toRegex() to "methodDef",
        "M*[Tn](\\[])*n[,n\\[\\]]*(=.*)?;".toRegex() to "fieldDef",
        "n(\\[.])*[-<>+&]*=.*[;]".toRegex() to "assignment",
        "R(.*)[;]".toRegex() to "return",
        "C(.*)[;{]".toRegex() to "control"
    )

    fun tokenizeOnly(text: String) {
        var tokens = this.tokenizer.tokenize(text)
        var tokenCount = 0
        var inComment = false
        val elapsed = measureTimeMillis {
            tokens.forEach {
                tokenCount++;
                when (it.type) {
                    BEGIN_COMMENT -> inComment = true
                    END_COMMENT -> inComment = false
                    else -> if (!inComment) processToken(it)
                }
            }
        }
    }

    private fun charForToken(token: TokenMatch) : String {
        return when (token.type) {
            MODIFIER -> "M"
            PACKAGE -> "P"
            IMPORT -> "I"
            DECLARE -> "D"
            TYPE -> "T"
            EXTENDS, IMPLEMENTS -> "E"
            IF, ELSE, FOR, WHILE, DO, TRY, CATCH, FINALLY, BREAK, CONTINUE, THROW, SWITCH, CASE, DEFAULT -> "C"
            NEW -> "N"
            RETURN -> "R"
            INSTANCEOF -> "F"
            THROWS -> "W"
            IDENT, WILD_IDENT, THIS, SUPER -> "n"
            CHAR_LITERAL, BIN_LITERAL, HEX_LITERAL, NUM_LITERAL, STRING_LITERAL, UNICODE_LITERAL, OCT_LITERAL, TRUE, FALSE, NULL -> "l"
            else -> token.text
        }
    }
    private fun processTokens(terminating: TokenMatch? = null) {
        if (!currentTokens.isEmpty()) {
            val term = if (terminating != null) charForToken(terminating) else ""
            val pattern = currentTokens.joinToString("") { charForToken(it) } + term
            val match = regexes.firstOrNull { it.first.matches(pattern) }
            println("$pattern -> ${match?.second} ${currentTokens.first().row}")
        }
        currentTokens.clear()
    }

    private fun processToken(token: TokenMatch) {
        when (token.type) {
            SEMI, O_BRACE, C_BRACE -> { processTokens(token) }
            WS, LINE_COMMENT -> {}
            NL -> if (currentTokens.firstOrNull()?.type == AT) processTokens()
            else -> currentTokens.add(token)
        }
    }

    companion object {
        @JvmStatic
        fun main(args: Array<String>) {
            val grammar = SimpleJavaGrammar()
            val path = "/Users/mark.simmons/work/jvmcode/server/src/test/resources/Test.java"
            grammar.tokenizeOnly(code)
            //grammar.tokenizeOnly(File(path).readText())
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
public class TryIt extends Object implements Serializable, Comparable {

    static {
    }
    
    public TryIt(int a, java.lang.String b[]) {}

    String[][] foo, bar[][];

    private void aMethod() {
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
    public abstract <T extends String<T>> int genericMethod(Class<T> clazz[]);
    
    static class AnInnerOne<T extends List<String>> {
       public AnInnerOne(@JsonName("foo") int foo)
    }

}
        """.trimIndent()
    }

    override val rootParser: Parser<Any>
        get() = TODO("not implemented") //To change initializer of created properties use File | Settings | File Templates.
}
