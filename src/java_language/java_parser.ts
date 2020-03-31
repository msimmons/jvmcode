import { Grammar, ParseContext } from './java_grammar'
import { ParseResult, ParseSymbol, ParseRequest } from '../language_model'
import { performance } from 'perf_hooks'

export class JavaParser {

    parse(request: ParseRequest, debug?: boolean) : ParseResult {
        let context = new ParseContext(request, debug)
        performance.mark('startBlocks')
        let result = Grammar.Blocks.tryParse(request.text)
        performance.mark('endBlocks')
        performance.mark('startProcess')
        Array.from(result.values()).forEach(r => {
            context.start(r.start.line, r.start.column, r.start.offset)
            switch(r.name) {
                case 'BeginBlock': this.processBeginBlock(context); break;
                case 'Comment': this.processComment(context, r.value); break;
                case 'BlockContent': this.processContent(context, r.value); break;
                case 'EndBlock': this.processEndBlock(context); break;
                default: console.warn(`Unkown type ${r.name}`)
            }
        })
        performance.mark('endProcess')
        performance.measure('ParseBlocks', 'startBlocks', 'endBlocks')
        performance.measure('ProcessBlocks', 'startProcess', 'endProcess')
        return context.result
     }

     private processBeginBlock(context: ParseContext) {
        context.beginBlock()
    }

     private processEndBlock(context: ParseContext) {
        context.endBlock()
     }

     private processComment(context: ParseContext, comment: string) {
        //console.log(`[${context.line}:${context.column}] Comment`)
     }

    private processContent(context: ParseContext, content: string) {
        let result = Grammar.Defs.parse(content)
        if (result.status) result.value(context)
        else {
            console.warn(`FAILED: ${content}`, result)
        }
    }
}