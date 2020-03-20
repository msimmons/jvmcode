export class ClassData {
    name: string
    path: string
    major: number
    minor: number
    lastModified: number
    accessFlags: number
    sourceFile: string
    implements: string[]
    extends: string
    inners: string[]
    references: string[]
    annotations: string[]
    fields: FieldData[]
    methods: MethodData[]

    constructor(path: string, lastModified: number) {
        this.path = path
        this.lastModified = lastModified
    }
}

export interface LineEntry {
    pc: number
    line: number
}

export class FieldData {
    name: string
    type: string
    isParam: boolean
    index: number
    line: number
    annotations: string[]

    constructor(name: string, type: string, isParam: boolean, index: number, line: number, annotations: string[]) {
        this.name = name
        this.type = type
        this.isParam = isParam
        this.index = index
        this.line = line
        this.annotations = annotations
    }
}

export class MethodData {
    name: string
    type: string
    params: FieldData[]
    locals: FieldData[]
    annotations: string[]

    constructor(name: string, type: string, allLocals: FieldData[], annotations: string[]) {
        this.name = name
        this.type = type
        this.params = allLocals.filter(l => l.isParam)
        this.locals = allLocals.filter(l => !l.isParam)
        this.annotations = annotations
    }

    extensionSignature() : string {
        let extensionMarker = this.params.find(p => p.name === `$this$${this.name}`)
        return extensionMarker ? extensionMarker.type : undefined
    }
}