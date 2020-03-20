import { StringDecoder } from 'string_decoder'
import { ConstantPool } from './constant_pool'

export enum InfoType {
    RESERVED = 0,
    UTF8 = 1,
    INTEGER = 3,
    FLOAT = 4,
    LONG = 5,
    DOUBLE = 6,
    CLASS = 7,
    STRING = 8,
    FIELD_REF = 9,
    METHOD_REF = 10,
    INTERFACE_REF = 11,
    NAME_TYPE = 12,
    METHOD_HANDLE = 15,
    METHOD_TYPE = 16,
    DYNAMIC = 17,
    INVOKE = 18,
    MODULE = 19,
    PACKAGE = 20
}

interface Dispatch {
    invoke: (index: number, context: ClassFileContext, type: InfoType) => Info
}

export let DispatchTable = new Map<number, Dispatch>()
DispatchTable.set(InfoType.RESERVED, {invoke: readReserved})
DispatchTable.set(InfoType.UTF8, {invoke: newUTF8})
DispatchTable.set(InfoType.LONG, {invoke: newLong})
DispatchTable.set(InfoType.INTEGER, {invoke: newInteger})
DispatchTable.set(InfoType.FLOAT, {invoke: newFloat})
DispatchTable.set(InfoType.DOUBLE, {invoke: newDouble})
DispatchTable.set(InfoType.CLASS, {invoke: newClass})
DispatchTable.set(InfoType.STRING, {invoke: newString} )
DispatchTable.set(InfoType.FIELD_REF, {invoke: newMemberRef})
DispatchTable.set(InfoType.METHOD_REF, {invoke: newMemberRef})
DispatchTable.set(InfoType.INTERFACE_REF, {invoke: newMemberRef})
DispatchTable.set(InfoType.NAME_TYPE, {invoke: newNameType})
DispatchTable.set(InfoType.METHOD_HANDLE, {invoke: newMethodHandle})
DispatchTable.set(InfoType.METHOD_TYPE, {invoke: newMethodType})
DispatchTable.set(InfoType.DYNAMIC, {invoke: newDynamic})
DispatchTable.set(InfoType.INVOKE, {invoke: newDynamic})
DispatchTable.set(InfoType.MODULE, {invoke: newModule})
DispatchTable.set(InfoType.PACKAGE, {invoke: newModule})

export interface Info {
    type: InfoType
    index: number,
    value: any
}

// Reserved
function readReserved(index: number, context: ClassFileContext, type: InfoType) : Info {
    context.offset += 1
    return {type: type, value: undefined, index: index}
}

// UTF8
interface UTF8Info extends Info {
    value: string
}
function newUTF8(index: number, context: ClassFileContext, type: InfoType) : UTF8Info {
    let value = readUTF8(context)
    return {index: index, type: type, value: value}
}

// Long
interface LongInfo extends Info {
    value: number
}
function newLong(index: number, context: ClassFileContext, type: InfoType) : LongInfo {
    let value = read64(context)
    return {index: index, type: type, value: value}
}

// Integer
interface IntegerInfo extends Info {
    value: number
}
function newInteger(index: number, context: ClassFileContext, type: InfoType) : IntegerInfo {
    let value = read32(context)
    return {index: index, type: type, value: value}
}

// Float
interface FloatInfo extends Info {
    value: number
}
function newFloat(index: number, context: ClassFileContext, type: InfoType) : FloatInfo {
    let value = readFloat(context)
    return {index: index, type: type, value: value}
}

// Double
interface DoubleInfo extends Info {
    value: number
}
function newDouble(index: number, context: ClassFileContext, type: InfoType) : DoubleInfo {
    let value = readDouble(context)
    return {index: index, type: type, value: value}
}

// Class
interface ClassInfo extends Info {
    value: number
}
function newClass(index: number, context: ClassFileContext, type: InfoType) : ClassInfo {
    let value = readU16(context)
    return {index: index, type: type, value: value}
}

// String
interface StringInfo extends Info {
    value: number
}
function newString(index: number, context: ClassFileContext, type: InfoType) : StringInfo {
    let value = readU16(context)
    return {type: type, index: index, value: value}
}

// Member Ref
interface MemberRefInfo extends Info {
    clazz: number
    nameAndType: number
}
function newMemberRef(index: number, context: ClassFileContext, type: InfoType) : MemberRefInfo {
    let clazz = readU16(context)
    let name = readU16(context)
    return {type: type, index: index, clazz: clazz, nameAndType: name, value: undefined}
}

// Name and Type
interface NameTypeInfo extends Info {
    name: number
    descriptor: number
}
function newNameType(index: number, context: ClassFileContext, type: InfoType) : NameTypeInfo {
    let name = readU16(context)
    let descriptor = readU16(context)
    return {type: type, index: index, name: name, descriptor: descriptor, value: undefined}
}

// Method Handle
interface MethodHandleInfo extends Info {
    refKind: number
    refIndex: number
}
function newMethodHandle(index: number, context: ClassFileContext, type: InfoType) : MethodHandleInfo {
    let refKind = readU8(context)
    let refIndex = readU16(context)
    return {type: type, index: index, refKind: refKind, refIndex: refIndex, value: undefined}
}

// Method Type
interface MethodTypeInfo extends Info {
    descriptor: number
}
function newMethodType(index: number, context: ClassFileContext, type: InfoType) : MethodTypeInfo {
    let descriptor = readU16(context)
    return {type: type, index: index, descriptor: descriptor, value: undefined}
}

// Dynamic Info
interface DynamicInfo extends Info {
    bootstrap: number
    nameType: number
}
function newDynamic(index: number, context: ClassFileContext, type: InfoType) : DynamicInfo {
    let bootstrap = readU16(context)
    let nameType = readU16(context)
    return {type: type, index: index, bootstrap: bootstrap, nameType: nameType, value: undefined}
}

// Module or Package Info
interface ModuleInfo extends Info {
    name: number
}
function newModule(index: number, context: ClassFileContext, type: InfoType) : ModuleInfo {
    let name = readU16(context)
    return {type: type, index: index, name: name, value: undefined}
}

export enum MemberType {
    FIELD,
    METHOD
}

// Field and Method Info
export interface MemberInfo {
    type: MemberType
    accessFlags: number
    name: number
    descriptor: number
    attributes: AttributeInfo[]
}
export function readMemberInfo(context: ClassFileContext, pool: ConstantPool, type: MemberType) : MemberInfo {
    let accessFlags = readU16(context)
    let name = readU16(context)
    let descriptor = readU16(context)
    let attrCount = readU16(context)
    let attributes = []
    for (var i = 0; i < attrCount; i++) attributes.push(readAttributeInfo(context, pool))
    return {type: type, accessFlags: accessFlags, name: name, descriptor: descriptor, attributes: attributes}
}

export enum AttributeType {
    AnnotationDefault = "AnnotationDefault",
    BootstrapMethods = "BootstrapMethods",
    Code = "Code",
    ConstantValue = "ConstantValue",
    Deprecated = "Deprecated",
    EnclosingMethod = "EnclosingMethod",
    Exceptions ="Exceptions",
    InnerClasses ="InnerClasses",
    LineNumberTable = "LineNumberTable",
    LocalVariableTable = "LocalVariableTable",
    LocalVariableTypeTable = "LocalVariableTypeTable",
    MethodParameters = "MethodParameters",
    NestHost = "NestHost",
    NestMembers = "NestMembers",
    RuntimeVisibleAnnotations = "RuntimeVisibleAnnotations",
    RuntimeInvisibleAnnotations = "RuntimeInvisibleAnnotations",
    RuntimeVisibleParameterAnnotations = "RuntimeVisibleParameterAnnotations",
    RuntimeInvisibleParameterAnnotations = "RuntimeInvisibleParameterAnnotations",
    RuntimeVisibleTypeAnnotations = "RuntimeVisibleTypeAnnotations",
    RuntimeInvisibleTypeAnnotations = "RuntimeInvisibleTypeAnnotations",
    Signature = "Signature",
    SourceFile = "SourceFile",
    Synthetic = "Synthetic",
    StackMap = "StackMap",
    StackMapTable = "StackMapTable",
    SourceDebugExtension = "SourceDebugExtension"
}

export interface AttributeInfo {
    type: AttributeType
    info: Buffer // byte array contains info depending on type of attribute
    attributes?: AttributeInfo[]
}
export function readAttributeInfo(context: ClassFileContext, pool: ConstantPool) : AttributeInfo {
    let name = readU16(context)
    let typeName = (pool.pool[name] as UTF8Info).value // Look up UTF string at name index
    let type = AttributeType[typeName]
    if (!type) throw `Unkown attribute type ${typeName}`
    switch (type) {
        case AttributeType.Code: return readCodeAttribute(context, pool, type)
        default: return readSimpleAttribute(context, pool, type)
    }
}

function readSimpleAttribute(context: ClassFileContext, pool: ConstantPool, type: AttributeType) : AttributeInfo {
    let byteLen = read32(context)
    let info = readBytes(context, byteLen)
    return {type: type, info: info }
}

function readCodeAttribute(context: ClassFileContext, pool: ConstantPool, type: AttributeType) : AttributeInfo {
    let attrLen = read32(context)
    let maxStack = readU16(context)
    let maxLocals = readU16(context)
    let codeLen = read32(context)
    let info = readBytes(context, codeLen)
    let exceptionCount = readU16(context)
    for (var i=0; i<exceptionCount; i++) {
        let start = readU16(context)
        let end = readU16(context)
        let handle = readU16(context)
        let type = readU16(context)
        // add it to a list here if you want it
    }
    let attributes = []
    let aCount = readU16(context)
    for (var i=0; i<aCount; i++) {
        attributes.push(readAttributeInfo(context, pool))
    }
    return {type: type, info: info, attributes: attributes}
}

//UTF8 String
let decoder = new StringDecoder('utf8')
function readUTF8(context: ClassFileContext) : string {
    let len = context.data.readUInt16BE(context.offset)
    context.offset += 2
    let buf = context.data.slice(context.offset, context.offset+len)
    let utf = decoder.write(buf)
    context.offset += len
    return utf
}

// Unsigned Short
export function readU16(context: ClassFileContext) : number {
    let value = context.data.readUInt16BE(context.offset)
    context.offset += 2
    return value
}

// Unsigned Int
export function readU32(context: ClassFileContext) : number {
    let value = context.data.readUInt32BE(context.offset)
    context.offset += 4
    return value
}

// Unsigned Byte
export function readU8(context: ClassFileContext) : number {
    let value = context.data.readUInt8(context.offset)
    context.offset += 1
    return value
}

// Integer
function read32(context: ClassFileContext) : number {
    let value = context.data.readInt32BE(context.offset)
    context.offset += 4
    return value
}

// Long
function read64(context: ClassFileContext) : number {
    let value1 = context.data.readInt32BE(context.offset)
    context.offset += 4
    let value2 = context.data.readInt32BE(context.offset)
    context.offset += 4
    return value1
}

function readDouble(context: ClassFileContext) : number {
    let value = context.data.readDoubleBE(context.offset)
    context.offset += 8
    return value
}

function readFloat(context: ClassFileContext) : number {
    let value = context.data.readFloatBE(context.offset)
    context.offset += 4
    return value
}

// Read the given number of bytes
function readBytes(context: ClassFileContext, len: number) : Buffer {
    let bytes = context.data.slice(context.offset, context.offset+len)
    context.offset += len
    return bytes
}