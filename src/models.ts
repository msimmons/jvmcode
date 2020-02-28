import { DependencySourceData, DependencyData, JarPackageData, JarEntryData, PathData, JvmConfig } from "server-models"
import { workspace, Uri } from "vscode"

export class LocalConfig implements JvmConfig {
    excludes: string[]
    extensions: string[]
    jmodIncludes: string[]
    outputDirMap: string[]
    srcLocation: string
    // Local
    testResultsDir: string
}

export enum NodeType {
    PATH_ROOT,
    DEPENDENCY_ROOT,
    PATH,
    SOURCE,
    DEPENDENCY,
    PACKAGE,
    CLASS,
    RESOURCE,
    SOURCE_DIR,
    CLASS_DIR
}

export interface TreeNode {
    type: NodeType
    treeLabel() : string
    isTerminal: boolean
    isOpenable: boolean
    children() : TreeNode[]
    context? : string
}

export class PathRootNode implements TreeNode {
    type = NodeType.PATH_ROOT
    data: PathData[]
    pathNodes: PathNode[]
    isTerminal = false
    isOpenable = false
    context = undefined
    constructor(data: PathData[]) {
        this.data = data
        this.pathNodes = data.map((cp) => {return new PathNode(cp)})
        this.context = 'path-data'
    }
    public treeLabel() : string {
        return 'Paths'
    }
    public children() : TreeNode[] {
        return this.pathNodes
    }
}

export class DependencyRootNode implements TreeNode {
    type = NodeType.DEPENDENCY_ROOT
    data: DependencySourceData[]
    sourceNodes: DependencySourceNode[]
    isTerminal = false
    isOpenable = false
    context = undefined
    constructor(data: DependencySourceData[]) {
        this.data = data
        this.sourceNodes = data.filter((ds) => {return ds.dependencies.length > 0}).map((ds) => {return new DependencySourceNode(ds)})
        this.context = 'dependency-data'
    }
    public treeLabel() : string {
        return 'Dependencies'
    }
    public children() : TreeNode[] {
        return this.sourceNodes
    }
}

export class PathNode implements TreeNode {
    data: PathData
    type = NodeType.PATH
    sourceDirs: SourceDirNode[]
    classDirs: ClassDirNode[]
    isTerminal = false
    isOpenable = false
    context = undefined
    constructor(data: PathData) {
        this.data = data
        let isUser = (data.source.toLowerCase() === 'user')
        this.context = isUser ? 'user-item' : undefined
        this.classDirs = [new ClassDirNode(data.classDir, isUser)]
        this.sourceDirs = [new SourceDirNode(data.sourceDir, isUser)]
    }
    public treeLabel() : string {
        return `${this.data.source} (${this.data.name}:${this.data.module})`
    }
    public children() : TreeNode[] {
        return this.sourceDirs.concat(this.classDirs)
    }
}

export class SourceDirNode implements TreeNode {
    path: string
    type = NodeType.SOURCE_DIR
    isTerminal = true
    isOpenable = false
    context?: string
    constructor(path: string, isUser: boolean) {
        this.path = path
        this.context = isUser ? 'user-item' : undefined
    }
    public treeLabel() : string {
        return 'Source: ' + this.path.replace(workspace.workspaceFolders[0].uri.path+'/', '')
    }
    public children() : TreeNode[] {
        return []
    }
}

export class ClassDirNode implements TreeNode {
    path: string
    type = NodeType.CLASS_DIR
    isTerminal = true
    isOpenable = false
    context: string
    constructor(path: string, isUser: boolean) {
        this.path = path
        this.context = isUser ? 'user-item' : undefined
    }
    public treeLabel() : string {
        return 'Class: ' + this.path.replace(workspace.workspaceFolders[0].uri.path+'/', '')
    }
    public children() : TreeNode[] {
        return []
    }
}

export class DependencySourceNode implements TreeNode {
    data: DependencySourceData
    type = NodeType.SOURCE
    dependencies: DependencyNode[]
    isTerminal = false
    isOpenable = false
    context = undefined
    constructor(data: DependencySourceData) { 
        this.data = data 
        let isUser = data.source.toLocaleLowerCase() === 'user'
        this.context = isUser ? 'user-source' : undefined
        this.dependencies = data.dependencies.map((d) => { return new DependencyNode(d, isUser) })
    }
    public treeLabel() : string {
        return this.data.description
    }
    public children() : TreeNode[] {
        return this.dependencies
    }
}

export class DependencyNode implements TreeNode {
    data: DependencyData
    packages: JarPackageNode[]
    type = NodeType.DEPENDENCY
    isTerminal = false
    isOpenable = false
    context = undefined
    constructor(data: DependencyData, isUser: boolean) { 
        this.data = data
        this.context = isUser ? 'user-item' : undefined
        // packages are lazily loaded thru controller
    }
    public treeLabel() : string  {
        return dependencyLabel(this.data)
    }
    public children() : TreeNode[] {
        return this.packages
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
    isTerminal = false
    isOpenable = false
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
    public children() : TreeNode[] {
        return this.entries
    }
}

export class JarEntryNode implements TreeNode {
    data: JarEntryData
    package: JarPackageData
    dependency: DependencyData
    name: string
    type: NodeType
    isTerminal = true
    isOpenable = true
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
    public children() : TreeNode[] {
        return []
    }
}

export class FileContext {
    path: string
    sourceDir: string
    outputDir: string
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

export interface JUnitFailure {
    stack: string
    message: string
    type: string
}

export interface JUnitCase {
    name: string
    classname: string
    time: number
    failure?: JUnitFailure[]
}

export interface JUnitSuite {
    name: string
    tests: number
    skipped: number
    failures: number
    errors: number
    timestamp: string
    hostname: string
    time: number
    properties: string
    testcase: JUnitCase[]
    systemOut: string
    systemErr: string
}

export interface JUnitReport {
    testsuite: JUnitSuite[]
}