export interface ParseLocation {
    end: number;
    start: number;
}

export enum ParseSymbolType {
    BLOCK = 'Block',
    PACKAGE = 'Package',
    IMPORT = 'Import',
    CONTROL = 'Control',
    CLASS = 'Class',
    INTERFACE = 'Interface',
    ANNOTATION = 'Annotation',
    ENUM = 'Enum',
    OBJECT = 'Object',
    CONSTRUCTOR = 'Constructor',
    METHOD = 'Method',
    FIELD = 'Field',
    VARIABLE = 'Variable',
    TYPEREF = 'TypeRef',
    SYMREF = 'SymRef',
    TYPEPARAM = 'TypeParam',
    THIS = 'this',
    LITERAL = 'Literal'
}

export interface ParseSymbol {
    id: number
    parent: number
    name: string
    type: string | null
    symbolType: ParseSymbolType
    location: ParseLocation
    children: number[]
    scopeEnd?: ParseLocation

    arrayDim?: number;
    caller?: number
    classifier?: string
    isStatic?: boolean
    isWild?: boolean
    symbolDef?: number
}

export interface ParseResult {
    file: string;
    imports: ParseSymbol[];
    languageId: string;
    name: string;
    pkg: ParseSymbol | null;
    symbols: ParseSymbol[];
}

export interface CompileRequest {
    classpath: string;
    files: string[];
    languageId: string;
    name: string;
    outputDir: string;
    sourcepath: string;
}

export interface Diagnostic {
    column: number;
    file: string;
    line: number;
    message: string;
    severity: string;
}

export interface CompileResult {
    diagnostics: Diagnostic[];
    languageId: string;
    name: string;
}

export interface LanguageRequest {
    extensions: string[]
    imports: string[]
    languageId: string
    name: string
    triggerChars: string[]
    parse(request: ParseRequest) : Promise<ParseResult>
    compile(request: CompileRequest) : Promise<CompileResult>
}

export interface ParseRequest {
    languageId: string
    file: string
    text: string
}

export type ParseScopeType = "SOURCE" | "TYPE" | "METHOD" | "CONTROL" | "BLOCK";

export interface ParseScope {
    id: number;
    location: ParseLocation;
    parent: number | null;
    type: ParseScopeType;
}
