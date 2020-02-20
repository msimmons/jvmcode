package net.contrapt.jvmcode.language

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.KotlinModule
import com.github.h0tk3y.betterParse.lexer.Tokenizer
import com.github.h0tk3y.betterParse.parser.Parsed
import com.github.h0tk3y.betterParse.parser.Parser
import com.github.h0tk3y.betterParse.parser.parseToEnd
import com.github.h0tk3y.betterParse.parser.tryParseToEnd
import io.kotlintest.assertSoftly
import io.kotlintest.matchers.numerics.shouldBeLessThanOrEqual
import io.kotlintest.shouldBe
import io.vertx.core.json.Json
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import java.io.File

class JavaParserTest {

    val objectMapper = ObjectMapper().apply {
        registerModule(KotlinModule())
    }

    private fun testParser(tokenizer: Tokenizer, parser: Parser<JavaParser.MatchProcessor>, expression: String) {
        val tokens = tokenizer.tokenize(expression)
        val result = parser.tryParseToEnd(tokens)
        when (result) {
            is Parsed -> result.value.block(ParseContext(JavaParseRequest(file = "", text = "")))
            else -> {
                val t = tokens.joinToString { it.toString() }
                result shouldBe "$expression -> \n   $t"
            }
        }
    }

    @Test
    fun testAnnotationRef() {
        val parser = JavaParser()
        val expressions = listOf(
            "@Annotation",
            "@Annotation()",
            "@Annotation(key=value)",
            "@Annotation(key=value, key=@Inner())",
            "@Annotation({@One, @Two({2,3,4})})",
            "@Annotation({@One, @Two({2,3,4})}, key={1,2,3})"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.annotationRef, it)
        }
    }

    @Test
    fun testConstructorDef() {
        val parser = JavaParser()
        val expressions = listOf(
            "private String() {",
            "String() {",
            "Class(int i, Class<T> j) {"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.ConstructorDef, it)
        }
    }

    @Test
    fun testMethodDef() {
        val parser = JavaParser()
        val expressions = listOf(
            "private void String();",
            "int[] String() {",
            "public synchronized Class<T> Class(int i, Class<T> j);",
            "public <T> void method(Class<T> clazz, T[] values) {",
            "String since() default \"\";",
            "int count()[];",
            "List <Method> getDeclaredPublicMethods (String name, Class<?>... parameterTypes) {",
            "default TimeZone getTimeZone(Date date) {",
            "Class<? extends String> clazz();"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.MethodDef, it)
        }
    }

    @Test
    fun fieldDef() {
        val parser = JavaParser()
        val expressions = listOf(
            "private String[] x",
            "int[] x, y, z[]",
            "public Class<T> clazz",
            "static public int field = 3",
            "@Annotation(name=value) String val",
            "@Annotaion({1,2,3}) int val",
            "private static final ThreadLocal<StringCoding.Result> resultCached = new ThreadLocal<>() { ",
            "char[] buz = {'a','b','c'}"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.FieldDef, it)
        }
    }

    @Test
    fun varDef() {
        val parser = JavaParser()
        val expressions = listOf(
            "var x = 3",
            "var x,y,z = new String()"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.VarDef, it)
        }
    }

    @Test
    fun typeDef() {
        val parser = JavaParser()
        val expressions = listOf(
            "public class Class {",
            "class Class<T> {",
            "class Class<? extends String> {",
            "class Class extends String implements String, Integer, Comparable<String> {",
            "@interface Annotation {",
            "interface Interface extends One, Two, Three {"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.TypeDef, it)
        }
    }

    @Test
    fun controlStatement() {
        val parser = JavaParser()
        val expressions = listOf(
            "if (a==b) {",
            "if (a==b) x=3;",
            "else {",
            "else if (a>b || b<a) {",
            "else doSomething();",
            "for (String x : strings) {",
            "for (String x : strings) doSomething;",
            "for (i=0; i<1; i++) {",
            "for (i=0; i<1; ) doSomething;",
            "for (int i=0; i<1; i++) x = (3+2)*y;",
            "while (x==3 && (new String()).trim() == 3) {",
            "while (true) doSomething;",
            "do {",
            "finally{",
            "try {",
            "try(BufferedReader b = new BufferedReader(); OutputStream ios = System.out) {",
            "catch(Exception e) {",
            "catch(Exception|IOException b) {",
            "else do {",
            "else while(3==3) {"
        )
        expressions.forEach {
            testParser(parser.tokenizer, parser.ControlStatement, it)
        }
    }

    @Test
    fun testExpressions() {
        //java.security.AccessController.doPrivileged ( new java.security.PrivilegedAction < > ( ) { public Void run ( ) { values.setAccessible ( true ) ; return null ; } } )
        val expressions = listOf(
            "new String(\"string\")",
            "x = foo.something() ? 8 + 3 : 15",
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
            "return new String[]{}",
            "x = new Foo()",
            "((String)i).hello(i,jk)[3] = 'c'",
            "new ThreadLocal<>()",
            "return new StringCoding.Result()",
            "'1','a','b','c'",
            "{{1,2,3},{4,5,6},{'a','b','c'}}",
            "{'a','b','c','d','e','f'}",
            "return new String[] {1,2,3}",
            "b.length().trim().subtring(1, 4)",
            "assert d != 1 : \"Unity denominator\"",
            //"java.security.AccessController.doPrivileged(new java.security.PrivilegedAction<>() {",
            "assert cmpFracHalf == 0",
            "0L",
            "07"
        )
        val parser = JavaParser()
        expressions.forEach {
            testParser(parser.tokenizer, parser.Expression, it)
        }
    }

    @Test
    fun testGeneric() {
        val generics = listOf(
            "T",
            "?",
            "? extends String",
            "T extends String",
            "? super Integer & Number",
            "T super Integer & Number",
            "? extends List<String>",
            "T extends Comparable<? super T>"
        )
        val parser = JavaParser()
        generics.forEach {
            testParser(parser.tokenizer, parser.typeParam, it)
        }
    }

    @Test
    fun testJava1() {
        testFile("Test1", 1500, false)
    }

    @Test
    fun testJava2() {
        testFile("Test2", 1000, false)
    }

    @Test
    fun testJava3() {
        testFile("Test3", 1000, false)
    }

    @Test
    fun testJava4() {
        testFile("Test4", 1000, false)
    }

    fun testFile(name: String, parseTime: Long, writeFile: Boolean) {
        val path = javaClass.classLoader?.getResource("$name.javasource")?.path ?: ""
        val json = javaClass.classLoader?.getResource("$name.json")?.readText() ?: ""
        val text = File(path).readText()
        val request = JavaParseRequest(file = path, text = text)
        val parser = JavaParser()
        val result = parser.parse(request)
        val expected = objectMapper.readValue(json, JavaParseResult::class.java)
        if (writeFile) File("$name.json").writeText(Json.encodePrettily(result))
        else {
            assertSoftly {
                compareResults(result, expected)
                result.unmatched.size shouldBe 0
                result.parseTime shouldBeLessThanOrEqual parseTime
            }
        }
    }

    fun compareResults(actual: JavaParseResult, expected: JavaParseResult) {
        actual.symbols.size shouldBe expected.symbols.size
        actual.symbols.forEach {
            if (it.id >= expected.symbols.size) it shouldBe null
            else it shouldBe expected.symbols[it.id]
        }
    }
}