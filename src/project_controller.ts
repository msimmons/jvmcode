'use strict';

import * as vscode from 'vscode'
import { JarEntryData, ClassEntryData, SourceEntryData, JarEntryType } from "./jar_model"
import { JvmProject, PathData, USER_SOURCE, SYSTEM_SOURCE } from "./project_model"
import { ClassData } from "./class_data/class_data"
import { ProjectTreeProvider } from './project_tree_provider'
import { JarContentProvider } from './jar_content_provider'
import { ClassContentProvider } from './class_content_provider'
import { JarEntryNode, dependencyLabel, PathRootNode, DependencyRootNode, TreeNode, DependencySourceNode, DependencyNode, JarPackageNode, NodeType, FileContext, PathNode, ClassDataRootNode, ClassDataNode } from './models';
import * as fs from 'fs';
import * as PathHelper from 'path'
import { ProjectRepository } from './project_repository';
import { ProjectUpdateData } from './project_model';
import { ConfigService } from './config_service';

/**
* Responsible for managing various views related to a project
*/
export class ProjectController {
    
    private USER_SOURCE = 'USER_DEPENDENCIES'
    private USER_PATHS = 'USER_PATHS'
    private context: vscode.ExtensionContext
    public repo: ProjectRepository
    private projectTree: ProjectTreeProvider
    private jarContentProvider: JarContentProvider
    private classContentProvider: ClassContentProvider
    private isStarted = false
    private pathRootNode: PathRootNode
    private depedencyRootNode: DependencyRootNode
    private classDataRootNode: ClassDataRootNode
    private entryNodeMap: Map<string, JarEntryNode[]> = new Map() // Lazy cache of FQCN to entryNode
    private classWatchers: Map<string, vscode.FileSystemWatcher> = new Map() // Path -> watcher
    private projectListeners = [] // Array of project callbacks to be notified of updated JvmProject
    
    public constructor(context: vscode.ExtensionContext, repo: ProjectRepository) {
        this.context = context
        this.repo = repo
        this.restoreUserData()
    }
    
    public start() { // should be private but for tests
        if (this.isStarted) return
        this.projectTree = new ProjectTreeProvider(this)
        vscode.window.registerTreeDataProvider(this.projectTree.viewId, this.projectTree)
        this.jarContentProvider = new JarContentProvider(this.repo)
        vscode.workspace.registerTextDocumentContentProvider(this.jarContentProvider.scheme, this.jarContentProvider)
        this.classContentProvider = new ClassContentProvider()
        vscode.workspace.registerTextDocumentContentProvider(this.classContentProvider.scheme, this.classContentProvider)
        vscode.commands.executeCommand('setContext', 'jvmcode.context.isJvmProject', true)
        this.isStarted = true
    }

    /**
     * Register a listener for project updates
     * @param callback(project: JvmProject)
     */
    public registerProjectListener(callback) {
        this.projectListeners.push(callback)
    }

    /**
     * Call each listener callback
     * @param project
     */
    private notifyListeners(project: JvmProject) {
        this.projectListeners.forEach(l => l(project))
    }

    /**
     * This API will be exposed to other extensions that can supply [ProjectUpdateData]
     * @param data 
     */
    public async updateProjectData(data: ProjectUpdateData) {
        let jvmProject = await this.repo.updateProject(ConfigService.getConfig(), data)
        this.updateJvmProject(jvmProject)
    }

    /**
     * Update all the data structures tracking the jvm project
     */
    private updateJvmProject(project: JvmProject) {
        this.start()
        this.depedencyRootNode = new DependencyRootNode(project.dependencySources)
        this.pathRootNode = new PathRootNode(project.paths)
        this.ensureClassWatchers(project.paths)
        this.classDataRootNode = new ClassDataRootNode(project.classdata)
        this.updateViews()
        this.saveUserData(project)
        this.notifyListeners(project)
    }
    
    /**
     * Ensure that the given class directories are being watched
     */
    private ensureClassWatchers(paths: PathData[]) {
        paths.forEach(p => {
            if (!this.classWatchers.has(p.classDir)) {
                if (p.classDir) {
                    let pattern = `${p.classDir}/**/*.class`
                    let w = vscode.workspace.createFileSystemWatcher(pattern, false, false, true)
                    w.onDidChange(this.classFileHandler)
                    w.onDidCreate(this.classFileHandler)
                    this.classWatchers.set(p.classDir, w)
                }
            }
        })
    }

    /**
     * Handle class file creation and modification
     */
    private classFileHandler = async (uri: vscode.Uri) => {
        let data = await this.repo.getClassDataForPath(uri.path)
        this.updateClassData(data)
        this.updateViews()
    }

    /**
    * Alert components that project has been updated
    * @param dependencies 
    */
    private updateViews() {
        this.projectTree.update()
    }
    
    /**
    * Return the root nodes for the tree view 
    */
    public getRootNodes() : TreeNode[] {
        return [this.depedencyRootNode, this.pathRootNode, this.classDataRootNode]
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
        let config = ConfigService.getConfig()
        try {
            let packages = await this.repo.resolvePackages(dependency.data)
            let nodes = packages.filter(p => config.excludes.find(e => p.name.startsWith(e)) ? false : true)
                .map((pkgData) => { return new JarPackageNode(dependency, pkgData) })
            dependency.packages = nodes
            return nodes
        }
        catch(error) {
            vscode.window.showErrorMessage(error.message)
            return []
        }
    }
    
    public async getClassData() : Promise<ClassData[]> {
        return await this.repo.getClassData()
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
    * Resolve the jar entry's associated source if necessary; also read [ClassData]
    * for class resources
    * @param entryNode 
    */
    private async resolveJarEntryNode(entryNode: JarEntryNode) : Promise<JarEntryData> {
        switch (entryNode.data.type) {
            case JarEntryType.CLASS:
                if (!(entryNode.data as ClassEntryData).srcEntry) {
                    return this.repo.resolveJarEntryData(entryNode.data.fqcn, entryNode.dependency.fileName)
                }
            default:
                return entryNode.data
        }
    }

    private updateClassData(data: ClassData) {
        this.classDataRootNode.update(data)
        let path = data.path
        let scheme = this.classContentProvider.scheme
        let authority = 'classdata'
        let uri = vscode.Uri.file(path).with({scheme: scheme, authority: authority})
        this.classContentProvider.addClassData(uri, data)
    }

    private getEntryUri(entry: JarEntryNode, openClassData: boolean) : vscode.Uri {
        let srcEntry : SourceEntryData = (entry.data.type === JarEntryType.CLASS) ? (entry.data as ClassEntryData).srcEntry : undefined
        let path = (srcEntry && !openClassData) ? srcEntry.path : entry.data.path
        let jarFile = (srcEntry && !openClassData) ? srcEntry.jarFile : entry.dependency.fileName
        let scheme = path.endsWith('.class') ? this.classContentProvider.scheme : this.jarContentProvider.scheme
        let authority = dependencyLabel(entry.dependency)
        return vscode.Uri.file(path).with({scheme: scheme, authority: authority, fragment: jarFile})
    }

    /**
     * Return a uri for the given fqcn
     * @param fqcn
     */
    async getFqcnUri(fqcn: string) : Promise<vscode.Uri> {
        // First check local classes
        let localClass = this.classDataRootNode.classDataNodes.find(node => node.data.fqcn === fqcn)
        if (localClass) {
            let path = await this.findSourcePath(localClass.data.sourceFile)
            return vscode.Uri.file(path)
        }
        // Else check jar entries
        let entries = this.entryNodeMap.get(fqcn)
        if (!entries) {
            entries = (await this.getJarEntryNodes()).filter(entry => entry.data.fqcn === fqcn)
            this.entryNodeMap.set(fqcn, entries)
        }
        if (!entries.length) return undefined
        let entry = entries[0]
        let data = await this.resolveJarEntryNode(entry)
        entry.data = data
        let uri = this.getEntryUri(entry, false)
        let classData = (data.type === JarEntryType.CLASS) ? (data as ClassEntryData).classData : undefined
        if (classData) this.classContentProvider.addClassData(uri, classData)
        return uri
    }
    
    /**
    * Open the text editor with the node's content if available
    * TODO Optional goto symbol location
    * @param entryNode 
    */
    private openJarEntryContent(entryNode: JarEntryNode, openClassData: boolean) {
        // Cache by fqcn? but its not a list
        let uri = this.getEntryUri(entryNode, openClassData)
        let classData = (entryNode.data.type === JarEntryType.CLASS) ? (entryNode.data as ClassEntryData).classData : undefined
        if (classData) this.classContentProvider.addClassData(uri, classData)
        vscode.workspace.openTextDocument(uri).then((doc) => {
            let options : vscode.TextDocumentShowOptions = {preview: false}
            /*
            if (entryNode.data.parseData) {
                let symbol = entryNode.data.parseData.symbols.find(s => s.name === entryNode.name)
                let start = doc.positionAt(symbol.location.start)
                let end = doc.positionAt(symbol.location.end)
                options.selection = new vscode.Range(start, end)
            }
            */
            options.selection = new vscode.Range(doc.positionAt(0), doc.positionAt(0))
            vscode.window.showTextDocument(doc, options).then((te) => {
            })
        })
    }
    
    /**
    * Open the given jar or class entry
    */
    public openEntry(entry: JarEntryNode | ClassData) {
        if (entry instanceof JarEntryNode) this.openJarEntry(entry)
        else this.openClass(entry)
    }
    
    /**
    * Open the source for the given [ClassData]
    */
    public async openClass(classData: ClassData) {
        let path = await this.findSourcePath(classData.sourceFile)
        let uri = vscode.Uri.file(path)
        if (uri) {
            vscode.workspace.openTextDocument(uri).then((doc) => {
                vscode.window.showTextDocument(doc)
            })
        }
        else {
            console.log('No source file found')
            console.log(classData)
        }
    }
    
    /**
    * Open the contents of a jar entry in a text editor
    */
    public async openJarEntry(entryNode: JarEntryNode, openClassData = false) {
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: entryNode.name}, (progess) => {
            return this.resolveJarEntryNode(entryNode).then((reply) => {
                entryNode.data = reply
                this.openJarEntryContent(entryNode, openClassData)
            }).catch(error => {
                vscode.window.showErrorMessage(error)
            })
        })
    }

    /**
     * Open the given node's [ClassData] -- for local classes
     * @param classNode 
     */
    public openClassNode(classNode: ClassDataNode) {
        let path = classNode.data.path
        let scheme = this.classContentProvider.scheme
        let authority = 'classdata'
        let uri = vscode.Uri.file(path).with({scheme: scheme, authority: authority})
        this.classContentProvider.addClassData(uri, classNode.data)
        vscode.workspace.openTextDocument(uri).then((doc) => {
            vscode.window.showTextDocument(doc)
        })
    }

    /**
     * Supports finding classes and limiting the number of items in the quick pick based on user input
     * 
     * @param items 
     * @param event 
     * @param inDollar 
     */
    private filterItems(items: vscode.QuickPickItem[], event: string, inDollar: boolean) {
        if (!items) return []
        let filterString = event.toLocaleLowerCase().replace('*', '').replace('$','').trim()
        return items.filter(i => {
            if (!inDollar && i.label.includes('$')) {
                return false
            }
            else {
                return i.label.toLocaleLowerCase().includes(filterString) || i.description.toLocaleLowerCase().includes(filterString)
            }
        })
    }
    
    /**
    * Let user find a class from the universe of classes for this project; starts with project classes only and
    * adds external dependeny classes as needed (to limit size of list which could be quite large)
    */
    public async findClass() {
        await this.updateProjectData({source: SYSTEM_SOURCE, paths: [], dependencySources: []})
        let jarEntries = this.getJarEntryNodes()
        let classData = this.getClassData()
        let quickPick = vscode.window.createQuickPick()
        quickPick.matchOnDescription = true
        let classItems : vscode.QuickPickItem[] = undefined
        let noDollarItems : vscode.QuickPickItem[] = undefined
        let jarItems : vscode.QuickPickItem[] = undefined
        let inDollar = false
        let inAsterisk = false
        quickPick.onDidAccept(selection => {
            quickPick.dispose()
            if (quickPick.selectedItems.length) {
                this.openEntry(quickPick.selectedItems[0]['entry'])
            }
        })
        quickPick.onDidChangeValue(event => {
            let hasDollar = event.includes('$')
            let hasAsterisk = event.includes('*')
            let hasZero = quickPick.activeItems.length === 0
            let changeItems = (hasDollar != inDollar) || (hasAsterisk != inAsterisk) || hasZero
            inDollar = hasDollar
            inAsterisk = hasAsterisk
            if (changeItems) {
                let filtered = (inAsterisk || hasZero) ? this.filterItems(jarItems, event, inDollar) : []
                quickPick.items = (inDollar ? classItems : noDollarItems).concat(filtered)
            }
        })
        quickPick.busy = true
        quickPick.show()
        // Wait for Jar entries
        jarEntries.then((result) => {
            jarItems = result.map((r) => {
                let detail = dependencyLabel(r.dependency)
                return { label: r.name, description: r.package.name , detail: detail, entry: r } as vscode.QuickPickItem
            })
        }).catch((reason) => {
            console.error(reason)
            jarItems = []
        })
        // Wait for classdata
        classData.then((data) => {
            classItems = data.map((d) => {
                let path = d.path.replace(vscode.workspace.workspaceFolders[0].uri.path+'/', '')
                let name = d.name.substring(d.name.lastIndexOf('.')+1)
                let pkg = d.name.substring(0, d.name.lastIndexOf('.'))
                return { label: name, description: pkg, detail: path, entry: d } as vscode.QuickPickItem
            })
            noDollarItems = classItems.filter(i => !i.label.includes('$'))
            quickPick.items = noDollarItems
            quickPick.busy = false
        })
    }
    
    /**
    * Add a user dependency
    */
    public async addDependency() {
        vscode.window.showOpenDialog({openLabel: 'Choose Jar File',filters: {'Dependency': ['jar']}, canSelectMany: false}).then((jarFile) => {
            if (!jarFile || jarFile.length === 0) return
            vscode.window.showOpenDialog({openLabel: 'Optional Source Jar', filters: {'Source': ['jar', 'zip']}, canSelectMany: false}).then(async (srcFile) => {
                let srcPath = (!srcFile || srcFile.length === 0) ? undefined : srcFile[0]['path']
                let jvmProject = await this.repo.addDependency(ConfigService.getConfig(), jarFile[0]['path'], srcPath)
                this.updateJvmProject(jvmProject)
            })
        })
    }

    /**
     * Add a user path
     */
    public async addUserPath() {
        let sourceOptions: vscode.OpenDialogOptions = {openLabel: 'Choose Source Directory', defaultUri: vscode.workspace.workspaceFolders[0].uri, canSelectMany: false, canSelectFolders: true, canSelectFiles: false}
        vscode.window.showOpenDialog(sourceOptions).then((srcDir) => {
            if (!srcDir) return
            let classOptions: vscode.OpenDialogOptions = {openLabel: 'Choose Class Directory', defaultUri: vscode.workspace.workspaceFolders[0].uri, canSelectMany: false, canSelectFolders: true, canSelectFiles: false}
            vscode.window.showOpenDialog(classOptions).then(async (classDir) => {
                if (!classDir) return
                let name = srcDir[0]['path'].replace(vscode.workspace.workspaceFolders[0].uri.path+'/', '')
                let pathData = {source: USER_SOURCE, module: 'user', name: name, classDir: classDir[0]['path'], sourceDir: srcDir[0]['path']}
                let jvmProject = await this.repo.addPath(ConfigService.getConfig(), pathData)
                this.updateJvmProject(jvmProject)
            })
        })
    }
    
    /**
    * Remove the given user item
    */
    public async removeUserItem(item: TreeNode) {
        let jvmProject: JvmProject
        switch (item.type) {
            case NodeType.PATH:
                jvmProject = await this.repo.removePath(ConfigService.getConfig(), (item as PathNode).data.sourceDir)
                break
            case NodeType.DEPENDENCY:
                jvmProject = await this.repo.removeDependency(ConfigService.getConfig(), (item as DependencyNode).data.fileName)
                break
            default:
                break
        }
        if (jvmProject) this.updateJvmProject(jvmProject)
    }
    
    /**
    * Get the current classpath
    */
    public getClasspath() : string {
        return this.repo.getClasspath()
    }
    
    /**
    * Get the current source paths
    */
    public getSourcePaths() : string[] {
        let paths = []
        this.pathRootNode.data.forEach((d) => {
            paths = paths.concat(d.sourceDir)
        })
        return paths
    }

    /**
     * Get the current class paths
     */
    public getClassPaths() : string[] {
        let paths = []
        this.pathRootNode.data.forEach((d) => {
            paths = paths.concat(d.classDir)
        })
        return paths
    }
    
    /**
    * Save any user data in the current project
    */
    private saveUserData(project: JvmProject) {
        // Find the single user path entry
        let userPaths = project.paths.find((p) => { return p.source === USER_SOURCE })
        this.context.workspaceState.update(this.USER_PATHS, userPaths)
        // Find the single user source entry
        let userSource = project.dependencySources.find((p) => { return p.source === USER_SOURCE })
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
            let project = {dependencySources: dependencySources, paths: paths, source: USER_SOURCE}
            await this.updateProjectData(project)
        }
    }
    
    /**
    * Return the compilation context for the given file uri
    * Finding the output dir is a hack because gradle sucks at this!
    */
    public getFileContext(file: vscode.Uri) : FileContext {
        let filePath = file.path
        let pathData = this.pathRootNode.data.find((pd) => {
            return filePath.startsWith(pd.sourceDir)
        })
        if (pathData) {
            let context = new FileContext()
            context.path = filePath
            context.sourceDir = pathData.sourceDir
            context.outputDir = pathData.classDir
            return context
        }
        else {
            //vscode.window.showErrorMessage(`Could not find output directory for ${filePath}`)
            console.debug(`Could not find path data for ${filePath}`)
            return undefined
        }
    }

    /**
     * Return the path for the given filename using the currently configured source paths
     */
    public async findSourcePath(filename: string) : Promise<string> {
        return this.repo.findSourceFile(filename)
    }
    
    /**
    * Return the FQCN of the current file
    */
    public getCurrentFqcn() : string {
        let curFile = vscode.window.activeTextEditor.document.fileName
        let fqcn = this.path2Fqcn(curFile)
        if (!fqcn) return `Unable to determine FQCN for ${curFile} in ${this.getSourcePaths()}`
        return fqcn
    }

    /**
     * Get the local source path for the given fqcn
     * 
     * @param fqcn 
     */
    public async fqcn2Uri(fqcn: string) : Promise<vscode.Uri> {
        let classData = await this.getClassData()
        let data = classData.find(cd => {
            return cd.name === fqcn
        })
        return data ? vscode.Uri.file(data.sourceFile) : undefined
    }

    /**
     * Get the Location for the given fqcn and method
     */
    public async getMethodLocation(fqcn: string, methodName: string) : Promise<Location> {
        let uri = this.fqcn2Uri(fqcn)
        if (!uri) return undefined

    }

    /**
     * Get the fqcn for the local source path
     * TODO move this to language controller and use parsed data and location
     * @param filename 
     */
    public path2Fqcn(filename: string) : string {
        let basename = PathHelper.basename(filename)
        let classname = basename.substring(0, basename.lastIndexOf('.'))
        let dirname = PathHelper.dirname(filename)
        let srcPath = this.getSourcePaths().find((p) => { return dirname.startsWith(p)})
        if (!srcPath) return undefined
        srcPath = (srcPath.endsWith('/')) ? srcPath : srcPath + '/'
        let pkgName = dirname.replace(srcPath, '').replace(/\//g, '.')
        return `${pkgName}.${classname}`
    }

    /**
     * Find all the packages in the configured class directories
     */
    public async getPackages() : Promise<string[]> {
        let pkgs = await Promise.all(this.getClassPaths().map(async p => {
            let dirs = await this.repo.findRecursive(p, undefined, undefined, true)
            return dirs.map(d => {
                p = (p.endsWith('/')) ? p : p + '/'
                return d.replace(p, '').replace(/\//g, '.')
            })
        }))
        let reduced = pkgs.length > 0 ? pkgs.reduce((p,c) => p.concat(c)) : []
        return reduced
    }

    /**
     * Given a FQCN for project class, return a Uri
     * @param classData 
     */
    
}