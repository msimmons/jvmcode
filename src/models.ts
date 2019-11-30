import { DependencySourceData, DependencyData, JarPackageData, JarEntryData, ClasspathData} from "server-models"

export enum NodeType {
    CLASSPATH_ROOT,
    DEPENDENCY_ROOT,
    CLASSPATH,
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

export class ClasspathRootNode implements TreeNode {
    type = NodeType.CLASSPATH_ROOT
    data: ClasspathData[]
    classpathNodes: ClasspathNode[]
    constructor(data: ClasspathData[]) {
        this.data = data
        this.classpathNodes = data.map((cp) => {return new ClasspathNode(cp)})
    }
    public treeLabel() : string {
        return 'Source/Class Directories'
    }
}

export class DependencyRootNode implements TreeNode {
    type = NodeType.DEPENDENCY_ROOT
    data: DependencySourceData[]
    sourceNodes: DependencySourceNode[]
    constructor(data: DependencySourceData[]) {
        this.data = data
        this.sourceNodes = data.filter((ds) => {return ds.dependencies.length > 0}).map((ds) => {return new DependencySourceNode(ds)})
    }
    public treeLabel() : string {
        return 'External Dependencies'
    }
}

export class ClasspathNode implements TreeNode {
    data: ClasspathData
    type = NodeType.CLASSPATH
    constructor(data: ClasspathData) {
        this.data = data
    }
    public treeLabel() : string {
        return `${this.data.source} (${this.data.name}:${this.data.module})`
    }
}

export class DependencySourceNode implements TreeNode {
    data: DependencySourceData
    type = NodeType.SOURCE
    dependencies: DependencyNode[]
    constructor(data: DependencySourceData) { 
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

export enum SourceType {
    MAIN,
    TEST
}

export class CompilationContext {
    sourceRoot: string
    sourceType: SourceType
    classpath : string
    outputDir : string
    sourcepath : string
    generatedSrcDir : string
    options: string[]
}