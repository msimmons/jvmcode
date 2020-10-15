import { LanguageRequest, ParseRequest, ParseResult, CompileRequest, CompileResult } from "../language_model";
import { JavaParser } from "./java_parser";

export class JavaProvider implements LanguageRequest {

    extensions: string[] = ['java']
    imports: string[] = ['java.lang.*']
    languageId: string = 'java'
    name: string = 'vsc-java'
    triggerChars: string[] = ['.', ',', ':', '(']
    parser = new JavaParser()

    async parse(request: ParseRequest): Promise<ParseResult> {
        console.log(`Parsing ${request.file}`)
        let result = this.parser.parse(request)
        return result
    }

    async compile(request: CompileRequest): Promise<CompileResult> {
        console.log(`Compiling ${request.files}`)
        return undefined
    }
}