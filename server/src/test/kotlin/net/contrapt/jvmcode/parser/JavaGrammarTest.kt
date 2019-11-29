package net.contrapt.jvmcode.parser

import com.github.h0tk3y.betterParse.grammar.parseToEnd
import com.github.h0tk3y.betterParse.parser.AlternativesFailure
import com.github.h0tk3y.betterParse.parser.ParseException
import com.github.h0tk3y.betterParse.parser.ParseResult
import com.github.h0tk3y.betterParse.parser.Parsed
import org.junit.jupiter.api.Test

class JavaGrammarTest {

    @Test
    fun basicTest() {
        try {
            val parsed = JavaGrammar.parseToEnd(getJava())
            println(parsed)
        } catch(e: ParseException) {
            println(e.errorResult)
        }
    }

    @Test
    fun lineTest() {
        var tokens = JavaGrammar.tokenizer.tokenize(getJava())
        while(true) {
            val parsed : ParseResult<Any> = JavaGrammar.lineParser.tryParse(tokens)
            when (parsed) {
                is Parsed<Any> -> tokens = parsed.remainder
                is AlternativesFailure -> {
                    tokens = tokens.drop(1)
                    if (!tokens.any()) return
                }
            }
            println(parsed)
        }
    }

    fun getJava() : String {
        return """
package net;

import net.contrapt.service.Something;
import net.contrapt;
import static net.contrapt.foo.*;

@Component(name=foo, bar=gaz, other = @Inner())
public abstract class MyClass extends foo.bar.Baz {
   String foo = bar;

   private java.lang.String aFun() {}

   public static Integer anotherFun(@Ann() String p1) {}

   @MethodAnn
   protected void annotatedMethod() {
      this.method((int)foo);
   }

   @ArrayAnnotation(foo=a, b=@Inner(a=b))
   private static inner class Inner {
   }
}
    """.trimIndent()
    }
}