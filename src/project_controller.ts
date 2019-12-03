'use strict';

import * as vscode from 'vscode'
import { JarEntryData, JvmProject } from "server-models"
import { ProjectTreeProvider } from './project_tree_provider';
import { JarContentProvider } from './jar_content_provider';
import { ProjectService } from './project_service';
import { JarEntryNode, dependencyLabel, PathRootNode, DependencyRootNode, TreeNode, DependencySourceNode, DependencyNode, JarPackageNode, NodeType, SourceDirNode, ClassDirNode, CompilationContext, FileContext } from './models';
import { projectService, projectController } from './extension';
import { existsSync, readdirSync, statSync } from 'fs';
import * as PathHelper from 'path'
import { ConfigService } from './config_service';

/**
 * Responsible for managing various views related to a project
 */
export class ProjectController {

    private USER_SOURCE = 'USER_DEPENDENCIES'
    private USER_PATHS = 'USER_PATHS'
    private context: vscode.ExtensionContext
    private service: ProjectService
    private dependencyTree: ProjectTreeProvider
    private contentProvider: JarContentProvider
    private isStarted = false
    private pathRootNode: PathRootNode
    private depedencyRootNode: DependencyRootNode
    private classpath: string

    public constructor(context: vscode.ExtensionContext, service: ProjectService) {
        this.context = context
        this.service = service
        this.registerProjectListener()
        this.restoreUserData()
    }

    public async start() {
        if (this.isStarted) return
        this.dependencyTree = new ProjectTreeProvider(this)
        vscode.window.registerTreeDataProvider(this.dependencyTree.viewId, this.dependencyTree)
        this.contentProvider = new JarContentProvider()
        vscode.workspace.registerTextDocumentContentProvider(this.contentProvider.scheme, this.contentProvider)
        vscode.commands.executeCommand('setContext', 'jvmcode.context.isJvmProject', true)
        this.isStarted = true
        await this.service.requestProject()
    }

    /** 
     * Register a consumer for dependencies coming from
     * the server
     */
    private registerProjectListener() {
        this.service.registerProjectListener((jvmProject: JvmProject) => {
            this.start()
            this.depedencyRootNode = new DependencyRootNode(jvmProject.dependencySources)
            this.pathRootNode = new PathRootNode(jvmProject.paths)
            this.classpath = jvmProject.classpath
            this.updateDependencies()
            this.saveUserData(jvmProject)
        })
    }

    /**
     * Alert components that dependencies have been updated
     * @param dependencies 
     */
    public updateDependencies() {
        this.dependencyTree.update()
    }

    /**
     * Return the root nodes for the tree view 
     */
    public getRootNodes() : TreeNode[] {
        return [this.pathRootNode, this.depedencyRootNode]
    }

    /**
     * Return all the dependency source nodes
     */
    public getSourceNodes() : DependencySourceNode[] {
        return this.depedencyRootNode.sourceNodes
    }

    /**
     * Return the children of the given TreeNode -- could require some lazy loading
     */
    public async getChildren(node: TreeNode) : Promise<TreeNode[]> {
        switch (node.type) {
            case NodeType.DEPENDENCY:
                let dn = node as DependencyNode
                dn.packages = await this.getPackageNodes(dn)
            default:
                return node.children()
        }
    }

    /**
     * Return all the package nodes for the given dependency; this resolves all the entries in the jar file as well
     */
    public async getPackageNodes(dependency: DependencyNode) : Promise<JarPackageNode[]> {
        if (dependency.packages) return dependency.packages
        try {
            let packages = await this.service.getPackages(dependency.data)
            let nodes = packages.map((pkgData) => { return new JarPackageNode(dependency, pkgData) })
            dependency.packages = nodes
            return nodes
        }
        catch(error) {
            vscode.window.showErrorMessage(error.message)
            return []
        }
    }

    /**
     * Return all classes in registered class directories (returned as JarEntryData for uniformity)
     */
    public getClasses() : JarEntryData[] {
        let entries = []
        this.pathRootNode.data.forEach((cp) => {
            cp.classDirs.forEach((dir) => {
                let files = this.getFiles(dir).filter((file) => {return file.indexOf('$') <= 0})
                entries = entries.concat(files.map((file) => {
                    let path = dir.replace(vscode.workspace.workspaceFolders[0].uri.path+'/', `${cp.source}:`)
                    file = file.replace(dir, '').replace('.class', '')
                    let ndx = file.lastIndexOf('/')
                    let name = file.substr(ndx+1)
                    let pkg = file.substr(1, ndx-1).replace(/\//g, '.')
                    return { type: 'CLASS', name: name, pkg: pkg, path: path } as JarEntryData
                })
            )})
        })
        return entries
    }

    /**
     * Return all the JarEntryNodes accross all dependencies, has the effect of resolving all packages in each
     * dependency
     */
    public async getJarEntryNodes() : Promise<JarEntryNode[]> {
        let packages : JarPackageNode[][] = []
        for (var node of this.depedencyRootNode.sourceNodes) {
            for (var dep of node.dependencies) {
                packages.push(await this.getPackageNodes(dep))
            }
        }
        // Wait for all the packages to resolve, than get the entries
        return Promise.all(packages).then((depPkgs) => {
            let jarEntries = []
            for (var pkgList of depPkgs) {
                for (var pkg of pkgList) {
                    jarEntries = jarEntries.concat(pkg.entries)
                }
            }
            return jarEntries
        })
    }

    /**
     * Get the jar entry's content from the service
     * @param entryNode 
     */
    private async getJarEntryContent(entryNode: JarEntryNode) : Promise<JarEntryData> {
        return await this.service.getJarEntryContent(entryNode)
    }

    /**
     * Open the text editor with the node's content if available
     * TODO Optional goto symbol location
     * @param entryNode 
     */
    private openJarEntryContent(entryNode: JarEntryNode) {
        if (!entryNode.content) return
        let jarFile = entryNode.dependency.fileName
        let pkg = entryNode.package.name
        let uri = vscode.Uri.parse(this.contentProvider.scheme + '://' + jarFile + '/' + pkg + '/' + entryNode.contentName)
        vscode.workspace.openTextDocument(uri).then((doc) => {
            this.contentProvider.update(uri, entryNode.content)
            vscode.window.showTextDocument(doc, { preview: true }).then((te) => {
                // Things to do -- get rid of selection?
            })
        })
    }

    /**
     * Open the contents of a jar entry in a text editor
     */
    public openJarEntry(entryNode: JarEntryNode) {
        if (entryNode.content) {
            this.openJarEntryContent(entryNode)
            return
        }
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: entryNode.name}, (progess) => {
            return this.getJarEntryContent(entryNode).then((reply) => {
                entryNode.content = reply.text
                entryNode.contentName = reply.name
                this.openJarEntryContent(entryNode)
            }).catch(error => {
                vscode.window.showErrorMessage(error)
            })
        })
    }

    /**
     * Let user find a class from the universe of classes for this project; starts with project classes only and
     * adds external dependeny classes as needed (to limit size of list which could be quite large)
     */
    public findClass() {
        let jarEntries = this.getJarEntryNodes()
        let classes = this.getClasses()
        Promise.all([jarEntries]).then((results) => {
            let quickPick = vscode.window.createQuickPick()
            quickPick.matchOnDescription = true
            let classItems = classes.map((c) => {
                return { label: c.name, description: `${c.pkg} (${c.path})`, detail: 'No Detail Shows', entry: c } as vscode.QuickPickItem
            })
            let jarItems = undefined
            quickPick.items = classItems
            quickPick.onDidAccept(selection => {
                quickPick.dispose()
                if (quickPick.selectedItems.length) {
                    projectController.openJarEntry(quickPick.selectedItems[0]['entry'])
                }
            })
            quickPick.onDidChangeValue(event => {
                if (event.length > 0 && quickPick.activeItems.length === 0) {
                    if (!jarItems) {
                        quickPick.busy = true
                        Promise.all([jarEntries]).then((results) => {
                            jarItems = results[0].map((r) => {
                                let detail = dependencyLabel(r.dependency)
                                return { label: r.name, description: `${r.package.name} (${detail})`, detail: detail, entry: r } as vscode.QuickPickItem
                            })
                        }).catch((reason) => {
                            console.error(reason)
                            jarItems = []
                        })
                        quickPick.busy = false
                    }
                    quickPick.items = quickPick.items.concat(jarItems.filter((ji) => {
                        return ji.label.toLowerCase().includes(event.toLowerCase())
                    }))
                }
                else if (event.length === 0) {
                    quickPick.items = classItems
                }
            })
            quickPick.show()
        })
    }

    /**
     * Add a user dependency
     */
    public addDependency() {
        vscode.window.showOpenDialog({filters: {'Dependency': ['jar']}, canSelectMany: false}).then((jarFile) => {
            if (!jarFile || jarFile.length === 0) return
            vscode.window.showOpenDialog({filters: {'Source': ['jar', 'zip']}, canSelectMany: false}).then((srcFile) => {
                let srcPath = (!srcFile || srcFile.length === 0) ? undefined : srcFile[0]['path']
                projectService.addDependency(jarFile[0]['path'], srcPath)
            })
        })
    }

    /**
     * Add a user class directory
     */
    public addClassDir() {
        let classOptions = {placeHolder: 'Class Directory', defaultUri: vscode.workspace.workspaceFolders[0].uri, canSelectMany: false, canSelectFolders: true, canSelectFiles: false}
        vscode.window.showOpenDialog(classOptions).then((cd) => {
            if (!cd) return
            projectService.addPath({source:'user', module: 'user', name: 'user', classDirs: [cd[0]['path']], sourceDirs: []})
        })
    }

    /**
     * Add a user source directory
     */
    public addSourceDir() {
        let sourceOptions = {placeHolder: 'Source Directory', defaultUri: vscode.workspace.workspaceFolders[0].uri, canSelectMany: false, canSelectFolders: true, canSelectFiles: false}
        vscode.window.showOpenDialog(sourceOptions).then((cd) => {
            if (!cd) return
            projectService.addPath({source:'user', module: 'user', name: 'user', classDirs: [], sourceDirs: [cd[0]['path']]})
        })
    }

    /**
     * Remove the given user item
     */
    public removeUserItem(item: TreeNode) {
        switch (item.type) {
            case NodeType.CLASS_DIR:
                projectService.removePath((item as ClassDirNode).path)
                break
            case NodeType.SOURCE_DIR:
                projectService.removePath((item as SourceDirNode).path)
                break
            case NodeType.DEPENDENCY:
                projectService.removeDependency((item as DependencyNode).data.fileName)
                break
            default:
                break
        }
    }

    /**
     * Get the current classpath
     */
    public getClasspath() : string {
        return this.classpath ? this.classpath : ""
    }

    /**
     * Get the current source paths
     */
    public getSourcePaths() : string[] {
        let paths = []
        this.pathRootNode.data.forEach((d) => {
            paths = paths.concat(d.sourceDirs)
        })
        return paths
    }

    /**
     * Save any user data in the current project
     */
    private saveUserData(project: JvmProject) {
        // Find the single user path entry
        let userPaths = project.paths.find((p) => { return p.source.toLowerCase() === 'user' })
        this.context.workspaceState.update(this.USER_PATHS, userPaths)
        // Find the single user source entry
        let userSource = project.dependencySources.find((p) => { return p.source.toLowerCase() === 'user' })
        this.context.workspaceState.update(this.USER_SOURCE, userSource)
    }

    /**
     * Restore any user data
     */
    private async restoreUserData() {
        let userPaths =  this.context.workspaceState.get(this.USER_PATHS, undefined)
        let userSource = this.context.workspaceState.get(this.USER_SOURCE, undefined)
        if ((!userPaths) && (!userSource)) return
        else {
            let dependencySources = (userSource) ? [userSource] : []
            let paths = (userPaths) ? [userPaths] : []
            await this.start()
            let project = {dependencySources: dependencySources, paths: paths, source: 'USER'}
            await projectService.updateUserProject(project)
        }
    }

    /**
     * Return the compilation context for the given file uri
     * Finding the output dir is a hack because gradle sucks at this!
     */
    public getFileContext(file: vscode.Uri) : FileContext {
        let context = new FileContext()
        let config = ConfigService.getConfig()
        let filePath = file.path
        let fileExt = PathHelper.extname(filePath).replace('.', '')
        let sourceDir = undefined
        let pathData = this.pathRootNode.data.find((pd) => {
            sourceDir = pd.sourceDirs.find((d) => {
                return filePath.startsWith(d)
            })
            return sourceDir
        })
        let entry = config.outputDirMap.find((od) => { return od.startsWith(`${fileExt}:`) })
        context.path = filePath
        context.sourceDir = sourceDir
        if (pathData && entry) {
            let keyword = entry.split(':')[1]
            context.outputDir = pathData.classDirs.find((d) => { return d.includes(keyword) })
            return context
        }
        else {
            vscode.window.showErrorMessage(`Could not find output directory for ${filePath}`)
            return undefined
        }
    }

    /**
     * Return the FQCN of the current file
     */
    public getFQCN() : string {
        let curFile = vscode.window.activeTextEditor.document.fileName
        curFile = curFile.substring(0, curFile.lastIndexOf('.'))
        let path = this.getSourcePaths().find((p) => { return curFile.startsWith(p)})
        if (!path) return `No FQCN found for ${curFile} in ${this.getSourcePaths()}`
        path = (path.endsWith('/')) ? path : path + '/'
        return curFile.replace(path, '').replace(/\//g, '.')
    }

    public file2fqcn(filename: string) : string {
        let path = this.getSourcePaths().find((p) => { return filename.startsWith(p)})
        if (!path) return `No FQCN found for ${filename} in ${this.getSourcePaths()}`
        path = (path.endsWith('/')) ? path : path + '/'
        return filename.replace(path, '').replace(/\//g, '.')
    }

    private getFiles(dir: string) : string[] {
        let files = []
        if (!existsSync(dir)) return files
        readdirSync(dir).forEach((entry) => {
            let file = PathHelper.join(dir, entry)
            if (statSync(file).isDirectory()) {
                files = files.concat(this.getFiles(file))
            } else {
                files.push(file)
            }
        })
        return files
    }
}