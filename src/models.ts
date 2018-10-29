export interface TreeNode {
    type: string
    treeLabel() : string
}

/**
 * Describes a dependency which is normally a jar file; the source can be
 * the user, a build system (eg gradle) or this system (JDK)
 */
export interface DependencyData {
    source: string
    fileName: string
    sourceFileName: string
    scopes: string[]
    modules: string[]
    groupId: string
    artifactId: string
    version: string
    transitive: boolean
    packages: JarPackageData[]
}

/**
 * Describes a set of source and class directories to facilitate finding corresponding objects in the current project
 */
export interface ClasspathData {
    source: string
    name: string
    module: string
    sourceDirs: string[]
    classDirs: string[]
}

/**
 * A package contained in a jar file
 */
export interface JarPackageData {
    name: string
    entries: JarEntryData[]
}

/**
 * A file entry in a jar file
 */
export interface JarEntryData {
    type: string
    name: string
    pkg: string
    text?: string
}

export class DependencyNode implements TreeNode {
    data: DependencyData
    type = 'dependency'
    constructor(data: DependencyData) { this.data = data}
    public treeLabel() : string  {
        return this.data.source + ':' + this.data.groupId + ':' + this.data.artifactId + ':' + this.data.version 
    }
}

export class JarPackageNode implements TreeNode {
    data: JarPackageData
    dependency: string
    name: string
    type = 'package'
    constructor(dependency: DependencyNode, data: JarPackageData) { 
        this.data = data
        this.dependency = dependency.data.fileName
        this.name = data.name
        this.entries = data.entries.map((entry) => {
            return new JarEntryNode(this, entry)
        })
    }
    public treeLabel() : string { 
        return this.name
    }
    entries: JarEntryNode[]
}

export class JarEntryNode implements TreeNode {
    data: JarEntryData
    dependency: string
    pkg: string
    name: string
    type: string
    content: string
    contentName: string
    constructor(pkg: JarPackageNode, data: JarEntryData) { 
        this.data = data
        this.dependency = pkg.dependency
        this.pkg = pkg.name
        this.name = data.name
        this.type = data.type
    }
    public treeLabel() : string { 
        return this.name
    }
}