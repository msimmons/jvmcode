import * as P from 'parsimmon'
import { Node } from 'parsimmon'
import { ParseSymbolType, ParseSymbol, ParseRequest, ParseResult } from '../language_model'
import { performance } from 'perf_hooks'

class JavaParseResult implements ParseResult {
    name: string
    languageId: string
    file: string
    pkg: ParseSymbol
    imports: ParseSymbol[] = []
    symbols: ParseSymbol[] = []
    constructor(request: ParseRequest) {
        this.name = request.languageId
        this.file = request.file
        this.name = 'vsc-java'
    }
}

export class ParseContext {
    offset: number = 0
    line: number = 0
    column: number = 0
    pendingScope: boolean = false
    scopes: ParseSymbol[] = []
    result: JavaParseResult
    debug: boolean

    constructor(request: ParseRequest, isDebug?: boolean) {
        this.result = new JavaParseResult(request)
        this.debug = isDebug
    }

    logNode(node: Node<any, any>) {
        let line = node.start.line + this.line
        if (this.debug) console.debug(`[${this.line}+${node.start.line-1}:${node.start.column}] ${node.name}`)
    }

    start(line: number, column: number, offset: number) {
        this.line = line
        this.column = column
        this.offset = offset
    }

    private nextId() : number {
        return this.result.symbols.length
    }

    private currentScope() : ParseSymbol {
        return this.scopes.length === 0 ? undefined : this.scopes.slice(-1)[0]
    }

    private currentScopeId() : number {
        let scope = this.currentScope()
        return scope ? scope.id : -1
    }

    addPackage(name: string, start: number, end: number) : ParseSymbol {
        let symbol = this.createSymbol(name, name, ParseSymbolType.PACKAGE, start+this.offset, end+this.offset, 0)
        this.result.pkg = symbol
        return symbol
    }

    addImport(name: string, start: number, end: number) : ParseSymbol {
        let symbol = this.createSymbol(name, name, ParseSymbolType.IMPORT, start+this.offset, end+this.offset, 0)
        this.result.imports.push(symbol)
        return symbol
    }

    addSymRef(name: string, start: number, end: number) : ParseSymbol {
        return this.createSymbol(name, name, ParseSymbolType.SYMREF, start+this.offset, end+this.offset, 0)
    }

    addLiteral(name: string, type: string, start: number, end: number) : ParseSymbol {
        return this.createSymbol(name, type, ParseSymbolType.LITERAL, start+this.offset, end+this.offset, 0)
    }

    addTypeRef(name: string, start: number, end: number, array: number) : ParseSymbol {
        return this.createSymbol(name, name, ParseSymbolType.TYPEREF, start+this.offset, end+this.offset, array)
    }

    addSymDef(name: string, type: string, symbolType: ParseSymbolType, start: number, end: number, array: number, isScope?: boolean) : ParseSymbol {
        return this.createSymbol(name, type, symbolType, start+this.offset, end+this.offset, array, isScope)
    }

    inClassBody() : boolean {
        let scope = this.currentScope()
        return scope ? [ParseSymbolType.CLASS, ParseSymbolType.INTERFACE, ParseSymbolType.ENUM, ParseSymbolType.ANNOTATION].includes(scope.symbolType) : false
    }

    private createSymbol(name: string, type: string, symbolType: ParseSymbolType, start: number, end: number, array: number, isScope?: boolean) : ParseSymbol {
        let symbol = {
            id: this.nextId(),
            parent: this.currentScopeId(),
            name: name,
            type: type,
            symbolType: symbolType,
            location: {start: start, end: end},
            children: [],
            arrayDim: array,
            classifier: ''
        }
        if (this.scopes.length > 0) this.scopes.slice(-1)[0].children.push(symbol.id)
        this.result.symbols.push(symbol)
        if (isScope) {
            this.scopes.push(symbol)
            this.pendingScope = true
            if (this.debug) console.debug(`Started scope for ${symbol.name}:${symbol.symbolType} [${this.currentScopeId()}]`)
        }
        return symbol
    }

    beginBlock() {
        if (this.pendingScope) this.pendingScope = false
        else {
            let block = this.createSymbol('{', '{', ParseSymbolType.BLOCK, this.offset, this.offset, 0)
            this.scopes.push(block as ParseSymbol)
            if (this.debug) console.debug(`Started block scope for ${block.name}:${block.type} [${this.currentScopeId()}]`)
        }
    }

    /** If scope is pending, end it (; terminated scopes) */
    endPendingScope() {
        if (this.pendingScope) {
            this.pendingScope = false
            this.endBlock()
        }
    }

    endBlock() {
        if (this.pendingScope) this.pendingScope = false
        else {
            let scope = this.scopes.pop()
            if (scope) {
                scope.scopeEnd = {start: this.offset, end: this.offset}
                if (this.debug) console.debug(`Ended scope for ${scope.name}:${scope.symbolType} [${this.currentScopeId()}]`)
            }
            else if (this.debug) console.debug(`No scope to end at ${this.offset}`)
        }
    }
}

/**
 * A node which represents an identifier
 */
interface IdNode {
    name: string
    start: number
    end: number
    type?: string
    symbolType?: ParseSymbolType
}

interface LiteralNode {
    value: string,
    type: string
}

/** A node which is invocable to create symbols */
type SymbolCreator = (context: ParseContext, type?: string) => ParseSymbol

/** A custom parser for block contents to make it easier to parse statments and expressions */
function blockContents() {
    return P((input, i) => {
        let parenCount = 0
        let inQuote = false
        let pos = 0
        for (pos=i; pos < input.length; pos++) {
            let c = input.charAt(pos)
            if (c === '(') parenCount++
            if (c === ')') parenCount--
            if (['"', "'"].includes(c)) inQuote = !inQuote
            if ((c === '{' || c === '}') && !inQuote) break
            if (c === ';' && parenCount === 0 && !inQuote) {pos++; break}
            if (c === '/' && pos < input.length-1 && input.charAt(pos+1) === '*' && !inQuote) break
        }
        let result = input.substring(i, pos)
        if (i != pos) return P.makeSuccess(pos, result)
        else return P.makeFailure(pos+1, 'EOF')
    });
}

/**
 * The main grammar
 */
export const Grammar = P.createLanguage<{
    _: string
    __: string
    ASSIGN: string
    FALSE: Node<'Literal', LiteralNode>
    TRUE: Node<'Literal', LiteralNode>
    NULL: Node<'Literal', LiteralNode>
    CHAR_LITERAL: Node<'Literal', LiteralNode>
    UNICODE_LITERAL: Node<'Literal', LiteralNode>
    STRING_LITERAL: Node<'Literal', LiteralNode>
    STRING3_LITERAL: Node<'Literal', LiteralNode>
    HEX_LITERAL: Node<'Literal', LiteralNode>
    BIN_LITERAL: Node<'Literal', LiteralNode>
    NUM_LITERAL: Node<'Literal', LiteralNode>
    OCT_LITERAL: Node<'Literal', LiteralNode>
    IDENT: string
    Keyword: Node<'Keyword', string>
    BlockKeyword: Node<'Keyword', string>
    ModifierKeyword: Node<'Keyword', string>
    Literal: IdNode
    Ident: IdNode
    QIdent: IdNode
    Term: string
    ArrayDim: string[]
    Modifier: string
    Modifiers: string[]
    TypeName: ParseSymbolType
    Comment: Node<'Comment', string>
    BeginBlock: Node<'BeginBlock', string>
    EndBlock: Node<'EndBlock', string>
    BlockContent: Node<'BlockContent', string>
    Blocks: Node<any, string>[]
    LineComment: SymbolCreator
    Package: SymbolCreator
    Import: SymbolCreator
    AnnoValue: SymbolCreator
    AnnoPair: SymbolCreator
    AnnoPairs: SymbolCreator
    AnnoArg: SymbolCreator
    Annotation: SymbolCreator
    Annotations: SymbolCreator
    TypeSpec: SymbolCreator
    VarSpec: SymbolCreator
    TypeParam: SymbolCreator
    TypeParams: SymbolCreator
    Extends: SymbolCreator
    Implements: SymbolCreator
    Throws: SymbolCreator
    ParamDef: SymbolCreator
    ParamDefs: SymbolCreator
    TypePrefix: SymbolCreator
    TypeDecl: SymbolCreator
    TypeDef: SymbolCreator
    ConstructorDef: SymbolCreator
    MethodDecl: SymbolCreator
    MethodDef: SymbolCreator
    FieldDef: SymbolCreator
    Initialize: SymbolCreator
    Expression: SymbolCreator
    Param: SymbolCreator
    Params: SymbolCreator
    Defs: SymbolCreator
    Statement: SymbolCreator
    BlockStatement: SymbolCreator
    ModifierStatement: SymbolCreator
}>({
    _: () => P.optWhitespace,
    __: () => P.whitespace,
    ASSIGN: () => P.regexp(/(>>>|<<|>>|\|\||-|\+|\*|\/|%|\^|&)?=/),
    FALSE: () => P.string("false").map(v => {return {value: v, type: 'java.lang.Boolean'}}).node('Literal'),
    TRUE: () => P.string("true").map(v => {return {value: v, type: 'java.lang.Boolean'}}).node('Literal'),
    NULL: () => P.string("null").map(v => {return {value: v, type: 'null'}}).node('Literal'),
    CHAR_LITERAL: () => P.regexp(/'[\\]?\w'/).map(v => {return {value: v, type: 'java.lang.Char'}}).node('Literal'),
    UNICODE_LITERAL: () => P.regexp(/'\\[uU][0-9a-fA-F]{4}'/).map(v => {return {value: v, type: 'java.lang.Char'}}).node('Literal'),
    STRING_LITERAL: () => P.regexp(/"([^"]|""')*"/).map(v => {return {value: v, type: 'java.lang.String'}}).node('Literal'),
    STRING3_LITERAL: () => P.regexp(/"""(.*)"""/).map(v => {return {value: v, type: 'java.lang.String'}}).node('Literal'),
    HEX_LITERAL: () => P.regexp(/0[xX][0-9a-fA-F_]*/).map(v => {return {value: v, type: 'java.lang.Number'}}).node('Literal'),
    BIN_LITERAL: () => P.regexp(/0[bB][_01]*/).map(v => {return {value: v, type: 'java.lang.Byte'}}).node('Literal'),
    NUM_LITERAL: () => P.regexp(/([-]?[0-9]+(\.[0-9_]*)?(E[-+]?[0-9_]+)?)[FfL]?|([-]?\.[0-9_]+(E[-+]?[0-9_]+)?)[FfL]?/).map(v => {
        return {value: v, type: 'java.lang.Number'}}).node('Literal'),
    OCT_LITERAL: () => P.regexp(/0[0-7_]*/).map(v => {return {value: v, type: 'java.lang.Number'}}).node('Literal'),
    IDENT: () => P.regexp(/[a-zA-Z\$][\w]*/),

    BlockKeyword: () => P.regexp(/(try|catch|finally|for)\b/).node('Keyword'),
    Keyword: () => P.regexp(/(return|throw|if|else|while|do|new)\b/).node('Keyword'),
    ModifierKeyword: () => P.regexp(/(static|synchronized)\b/).node('Keyword'),

    Literal: (r) => P.alt(r.FALSE, r.TRUE, r.NULL, r.UNICODE_LITERAL, r.CHAR_LITERAL, r.STRING3_LITERAL, 
        r.STRING_LITERAL, r.HEX_LITERAL, r.BIN_LITERAL, r.NUM_LITERAL, r.OCT_LITERAL).map(node => {
            return {name: node.value.value, type: node.value.type, symbolType: ParseSymbolType.LITERAL, start: node.start.offset, end: node.end.offset}
    }),

    Ident: (r) => r.IDENT.node('Ident').map(node => {
        return {name: node.value, start: node.start.offset, end: node.end.offset}
    }),

    QIdent: (r) => P.sepBy1(r.IDENT, P.string('.')).node('QIdent').map(node => {
        return {name: node.value.join('.'), start: node.start.offset, end: node.end.offset}
    }),

    LineComment: () => P.regexp(/\/\/.*/).node('LineComment').map(node => context => {
        context.logNode(node)
        return undefined
    }),

    Term: (r) => P.alt(P.string(';'), r.__, r.LineComment).many().map(v => v.join("")),

    ArrayDim: () => P.string('[]').many(),

    Package: (r) => P.seq(
        P.string('package'), r.__, r.QIdent, r.Term
    ).trim(r._).node('Package').map(node => (context) => {
        context.logNode(node)
        let id = node.value[2]
        return context.addPackage(id.name, id.start, id.end)
    }),

    Import: (r) => P.seq(
        P.string('import'), r.__, P.string('static').atMost(1), r._, r.QIdent, P.string('.*').atMost(1), r.Term
    ).trim(r._).node('Import').map(node => (context) => {
        context.logNode(node)
        let id = node.value[4]
        return context.addImport(id.name, id.start, id.end)
    }),

    AnnoValue: (r) => P.alt(r.Literal, r.QIdent, r.Annotation).trim(r._).node('AnnoValue').map(node => (context) => {
        return undefined
    }),
    AnnoPair: (r) => P.seq(P.seq(r.QIdent, r._, r.ASSIGN).atMost(1), r._, r.AnnoValue).trim(r._).node('AnnoPair').map(node => (context) => {
        let id = node.value[0][0] ? node.value[0][0][0] : undefined
        if (id) context.addSymRef(id.name, id.start, id.end)
        return node.value[2](context)
    }),
    AnnoPairs: (r) => P.sepBy(r.AnnoPair, P.string(',')).trim(r._).node('AnnoPairs').map(node => (context) => {
        node.value.forEach(sym => sym(context))
        return undefined
    }),
    AnnoArg: (r) => r.AnnoPairs.wrap(P.string('('), P.string(')')).node('AnnoArg').map(node => (context) => {return node.value(context)}),
    Annotation: (r) => P.seq(
        P.string('@'), r.QIdent, r.AnnoArg.atMost(1), r.Term
    ).trim(r._).node('Annotation').map(node => (context) => {
        context.logNode(node)
        let id = node.value[1]
        let anno = context.addTypeRef(id.name, id.start, id.end, 0)
        node.value[2].forEach(sym => sym(context))
        return anno
    }),
    Annotations: (r) => r.Annotation.many().node('Annotations').map(node => (context) => {
        context.logNode(node)
        node.value.forEach(sym => sym(context))
        return undefined
    }),

    TypeSpec: (r) => P.seq(
        r.QIdent, r.TypeParams, r.ArrayDim, P.string('...').atMost(1)
    ).trim(r._).node('TypeSpec').map(node => (context) => {
        let id = node.value[0]
        let array = node.value[2].length
        let sym = context.addTypeRef(id.name, id.start, id.end, array)
        node.value[1](context)
        return sym
    }),

    VarSpec: (r) => P.seq(
        r.QIdent, r._, r.ArrayDim
    ).trim(r._).node('VarSpec').map(node => (context, type) => {
        let id = node.value[0]
        let symType = context.inClassBody() ? ParseSymbolType.FIELD : ParseSymbolType.VARIABLE
        let array = node.value[2].length
        return context.addSymDef(id.name, type, symType, id.start, id.end, array)
    }),

    TypeParam: (r) => P.seq(
        r.QIdent.or(P.string('?')), r._, P.regexp(/extends|super/).atMost(1), r._, P.sepBy(r.TypeSpec, P.string('&'))
    ).trim(r._).node('TypeParam').map(node => (context) => {
        let id = node.value[0]
        let sym = (typeof id !== "string" ) ? context.addTypeRef(id.name, id.start, id.end, 0) : undefined
        node.value[4].forEach(sym => sym(context))
        return sym
    }),
    TypeParams: (r) => P.sepBy(r.TypeParam, P.string(',')).wrap(P.string('<'), P.string('>')).atMost(1).node('TypeParams').map(node => (context) => {
        node.value.forEach(tp => tp.forEach(sym => sym(context)))
        return undefined
    }),

    Modifier: () => P.regexp(/public|private|protected|final|transient|threadsafe|volatile|abstract|native|strictfp|inner|static|default|synchronized/),
    Modifiers: (r) => P.sepBy(r.Modifier, r.__),
    TypeName: () => P.regexp(/class|interface|enum|@interface/).map(n => {
        switch(n) {
            case 'class': return ParseSymbolType.CLASS
            case 'enum': return ParseSymbolType.ENUM
            case 'interface': return ParseSymbolType.INTERFACE
            case '@interface': return ParseSymbolType.ANNOTATION
            default: return ParseSymbolType.OBJECT
        }
    }),

    Extends: (r) => P.seq(
        P.string('extends'), r.__, r.TypeSpec
    ).node('Extends').map(node => (context) => {return node.value[2](context)}),

    Implements: (r) => P.seq(
        P.string('implements'), r.__, P.sepBy1(r.TypeSpec, P.string(','))
    ).node('Implements').map(node => (context) => {
        node.value[2].forEach(sym => sym(context))
        return undefined
    }),

    Throws: (r) => P.seq(
        P.string('throws'), r.__, P.sepBy1(r.QIdent, P.string(','))
    ).trim(r._).node('Throws').map(node => (context) => {
        node.value[2].forEach(id => context.addTypeRef(id.name, id.start, id.end, 0))
        return undefined
    }),

    ParamDef: (r) => P.seq(
        r.Annotations, r._, r.Modifiers, r.TypeSpec, r._, r.VarSpec
    ).trim(r._).node('ParamDef').map(node => context => {
        context.logNode(node)
        node.value[0](context)
        let type = node.value[3](context)
        return node.value[5](context, type.name)
    }),
    ParamDefs: (r) => P.sepBy(r.ParamDef, P.string(',')).wrap(P.string('('), P.string(')')).node('ParamDefs').map(node => context => {
        context.logNode(node)
        node.value.forEach(sym => sym(context))
        return undefined
    }),

    TypePrefix: (r) => P.seq(
        r.Annotations, r._, r.Modifiers
    ).trim(r._).node('TypePrefix').map(node => context => {
        context.logNode(node)
        return node.value[0](context)
    }),

    TypeDecl:  (r) => P.seq(
        r.TypeName, r._, r.QIdent, r._, r.TypeParams
    ).trim(r._).node('TypePrefix').map(node => context => {
        context.logNode(node)
        let id = node.value[2]
        let sym = context.addSymDef(id.name, id.name, node.value[0], id.start, id.end, 0, true)
        node.value[4](context)
        return sym
    }),

    TypeDef: (r) => P.seq(
        r.TypePrefix, r._, r.TypeDecl, r._, r.Extends.atMost(1), r._, r.Implements.atMost(1)
    ).trim(r._).node('TypeDef').map(node => context => {
        context.logNode(node)
        node.value[0](context)
        let sym = node.value[2](context)
        node.value[4].forEach(sym => sym(context))
        node.value[6].forEach(sym => sym(context))
        return sym
    }),

    ConstructorDef: (r) => P.seq(
        r.TypePrefix, r._, r.Ident, r.ParamDefs, r._, r.Throws.atMost(1)
    ).trim(r._).node('ConstructorDef').map(node => context => {
        context.logNode(node)
        let id = node.value[2]
        return context.addSymDef(id.name, id.name, ParseSymbolType.CONSTRUCTOR, id.start, id.end, 0, true)
    }),

    Param: (r) => P.alt(r.Literal, r.QIdent).trim(r._).node('Param').map(node => context => {
        context.logNode(node)
        let id = node.value
        if (id.symbolType === ParseSymbolType.LITERAL) return context.addLiteral(id.name, id.type, id.start, id.end)
        else return context.addSymRef(id.name, id.start, id.end)
    }), // Should be expression, ha
    Params: (r) => P.sepBy(r.Expression, P.string(',')).trim(r._).wrap(P.string('('), P.string(')')).map(value => context => {
        value.forEach(sym => sym(context))
        return undefined
    }),

    Expression: (r) => P.alt(r.Literal, r.QIdent, P.regexp(/[^\w]/)).atLeast(1).node('Expression').map(node => context => {
        context.logNode(node)
        node.value.forEach(v => {
            if (typeof v === 'object') {
                let sym = (v.symbolType === ParseSymbolType.LITERAL) ? context.addLiteral(v.name, v.type, v.start, v.end) :
                context.addSymRef(v.name, v.start, v.end)
            }
        })
        if (node.value.slice(-1)[0] === ';') {
            context.endPendingScope()
        }
        return undefined
    }),

    Initialize: (r) => P.seq(
        r.ASSIGN, r.Expression
    ).trim(r._).map(value => context => {
        return value[1](context)
    }),

    FieldDef: (r) => P.seq(
        r.TypePrefix, r._, r.TypeSpec, r._, P.sepBy1(r.VarSpec, P.string(',')), r.Term, r.Initialize.atMost(1)
    ).trim(r._).node('FieldDef').map(node => context => {
        context.logNode(node)
        node.value[0](context)
        let type = node.value[2](context)
        node.value[4].forEach(sym => sym(context, type.name))
        node.value[6].forEach(sym => sym(context))
        return undefined
    }),

    MethodDecl: (r) => P.seq(
        r.TypeParams, r._, r.TypeSpec, r._, r.Ident
    ).trim(r._).node('MethodDecl').map(node => context => {
        context.logNode(node)
        node.value[0](context)
        let type = node.value[2](context)
        let id = node.value[4]
        return context.addSymDef(id.name, type.name, ParseSymbolType.METHOD, id.start, id.end, 0, true)
    }),

    MethodDef: (r) => P.seq(
        r.TypePrefix, r._, r.MethodDecl, r.ParamDefs, r.ArrayDim, r.Throws.atMost(1), r.Term
    ).trim(r._).node('MethodDef').map(node => context => {
        context.logNode(node)
        node.value[0](context)
        let sym = node.value[2](context)
        node.value[3](context)
        node.value[5].forEach(sym => sym(context))
        if (node.value[6].includes(';')) context.endPendingScope()
        return sym
    }),

    Comment: (r) => P.string('/*').chain((start) => {
        let prev = ''
        return P.takeWhile(c => {
            let test = `${prev}${c}`
            prev = c
            return test !== '*/'
        }).skip(P.string('/'))
    }).node('Comment'),
    
    BeginBlock: () => P.string('{').node('BeginBlock'),

    //Something: (r) => P.seq(blockContents(), r.Comment).atLeast(1).node('Something'),

    BlockContent: (r) => blockContents().node('BlockContent'),
    EndBlock: ()  => P.string('}').node('EndBlock'),
    Blocks: (r) => P.alt(r.Comment, r.BeginBlock, r.EndBlock, r.BlockContent).trim(r.Term).atLeast(1),

    // Order is important
    Defs: (r) => P.alt(
        r.LineComment,
        r.BlockStatement,
        r.Statement,
        r.Package,
        r.Import,
        r.TypeDef,
        r.ConstructorDef,
        r.MethodDef,
        r.FieldDef,
        r.Annotation,
        r.ModifierStatement,
        r.Expression
        //r.Term,
    ),

    BlockStatement: (r) => P.seq(r.BlockKeyword, r._, r.Expression).node('BlockStatement').map(node => context => {
        context.logNode(node)
        let keyword = node.value[0]
        context.addSymDef(keyword.value, keyword.value, ParseSymbolType.CONTROL, keyword.start.offset, keyword.end.offset, 0, true)
        return node.value[2](context)
    }),

    ModifierStatement: (r) => P.seq(r.ModifierKeyword, r.Expression.atMost(1)).node('ModifierStatement').map(node => context => {
        context.logNode(node)
        let keyword = node.value[0]
        context.addSymDef(keyword.value, keyword.value, ParseSymbolType.CONTROL, keyword.start.offset, keyword.end.offset, 0, true)
        node.value[1].forEach(sym => sym(context))
        return undefined
    }),

    Statement: (r) => P.seq(r.Keyword, r._, r.Expression).node('Statement').map(node => context => {
        context.logNode(node)
        return node.value[2](context)
    })

})
