import { Info, DispatchTable, InfoType, readU16 } from "./class_file_info"

export class ConstantPool {

    pool: Info[]

    constructor(pool: Info[]) {
        this.pool = pool
    }

    static read(context: ClassFileContext) : ConstantPool {
        let cpSize = readU16(context)
        let pool: Info[] = [{type: 0, index: 0, value: 'JVM'}]
        for (var i = 1; i < cpSize; i++) {
            let tag = context.data.readUInt8(context.offset)
            context.offset += 1
            let dispatcher = DispatchTable.get(tag)
            if (dispatcher) {
                let info = dispatcher.invoke(i, context, tag)
                pool.push(info)
            }
            else {
                console.debug(`Unknown constant type ${tag} at ${i} offset ${context.offset} in ${context.path}`)
                context.offset += 1
            }
            if ([InfoType.LONG, InfoType.DOUBLE].includes(tag)) {
                i++
                pool.push({type: 0, index: i, value: 'Padding'})
            }
        }
        return new ConstantPool(pool)
    }
}