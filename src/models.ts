import * as vscode from 'vscode'
import { JarPackageData, JarEntryData, JarEntryType } from "./jar_model"
import { DependencySourceData, DependencyData, PathData, USER_SOURCE } from "./project_model"
import { ClassData } from "./class_data/class_data"
import { LanguageRequest } from 'server-models'
import { workspace, Uri } from "vscode"
import { iconService } from "./extension"

export class LocalConfig {
    javaHome: string
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
    CLASSDATA_ROOT,
    PATH,
    SOURCE,
    CLASSDATA,
    DEPENDENCY,
    PACKAGE,
    CLASS,
    RESOURCE,
    SOURCE_DIR,
    CLASS_DIR,
    LANGUAGE,
    TEST_SUITE,
    TEST_CASE,
    TEST_ERROR
}

export interface TreeNode {
    type: NodeType
    treeLabel() : string
    isTerminal: boolean
    isOpenable: boolean
    children() : TreeNode[]
    context? : string
    icon? : string
    tooltip?: string
}

export class LanguageNode implements TreeNode {
    type: NodeType = NodeType.LANGUAGE
    isTerminal: boolean = true
    isOpenable: boolean = false
    context?: string = 'language-node'
    tooltip = undefined
    request: LanguageRequest
    constructor(request: LanguageRequest) {
        this.request = request
        this.tooltip = request.languageId
    }
    treeLabel(): string {
        return this.request.name
    }
    children(): TreeNode[] {
        return []
    }
}

export class SuiteNode implements TreeNode {
    type: NodeType = NodeType.TEST_SUITE
    isTerminal: boolean = false
    isOpenable: boolean = true
    context?: string = 'suite-node'
    icon?: string = undefined
    tooltip?: string = undefined
    suite: JUnitSuite
    cases: CaseNode[]
    constructor(suite: JUnitSuite) {
        this.suite = suite
        this.cases = suite.testcase.map(tc => new CaseNode(tc))
        this.icon = suite.testcase.filter(tc => tc.failure != undefined).length ? iconService.getIconPath('error_outline-24px.svg') : iconService.getIconPath('check-24px.svg')
        this.tooltip = `Tests: ${suite.tests} Failures: ${suite.failures} Skipped: ${suite.skipped} at ${suite.timestamp}`
    }
    treeLabel(): string {
        return this.suite.name
    }
    children(): TreeNode[] {
        return this.cases
    }
}

export class CaseNode implements TreeNode {
    type: NodeType = NodeType.TEST_CASE
    isTerminal: boolean = false
    isOpenable: boolean = true
    context?: string = 'case-node'
    data: JUnitCase
    icon?: string = undefined
    tooltip = undefined
    failures: FailureNode[]
    constructor(data: JUnitCase) {
        this.data = data
        this.isTerminal = data.failure === undefined
        this.icon = data.failure ? iconService.getIconPath('error_outline-24px.svg') : iconService.getIconPath('check-24px.svg')
        this.failures = data.failure ? data.failure.map(f => new FailureNode(f)) : []
        this.tooltip = data.failure ? `${data.failure.length} failures` : undefined
    }
    treeLabel(): string {
        return this.data.name
    }
    children(): TreeNode[] {
        return this.failures
    }
}

export class FailureNode implements TreeNode {
    type: NodeType = NodeType.TEST_CASE
    isTerminal: boolean = true
    isOpenable: boolean = true
    context?: string = 'failure-node'
    tooltip = undefined
    data: JUnitFailure
    constructor(data: JUnitFailure) {
        this.data = data
        this.tooltip = data.type
    }
    treeLabel(): string {
        return this.data.message
    }
    children(): TreeNode[] {
        return []
    }
}

export class PathRootNode implements TreeNode {
    type = NodeType.PATH_ROOT
    data: PathData[]
    pathNodes: PathNode[]
    isTerminal = false
    isOpenable = false
    context = undefined
    tooltip = undefined
    constructor(data: PathData[]) {
        this.data = data
        this.pathNodes = data.map((cp) => {return new PathNode(cp)})
        this.context = 'path-data'
        this.tooltip = `${data.length} paths`
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
    tooltip = undefined
    constructor(data: DependencySourceData[]) {
        this.data = data
        let nodes = data.filter((ds) => {return ds.dependencies.length > 0}).map((ds) => {return new DependencySourceNode(ds)})
        this.sourceNodes = nodes
        this.context = 'dependency-data'
        this.tooltip = `${nodes.length} sources`
    }
    public treeLabel() : string {
        return 'Dependencies Sources'
    }
    public children() : TreeNode[] {
        return this.sourceNodes
    }
}

export class ClassDataRootNode implements TreeNode {
    type = NodeType.CLASSDATA_ROOT
    classDataNodes: ClassDataNode[]
    isTerminal = false
    isOpenable = false
    context = undefined
    tooltip = undefined
    constructor(data: ClassData[]) {
        this.classDataNodes = data.map((cd) => {return new ClassDataNode(cd)})
        this.tooltip = `${data.length} classes`
    }
    public treeLabel() : string {
        return 'Local Classes'
    }
    public children() : TreeNode[] {
        return this.classDataNodes
    }
    public update(cd: ClassData) {
        let ndx = this.classDataNodes.findIndex(d => d.data.path === cd.path)
        if (ndx < 0) {
            this.classDataNodes.push(new ClassDataNode(cd))
        }
        else {
            this.classDataNodes[ndx] = new ClassDataNode(cd)
        }
    }
}

export class ClassDataNode implements TreeNode {
    data: ClassData
    type = NodeType.CLASSDATA
    isTerminal = true
    isOpenable = true
    context = 'local-class'
    name: string
    tooltip = undefined
    constructor(data: ClassData) {
        this.data = data
        this.name = data.name.substring(this.data.name.lastIndexOf('/')+1)
        this.tooltip = data.path.replace(vscode.workspace.workspaceFolders[0].uri.path, '')
    }
    public treeLabel() : string {
        return this.name
    }
    public children() : TreeNode[] {
        return []
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
    tooltip = undefined
    constructor(data: PathData) {
        this.data = data
        let isUser = (data.source === USER_SOURCE)
        this.context = isUser ? 'user-item' : undefined
        this.classDirs = [new ClassDirNode(data.classDir, isUser)]
        this.sourceDirs = [new SourceDirNode(data.sourceDir, isUser)]
        this.tooltip = `${data.name}:${data.module}`
    }
    public treeLabel() : string {
        return this.data.source
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
    icon: string
    tooltip: string
    constructor(path: string, isUser: boolean) {
        this.path = path
        this.context = isUser ? 'user-path' : undefined
        this.icon = iconService.getIconPath('file_text.svg')
        this.tooltip = 'Source'
    }
    public treeLabel() : string {
        return this.path.replace(workspace.workspaceFolders[0].uri.path+'/', '')
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
    icon: string
    tooltip: string
    constructor(path: string, isUser: boolean) {
        this.path = path
        this.context = isUser ? 'user-path' : undefined
        this.icon = iconService.getIconPath('file_binary.svg')
        this.tooltip = 'Class'
    }
    public treeLabel() : string {
        return this.path.replace(workspace.workspaceFolders[0].uri.path+'/', '')
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
    tooltip: string
    constructor(data: DependencySourceData) { 
        this.data = data 
        let isUser = data.source.toLocaleLowerCase() === 'user'
        this.context = isUser ? 'user-source' : undefined
        this.dependencies = data.dependencies.map((d) => { return new DependencyNode(d, isUser) })
    }
    public treeLabel() : string {
        this.tooltip = `${this.dependencies.length} dependencies`
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
    tooltip: string
    constructor(dependency: DependencyNode, data: JarPackageData) { 
        this.data = data
        this.dependency = dependency.data
        this.name = data.name
        this.entries = data.entries.map((entry) => {
            return new JarEntryNode(this, entry)
        })
        this.tooltip = `${data.entries.length} entries`
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
    context = undefined
    constructor(pkgNode: JarPackageNode, data: JarEntryData) { 
        this.data = data
        this.package = pkgNode.data
        this.dependency = pkgNode.dependency
        this.name = data.name
        this.type = data.type === JarEntryType.CLASS ? NodeType.CLASS : NodeType.RESOURCE
        this.context = data.type === JarEntryType.CLASS ? 'class-item' : 'resource-item'
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
    filename: string
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