import { Grammar, ParseContext } from '../src/java_language/java_grammar'
import { JavaParser } from '../src/java_language/java_parser'
import * as fs from 'fs'
import { PerformanceObserver, performance } from 'perf_hooks'

let performanceObserver = new PerformanceObserver((entryList) => {
    entryList.getEntries().forEach(entry => {
        console.debug(`${entry.name}: ${entry.duration}ms`)
        performance.clearMarks(entry.name)
    })
})
performanceObserver.observe({entryTypes: ['measure']})

let parser = new JavaParser()
let special = `
if (((regex.value.length == 1 &&
    ".$|()[{^?*+\\".indexOf(ch = regex.charAt(0)) == -1) ||
    (regex.length() == 2 &&
          regex.charAt(0) == '\\' &&
          (((ch = regex.charAt(1))-'0')|('9'-ch)) < 0 &&
          ((ch-'a')|('z'-ch)) < 0 &&
          ((ch-'A')|('Z'-ch)) < 0)) &&
    (ch < Character.MIN_HIGH_SURROGATE ||
          ch > Character.MAX_LOW_SURROGATE))
`
let text = `
;;;
;
 
// Hello
/** comment */
/*multi line comment
*/
// single line comment
package   foo.bar.baz;
 import foo.bar.baz  
import foo.bar.baz.*
@Anno
@Anno(  )
@Anno()
@Anno(foo)
@Anno(foo=bar)
 @Anno(foo=@Nested(a)) 
@Anno(bar=foo)
@Anno(3.3)
public class Foo
public class Foo< T, V extends String & Int>
public Foo(int a, double b)
public final int[] bytes[]
static java.lang.Comparator<String> mine[] = anytin gyou want
private var myVar = foo
public void myMethod()
int[] doIt()[]
`

let blockText = `
init {    nothing special    }
    class {
        more {
            body();
            doIt;
        }
    }
    {
        help me
    }
    if (foo==bar) {}
    else {}
}
`
function handleResult(result:any) {
    console.log(result)
    if (!result.status) {
        console.log(result.expected)
    }
    else {
        result.value(new ParseContext({file: '', languageId: 'java', text: ''}))
    }
}

function testSpecial() {
    handleResult(Grammar.Blocks.parse(special))
}

function testTypeDef() {
    [
        'public class TryIt extends Object implements Serializable, Comparable<TryIt> ',
        '@ClassAnnotation(value=@Nested("foo"), value2=bar)\npublic class TryIt extends Object implements Serializable, Comparable'
    ].forEach(td => {
        handleResult(Grammar.Defs.parse(td))
    })
}

function testFieldDef() {
    [
        "char u >>>= '\\u0000';"
    ].forEach(td => {
        handleResult(Grammar.FieldDef.parse(td))
    })
}

function testMethodDef() {
    [
        "static <X> void main(String[] args, Class<X> x)"
    ].forEach(td => {
        handleResult(Grammar.MethodDef.parse(td))
    })
}

function testAnnotation() {
    [
        '@ClassAnnotation(value=@Nested("foo"), value2=bar)',
        '@ClassAnnotation(value=@Nested("foo"), value2=bar)\n@Anno'
    ].forEach(a => {
        handleResult(Grammar.Annotations.parse(a))
    })
}

function testComment() {
    let comment = `/** 
    sdfj
    *sflkj

    */`
    console.log(Grammar.Comment.parse(comment))
}

function testLineComment() {
    [
        '//@ClassAnnotation(value=@Nested("foo"), value2=bar)'
    ].forEach(a => {
        handleResult(Grammar.LineComment.parse(a))
    })
}

function testDefs() {
    [
        'synchronized (a) ',
        'static',
        'synchronized ',
        'for (',
        'return;',
        'else if (foo===bar)'
    ].forEach(a => {
        handleResult(Grammar.Defs.parse(a))
    })
}

//testTypeDef()
//testMethodDef()
//testFieldDef()
//testAnnotation()
//testAssignment()
//testMethodCall()
//testComment()
//testLineComment()
//testDefs()
testFile()
//testSpecial()


function testFile() {
    let start = new Date()
    let filename = 'server/src/test/resources/Test1.javasource'
    let data = fs.readFileSync(filename)
    //console.log(Grammar.Blocks.parse(data.toString()))
    let result = parser.parse({text: data.toString(), file: filename, languageId: 'java'}, false)
    //console.log(result.symbols)
}