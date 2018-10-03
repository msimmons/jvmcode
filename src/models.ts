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
    docFilename: string
    scopes: string[]
    modules: string[]
    groupId: string
    artifactId: string
    version: string
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
    text?: string
}

export class DependencyNode implements TreeNode {
    data: DependencyData
    type = 'dependency'
    constructor(data: DependencyData) { this.data = data}
    public treeLabel() : string  {
        return this.data.source + ': ' + this.data.groupId + ':' + this.data.artifactId + ':' + this.data.version 
    }
}

export class JarPackageNode implements TreeNode {
    dependency: string
    name: string
    type = 'package'
    constructor(dependency: DependencyNode, data: JarPackageData) { 
        this.dependency = dependency.treeLabel()
        this.name = data.name
        this.entries = data.entries.map((entry) => {
            return new JarEntryNode(this, entry.name, entry.type)
        })
    }
    public treeLabel() : string { 
        return this.name
    }
    entries: JarEntryNode[]
}

export class JarEntryNode implements TreeNode {
    dependency: string
    pkg: string
    name: string
    type: string
    content: string
    constructor(pkg: JarPackageNode, name: string, type: string) { 
        this.dependency = pkg.dependency
        this.pkg = pkg.name
        this.name = name
        this.type = type
    }
    public treeLabel() : string { 
        return this.name
    }
}