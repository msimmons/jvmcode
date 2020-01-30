package net.contrapt.jvmcode.language

import com.github.h0tk3y.betterParse.parser.Parsed
import com.github.h0tk3y.betterParse.parser.tryParseToEnd
import io.kotlintest.matchers.numerics.shouldBeLessThanOrEqual
import io.kotlintest.shouldBe
import io.vertx.core.json.Json
import org.junit.jupiter.api.Test
import java.io.File

class JavaParserTest {

    @Test
    fun testExpressions() {
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
                    val t = tokens.joinToString { it.toString() }
                    result shouldBe "$it -> \n   $t"
                }
            }
        }
    }

    @Test
    fun testJava1() {
        val path = javaClass.classLoader?.getResource("Test1.javasource")?.path ?: ""
        val text = File(path).readText()
        val request = JavaParseRequest(file = path, text = text)
        val parser = JavaParser()
        val result = parser.parse(request)
        result.parseTime shouldBeLessThanOrEqual 1000
    }

    @Test
    fun testJava2() {
        val path = javaClass.classLoader?.getResource("Test2.javasource")?.path ?: ""
        val text = File(path).readText()
        val request = JavaParseRequest(file = path, text = text)
        val parser = JavaParser()
        val result = parser.parse(request)
        result.parseTime shouldBeLessThanOrEqual 1000
    }

    @Test
    fun testJava3() {
        val path = javaClass.classLoader?.getResource("Test3.javasource")?.path ?: ""
        val text = File(path).readText()
        val request = JavaParseRequest(file = path, text = text)
        val parser = JavaParser()
        val result = parser.parse(request)
        println(Json.encodePrettily(result.symbols))
        result.parseTime shouldBeLessThanOrEqual 1000
    }

    @Test
    fun testJava4() {
        val path = javaClass.classLoader?.getResource("Test4.javasource")?.path ?: ""
        val text = File(path).readText()
        val request = JavaParseRequest(file = path, text = text)
        val parser = JavaParser()
        val result = parser.parse(request)
        println(Json.encodePrettily(result.symbols))
        result.parseTime shouldBeLessThanOrEqual 1000
    }
}