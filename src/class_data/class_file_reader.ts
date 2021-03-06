import * as fs from 'fs'
import { ConstantPool } from './constant_pool'
import { readMemberInfo, readU16, readU32, MemberType, readAttributeInfo, InfoType, AttributeInfo, AttributeType } from './class_file_info'
import { MethodData, FieldData, ClassData } from './class_data'

export class ClassFileReader {

    public load(path: string): Promise<ClassData> {
        let modified = fs.statSync(path).mtime
        return new Promise((resolve, reject) => {
            fs.readFile(path, (err, data) => {
                let classData = new ClassData(path, modified.valueOf())
                let offset = 0
                let context = { data: data, offset: offset } as ClassFileContext
                let magic = readU32(context)
                if (magic.toString(16) != 'cafebabe') throw `Bad Magic Number: ${magic.toString(16)}`;
                classData.minor = readU16(context)
                classData.major = readU16(context)
                // Constant Pool
                let constantPool = ConstantPool.read(context)
                classData.accessFlags = readU16(context);
                classData.name = this.getClassName(readU16(context), constantPool) // this class
                classData.extends = this.getClassName(readU16(context), constantPool) // extends
                // Interfaces
                let ifCount = readU16(context)
                classData.implements = []
                for (var i = 0; i < ifCount; i++) {
                    let name = this.getClassName(readU16(context), constantPool)
                    classData.implements.push(name)
                }
                // Find all the classes referenced by this class
                classData.references = constantPool.pool.filter(e => e.type === InfoType.CLASS).map(e => constantPool.pool[e.value].value)
                // Find the source file
                // Field Info
                classData.fields = []
                let fCount = readU16(context)
                for (i = 0; i < fCount; i++) {
                    let field = readMemberInfo(context, constantPool, MemberType.FIELD)
                    let signature = this.getAttributeName(field.attributes.find(a => a.type === AttributeType.Signature), constantPool)
                    let descriptor = this.getName(field.descriptor, constantPool)
                    let type = signature ? signature : descriptor
                    let name = this.getName(field.name, constantPool)
                    let annotations = this.processAnnotations(field.attributes, constantPool)
                    classData.fields.push(new FieldData(name, type, false, 0, annotations))
                }
                // Method Info
                classData.methods = []
                let mCount = readU16(context)
                for (i = 0; i < mCount; i++) {
                    let method = readMemberInfo(context, constantPool, MemberType.METHOD)
                    let signature = this.getAttributeName(method.attributes.find(a => a.type === AttributeType.Signature), constantPool)
                    let descriptor = this.getName(method.descriptor, constantPool)
                    let type = signature ? signature : descriptor
                    let name = this.getName(method.name, constantPool)
                    let code = method.attributes.find(a => a.type === AttributeType.Code)
                    let locals = this.getLocalVariables(code, constantPool)
                    let annotations = this.processAnnotations(method.attributes, constantPool)
                    classData.methods.push(new MethodData(name, type, locals, annotations))
                }
                // Attributes
                let attributes: AttributeInfo[] = []
                let aCount = readU16(context)
                for (i = 0; i < aCount; i++) {
                    attributes.push(readAttributeInfo(context, constantPool))
                }
                // Find the source name
                classData.sourceFile = this.getAttributeName(attributes.find(a => a.type === AttributeType.SourceFile), constantPool)
                classData.inners = this.getAttributeNames(attributes.find(a => a.type === AttributeType.InnerClasses), constantPool)
                classData.annotations = this.processAnnotations(attributes, constantPool)
                resolve(classData)
            })
        })
    }

    /**
     * Return the name for the given class info index
     * @param index 
     * @param pool 
     */
    private getClassName(index: number, pool: ConstantPool): string {
        let info = pool.pool[index]
        return info ? this.getName(info.value, pool) : undefined
    }

    /**
     * Get the given index's name from the pool
     * @param index 
     * @param pool 
     */
    private getName(index: number, pool: ConstantPool): string {
        let utf8 = index ? pool.pool[index] : undefined
        return utf8 ? utf8.value : undefined
    }

    /**
     * Return the name of an attribute where info is the index to the name
     */
    private getAttributeName(info: AttributeInfo, pool: ConstantPool): string {
        if (!info) return undefined
        let ndx = info ? info.info.readUInt16BE(0) : undefined
        let utf8 = ndx ? pool.pool[ndx] : undefined
        return utf8 ? utf8.value : undefined
    }

    /**
     * Return the names of attributes where info is a table of indices to a classinfo
     */
    private getAttributeNames(info: AttributeInfo, pool: ConstantPool): string[] {
        let data = info ? info.info : undefined
        let off = 0
        let tableSize = data ? data.readUInt16BE(off) : 0
        let names = []
        for (var i = 0; i < tableSize; i++) {
            let ndx = data.readUInt16BE(off += 2)
            let classinfo = pool.pool[ndx]
            let utf8 = classinfo ? pool.pool[classinfo.value] : undefined
            let name = utf8 ? utf8.value : undefined
            if (name) names.push(name)
        }
        return names
    }

    /**
     * Return parameter info 
     */
    private getLocalVariables(info: AttributeInfo, pool: ConstantPool): FieldData[] {
        let attributes = info ? info.attributes : undefined
        let locals = attributes ? attributes.find(a => [AttributeType.LocalVariableTable, AttributeType.LocalVariableTypeTable].includes(a.type)) : undefined
        let data = locals ? locals.info : undefined
        let params = []
        let off = 0
        let tableSize = data ? data.readUInt16BE(off) : 0
        for (var i = 0; i < tableSize; i++) {
            let startPc = data.readUInt16BE(off += 2)
            let length = data.readUInt16BE(off += 2)
            let name = this.getName(data.readUInt16BE(off += 2), pool)
            let descriptor = this.getName(data.readUInt16BE(off += 2), pool)
            let index = data.readUInt16BE(off += 2)
            let type = descriptor
            let annotations = this.processAnnotations(attributes, pool)
            params.push(new FieldData(name, type, startPc == 0, index, annotations))
        }
        return params
    }

    /**
     * Process attributes for annotations
     */
    private processAnnotations(info: AttributeInfo[], pool: ConstantPool): string[] {
        if (!info) return []
        let annotations = []
        info.filter(a => [AttributeType.RuntimeVisibleAnnotations, AttributeType.RuntimeInvisibleAnnotations].includes(a.type)).forEach(a => {
            this.getAnnotations(annotations, a.info)
        })
        return annotations.map(a => pool.pool[a].value)
    }

    /**
     * Get all the annotations
     */
    private getAnnotations(annotations: number[], data: Buffer, offset?: number, num?: number): number {
        if (offset == undefined) {
            return this.getAnnotations(annotations, data, 0)
        }
        if (!num) {
            let count = data.readUInt16BE(offset)
            return this.getAnnotations(annotations, data, offset + 2, count)
        }
        for (var i = 0; i < num; i++) {
            offset = this.getAnnotation(annotations, data, offset)
        }
        return offset
    }

    /**
     * Get a single annotation
     */
    private getAnnotation(annotations: number[], data: Buffer, offset: number): number {
        let type = data.readUInt16BE(offset)
        annotations.push(type)
        let size = data.readUInt16BE(offset += 2)
        for (var i = 0; i < size; i++) {
            offset = this.getAnnotationValue(annotations, data, offset += 2)
        }
        return offset
    }

    private getAnnotationValue(annotations: number[], data: Buffer, offset: number): number {
        let name = data.readUInt16BE(offset)
        let tag = data.readUInt8(offset += 2)
        let tagChar = Buffer.from([(tag & 0xff)]).toString('ascii')
        offset += 1
        // Here's where you would start deal with getting the annotation value pairs
        if (tagChar === 'e') {
            data.readUInt16BE(offset)
            data.readUInt16BE(offset += 2)
            offset += 5
        }
        else if (tagChar === 'c') {
            data.readUInt16BE(offset)
            offset += 3
        }
        else if (tagChar === '@') {
            return this.getAnnotation(annotations, data, offset)
        }
        else if (tagChar === '[') {
            let size = data.readUInt16BE(offset)
            for (var i = 0; i < size; i++) {
                offset = this.getAnnotationValue(annotations, data, offset += 2)
            }
        }
        else {
            let ndx = data.readUInt16BE(offset)
            offset += 3
        }
        return offset
    }
}