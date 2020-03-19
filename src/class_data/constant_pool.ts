import { Info, DispatchTable, InfoType } from "./class_file_info"

export class ConstantPool {

    pool: Info[]

    constructor(pool: Info[]) {
        this.pool = pool
    }

    static read(context: ClassFileContext) : ConstantPool {
        let cpSize = context.data.readUInt16BE(context.offset)
        let pool: Info[] = []
        for (var i = 0; i < cpSize; i++) {
            let tag = context.data.readUInt8(context.offset)
            context.offset += 1
            let dispatcher = DispatchTable.get(tag)
            if (dispatcher) {
                let info = dispatcher.invoke(i, context, tag)
                pool.push(info)
            }
            else {
                console.log(`Unknown constant type ${tag} at ${i}`)
                context.offset += 1
            }
            if ([InfoType.LONG, InfoType.DOUBLE].includes(tag)) i++
        }
        return new ConstantPool(pool)
    }
}