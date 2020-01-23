package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.parser.Parsed
import com.github.h0tk3y.betterParse.parser.tryParseToEnd
import org.junit.jupiter.api.Test

class JavaParserTest {

    @Test
    fun testExpression() {
        val expressions = listOf(
            "new String(\"string\")",
            "x = foo.something() ? 8 + 3 : 15",
            "String x : strings.trim(4)",
            "int i=0",
            "i < 0",
            "i++",
            "String foo, bar = \"hello\"",
            "case x: break",
            "return new String()",
            "throw new Exception()",
            "break theLabel",
            "((Integer)x.help()).me()",
            "3+(4-2)/(getSomething()).other()-40",
            "(val[i] & 0xff) != cs.charAt(i)",
            "return new String[]",
            "x = new Foo()",
            "((String)i).hello(i,jk)[3] = 'c'",
            "new ThreadLocal<>()",
            "return new StringCoding.Result()"
        )
        val request = JavaParseRequest(file = "", text = "")
        val parser = JavaParser()
        expressions.forEach {
            val tokens = parser.tokenizer.tokenize(it)
            val result = parser.expression.tryParseToEnd(tokens)
            when (result) {
                is Parsed -> result.value.block(ParseContext(request))
                else -> {
                    println(it)
                    println("  NO MATCH: ${tokens.joinToString { it.toString() }} for $it")
                }
            }
        }
    }
}