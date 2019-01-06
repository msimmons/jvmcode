import { DependencySource, DependencyData, JarPackageData, JarEntryData} from "server-models"

export enum NodeType {
    SOURCE,
    DEPENDENCY,
    PACKAGE,
    CLASS,
    RESOURCE
}

export interface TreeNode {
    type: NodeType
    treeLabel() : string
}

export class DependencySourceNode implements TreeNode {
    data: DependencySource
    type = NodeType.SOURCE
    dependencies: DependencyNode[]
    constructor(data: DependencySource) { 
        this.data = data 
        this.dependencies = data.dependencies.map((d) => { return new DependencyNode(d) })
    }
    public treeLabel() : string {
        return this.data.description
    }
}

export class DependencyNode implements TreeNode {
    data: DependencyData
    packages: JarPackageNode[]
    type = NodeType.DEPENDENCY
    constructor(data: DependencyData) { this.data = data}
    public treeLabel() : string  {
        return dependencyLabel(this.data)
    }
}

/**
 * Decide how to label a dependency, either artifact coords or file name
 * @param data 
 */
export function dependencyLabel(data: DependencyData) : string {
    if ( data.groupId ) {
        return data.groupId + ':' + data.artifactId + ':' + data.version 
    }
    else {
        return data.fileName
    }
}

export class JarPackageNode implements TreeNode {
    data: JarPackageData
    dependency: DependencyData
    name: string
    type = NodeType.PACKAGE
    entries: JarEntryNode[]
    constructor(dependency: DependencyNode, data: JarPackageData) { 
        this.data = data
        this.dependency = dependency.data
        this.name = data.name
        this.entries = data.entries.map((entry) => {
            return new JarEntryNode(this, entry)
        })
    }
    public treeLabel() : string { 
        return this.name
    }
}

export class JarEntryNode implements TreeNode {
    data: JarEntryData
    package: JarPackageData
    dependency: DependencyData
    name: string
    type: NodeType
    content: string
    contentName: string
    constructor(pkgNode: JarPackageNode, data: JarEntryData) { 
        this.data = data
        this.package = pkgNode.data
        this.dependency = pkgNode.dependency
        this.name = data.name
        this.type = data.type === 'CLASS' ? NodeType.CLASS : NodeType.RESOURCE
    }
    public treeLabel() : string { 
        return this.name
    }
}