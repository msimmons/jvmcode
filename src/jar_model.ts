import { ClassData } from "./class_data/class_data"

export class JarPackageData {
    entries: JarEntryData[];
    name: string;
}

export enum JarEntryType {
    CLASS,
    RESOURCE,
    SOURCE
}

export interface JarEntryData {
    fqcn: string
    name: string
    path: string
    type: JarEntryType
    resolved: boolean
}

export class ResourceEntryData implements JarEntryData {
    fqcn: string
    name: string
    path: string
    type: JarEntryType = JarEntryType.RESOURCE
    resolved: boolean = false
    constructor(name: string, path: string) {
        this.name = name
        this.fqcn = name
        this.path = path
    }
}

export class SourceEntryData implements JarEntryData {
    fqcn: string
    name: string
    path: string
    type = JarEntryType.SOURCE
    jarFile: string
    resolved: boolean = false
    constructor(name: string, path: string, jarFile: string) {
        this.name = name
        this.fqcn = name
        this.path = path
        this.jarFile = jarFile
    }
}

export class ClassEntryData implements JarEntryData {
    classData?: ClassData
    pkg: string
    name: string
    fqcn: string
    path: string
    srcEntry?: SourceEntryData
    type = JarEntryType.CLASS
    resolved: boolean = false
    constructor(pkg: string, name: string, path: string) {
        this.pkg = pkg
        this.name = name
        this.fqcn = `${pkg}.${name}`
        this.path = path
    }
}
