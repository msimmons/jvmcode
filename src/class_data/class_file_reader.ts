import * as fs from 'fs'
import * as PathHelper from 'path'
import {promisify} from 'util'
import { ConstantPool } from './constant_pool'
import { readMemberInfo, readU16, readU32, MemberType, readAttributeInfo, InfoType, AttributeInfo, AttributeType, MemberInfo, readU8 } from './class_file_info'
import { MethodData, FieldData, ClassData, LineEntry } from './class_data'
import { ClassFileContext } from './class_file_context'

export class ClassFileReader {

    /**
     * Create [ClassData] from a [Buffer]
     * @param path The path of the class file (local or jar)
     * @param lastModified Last modified time (ms)
     * @param data The buffer
     */
    public create(path: string, lastModified: number, data: Buffer) : ClassData {
        let classData = new ClassData(path, lastModified)
        let offset = 0
        let context = { path: path, data: data, offset: offset } as ClassFileContext
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
            classData.fields.push(this.getFieldData(field, constantPool))
        }
        // Method Info
        classData.methods = []
        let mCount = readU16(context)
        for (i = 0; i < mCount; i++) {
            let method = readMemberInfo(context, constantPool, MemberType.METHOD)
            classData.methods.push(this.getMethodData(method, constantPool))
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
        classData.fqcn = classData.name.replace(/\//g, '.').replace(/\$/g, '.')
        classData.pkg = PathHelper.dirname(classData.name).replace(/\//g, '.')
        return classData
    }

    /**
     * Create [ClassData] from a local class file
     * @param path The local class file to load
     */
    public async load(path: string): Promise<ClassData> {
        let modified = (await promisify(fs.stat)(path)).mtime
        let data = await promisify(fs.readFile)(path)
        try {
            return this.create(path, modified.valueOf(), data)
        }
        catch (err) {
            console.error(`${err} @ ${path}`)
            return undefined
        }
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
     * Create a field from the given member info
     */
    private getFieldData(field: MemberInfo, pool: ConstantPool) : FieldData {
        let signature = this.getAttributeName(field.attributes.find(a => a.type === AttributeType.Signature), pool)
        let descriptor = this.getName(field.descriptor, pool)
        let type = signature ? signature : descriptor
        let name = this.getName(field.name, pool)
        let annotations = this.processAnnotations(field.attributes, pool)
        return new FieldData(name, type, false, -1, 0, annotations, field.accessFlags)
    }

    /**
     * Create a method from the given member info
     * @param info 
     * @param pool 
     */
    private getMethodData(method: MemberInfo, pool: ConstantPool) : MethodData {
        let signature = this.getAttributeName(method.attributes.find(a => a.type === AttributeType.Signature), pool)
        let descriptor = this.getName(method.descriptor, pool)
        let type = signature ? signature : descriptor
        let name = this.getName(method.name, pool)
        let code = method.attributes.find(a => a.type === AttributeType.Code)
        let locals = this.getLocalVariables(code, pool)
        let annotations = this.processAnnotations(method.attributes, pool)
        return new MethodData(name, type, locals, annotations, method.accessFlags)
    }

    /**
     * Return parameter and local variable info 
     */
    private getLocalVariables(code: AttributeInfo, pool: ConstantPool): FieldData[] {
        let attributes = code ? code.attributes : undefined
        let locals = attributes ? attributes.find(a => [AttributeType.LocalVariableTable, AttributeType.LocalVariableTypeTable].includes(a.type)) : undefined
        let lineTable = attributes ? attributes.find(a => a.type === AttributeType.LineNumberTable) : undefined
        let lineEntries = this.getLineEntries(lineTable)
        let data = locals ? locals.info : undefined
        let params = []
        let off = 0
        let tableSize = data ? data.readUInt16BE(off) : 0
        for (var i = 0; i < tableSize; i++) {
            let startPc = data.readUInt16BE(off += 2)
            let lineEntry = lineEntries.find(l => l.pc === startPc)
            let line = lineEntry ? lineEntry.line : lineEntries.length > 0 ? lineEntries[0].line : -1
            data.readUInt16BE(off += 2) // length
            let name = this.getName(data.readUInt16BE(off += 2), pool)
            let descriptor = this.getName(data.readUInt16BE(off += 2), pool)
            let index = data.readUInt16BE(off += 2)
            let type = descriptor
            let annotations = this.processAnnotations(attributes, pool)
            params.push(new FieldData(name, type, startPc == 0, index, line, annotations, 0))
        }
        return params
    }

    /**
     * Return a line number for the given program counter and line number table
     */
    private getLineEntries(table: AttributeInfo) : LineEntry[] {
        let data = table ? table.info : undefined
        let off = 0
        let size = data ? data.readUInt16BE(off) : 0
        let entries = []
        for (var i=0; i<size; i++) {
            let pc = data.readUInt16BE(off += 2)
            let line = data.readUInt16BE(off += 2)
            entries.push({pc: pc, line: line})
        }
        return entries
    }

    /**
     * Process attributes for annotations
     */
    private processAnnotations(info: AttributeInfo[], pool: ConstantPool): string[] {
        if (!info) return []
        let annotations = []
        info.filter(a => [AttributeType.RuntimeVisibleAnnotations, AttributeType.RuntimeVisibleParameterAnnotations].includes(a.type)).forEach(a => {
            let context = {path: 'annotation', data: a.info, offset: 0} as ClassFileContext
            if (a.type === AttributeType.RuntimeVisibleAnnotations) this.getAnnotations(annotations, context)
            else this.getParameterAnnotations(annotations, context)
        })
        return annotations.map(a => pool.pool[a].value)
    }

    /**
     * Get all the class annotations
     */
    private getAnnotations(annotations: number[], context: ClassFileContext, num?: number) {
        let count = readU16(context)
        for (var i=0; i<count; i++) {
            this.getAnnotation(annotations, context)
        }
    }

    /**
     * Get all the parameter annotations
     */
    private getParameterAnnotations(annotations: number[], context: ClassFileContext, num?: number) {
        let paramCount = readU8(context)
        for (var p=0; p<paramCount; p++) {
            let count = readU16(context)
            for (var i=0; i<count; i++) {
                this.getAnnotation(annotations, context)
            }
        }
    }

    /**
     * Get a single annotation
     */
    private getAnnotation(annotations: number[], context: ClassFileContext) {
        let type = readU16(context)
        annotations.push(type)
        let size = readU16(context)
        for (var i = 0; i < size; i++) {
            this.getAnnotationValue(annotations, context)
        }
    }

    private getAnnotationValue(annotations: number[], context: ClassFileContext, isArray?: boolean) {
        let name = isArray ? undefined : readU16(context)
        let tag = readU8(context)
        let tagChar = Buffer.from([(tag & 0xff)]).toString('ascii')
        // TODO Here's where you would start deal with getting the annotation value pairs
        if (tagChar === 'e') {
            let typeNdx = readU16(context)
            let enumNdx = readU16(context)
        }
        else if (tagChar === 'c') {
            let typeNdx = readU16(context)
        }
        else if (tagChar === '@') {
            this.getAnnotation(annotations, context)
        }
        else if (tagChar === '[') {
            let size = readU16(context)
            for (var i = 0; i < size; i++) {
                this.getAnnotationValue(annotations, context, true)
            }
        }
        else {
            let constNdx = readU16(context)
        }
    }
}