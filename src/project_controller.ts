'use strict';

import * as vscode from 'vscode'
import { JarEntryData, JvmProject, ClassData, ClassEntryData, SourceEntryData, PathData } from "server-models"
import { ProjectTreeProvider } from './project_tree_provider'
import { JarContentProvider } from './jar_content_provider'
import { ClassContentProvider } from './class_content_provider'
import { ProjectService } from './project_service';
import { JarEntryNode, dependencyLabel, PathRootNode, DependencyRootNode, TreeNode, DependencySourceNode, DependencyNode, JarPackageNode, NodeType, SourceDirNode, ClassDirNode, CompilationContext, FileContext, PathNode, ClassDataRootNode, ClassDataNode } from './models';
import { projectController } from './extension';
import * as fs from 'fs';
import * as PathHelper from 'path'

/**
* Responsible for managing various views related to a project
*/
export class ProjectController {
    
    private USER_SOURCE = 'USER_DEPENDENCIES'
    private USER_PATHS = 'USER_PATHS'
    private context: vscode.ExtensionContext
    public service: ProjectService
    private projectTree: ProjectTreeProvider
    private jarContentProvider: JarContentProvider
    private classContentProvider: ClassContentProvider
    private isStarted = false
    private pathRootNode: PathRootNode
    private depedencyRootNode: DependencyRootNode
    private classDataRootNode: ClassDataRootNode
    private classpath: string
    private entryNodeMap: Map<string, JarEntryNode[]> = new Map() // Lazy cache of FQCN to entryNode
    private classWatchers: Map<string, vscode.FileSystemWatcher> = new Map() // Path -> watcher
    
    public constructor(context: vscode.ExtensionContext, service: ProjectService) {
        this.context = context
        this.service = service
        this.registerProjectListener()
        this.restoreUserData()
    }
    
    public async start() {
        if (this.isStarted) return
        this.projectTree = new ProjectTreeProvider(this)
        vscode.window.registerTreeDataProvider(this.projectTree.viewId, this.projectTree)
        this.jarContentProvider = new JarContentProvider()
        vscode.workspace.registerTextDocumentContentProvider(this.jarContentProvider.scheme, this.jarContentProvider)
        this.classContentProvider = new ClassContentProvider()
        vscode.workspace.registerTextDocumentContentProvider(this.classContentProvider.scheme, this.classContentProvider)
        vscode.commands.executeCommand('setContext', 'jvmcode.context.isJvmProject', true)
        this.isStarted = true
        await this.service.requestProject()
    }
    
    /** 
    * Register a consumer for dependencies coming from
    * the server
    */
    private registerProjectListener() {
        this.service.registerProjectListener(async (jvmProject: JvmProject) => {
            await this.start()
            this.depedencyRootNode = new DependencyRootNode(jvmProject.dependencySources)
            this.pathRootNode = new PathRootNode(jvmProject.paths)
            this.ensureClassWatchers(jvmProject.paths)
            this.classDataRootNode = new ClassDataRootNode(jvmProject.classdata)
            this.classpath = jvmProject.classpath
            this.updateProject()
            this.saveUserData(jvmProject)
        })
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
        let data = await this.service.getClassDataForPath(uri.path)
        console.log(`class file handler ${data.name}`)
        this.classDataRootNode.update(data)
        this.updateProject()
    }

    /**
    * Alert components that dependencies have been updated
    * @param dependencies 
    */
    public updateProject() {
        this.projectTree.update()
    }
    
    /**
    * Return the root nodes for the tree view 
    */
    public getRootNodes() : TreeNode[] {
        return [this.pathRootNode, this.depedencyRootNode, this.classDataRootNode]
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
        await this.start()
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
    
    public async getClassData() : Promise<ClassData[]> {
        await this.start()
        return await this.service.getClassData()
    }
    
    /**
    * Return all the JarEntryNodes accross all dependencies, has the effect of resolving all packages in each
    * dependency
    */
    public async getJarEntryNodes() : Promise<JarEntryNode[]> {
        await this.start()
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
            case 'CLASS':
                if (!(entryNode.data as ClassEntryData).srcEntry) {
                    return this.service.resolveJarEntryData(entryNode.data.fqcn, entryNode.dependency.fileName)
                }
            default:
                return entryNode.data
        }
    }

    private getEntryUri(entry: JarEntryNode, openClassData: boolean) : vscode.Uri {
        let srcEntry : SourceEntryData = (entry.data.type === 'CLASS') ? (entry.data as ClassEntryData).srcEntry : undefined
        let path = (srcEntry && !openClassData) ? srcEntry.path : entry.data.path
        let jarFile = (srcEntry && !openClassData) ? srcEntry.jarFile : entry.dependency.fileName
        let scheme = path.endsWith('.class') ? this.classContentProvider.scheme : this.jarContentProvider.scheme
        let authority = dependencyLabel(entry.dependency)
        return vscode.Uri.file(path).with({scheme: scheme, authority: authority, fragment: jarFile})
    }

    async getFqcnUri(fqcn: string) : Promise<vscode.Uri> {
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
        let classData = (data.type === 'CLASS') ? (data as ClassEntryData).classData : undefined
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
        let classData = (entryNode.data.type === 'CLASS') ? (entryNode.data as ClassEntryData).classData : undefined
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
    public openClass(classData: ClassData) {
        let uri = vscode.Uri.file(classData.srcFile)
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
        await this.start()
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
        await this.start()
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
                projectController.openEntry(quickPick.selectedItems[0]['entry'])
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
        await this.start()
        vscode.window.showOpenDialog({openLabel: 'Choose Jar File',filters: {'Dependency': ['jar']}, canSelectMany: false}).then((jarFile) => {
            if (!jarFile || jarFile.length === 0) return
            vscode.window.showOpenDialog({openLabel: 'Optional Source Jar', filters: {'Source': ['jar', 'zip']}, canSelectMany: false}).then((srcFile) => {
                let srcPath = (!srcFile || srcFile.length === 0) ? undefined : srcFile[0]['path']
                this.service.addDependency(jarFile[0]['path'], srcPath)
            })
        })
    }

    /**
     * Add a user path
     */
    public async addUserPath() {
        await this.start()
        let sourceOptions: vscode.OpenDialogOptions = {openLabel: 'Choose Source Directory', defaultUri: vscode.workspace.workspaceFolders[0].uri, canSelectMany: false, canSelectFolders: true, canSelectFiles: false}
        vscode.window.showOpenDialog(sourceOptions).then((srcDir) => {
            if (!srcDir) return
            let classOptions: vscode.OpenDialogOptions = {openLabel: 'Choose Class Directory', defaultUri: vscode.workspace.workspaceFolders[0].uri, canSelectMany: false, canSelectFolders: true, canSelectFiles: false}
            vscode.window.showOpenDialog(classOptions).then((classDir) => {
                if (!classDir) return
                let name = srcDir[0]['path'].replace(vscode.workspace.workspaceFolders[0].uri.path+'/', '')
                this.service.addPath({source:'user', module: 'user', name: name, classDir: classDir[0]['path'], sourceDir: srcDir[0]['path']})
            })
        })
    }
    
    /**
    * Remove the given user item
    */
    public async removeUserItem(item: TreeNode) {
        await this.start()
        switch (item.type) {
            case NodeType.PATH:
                this.service.removePath((item as PathNode).data.name)
                break
            case NodeType.DEPENDENCY:
                this.service.removeDependency((item as DependencyNode).data.fileName)
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
            await this.service.updateUserProject(project)
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
    public filename2Path(filename: string) : string {
        let paths = []
        this.getSourcePaths().forEach(p => {
            paths = paths.concat(this.findFiles(p, filename))
        })
        return paths.length > 0 ? paths[0] : undefined
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
        return data ? vscode.Uri.file(data.srcFile) : undefined
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
    public getPackages() : string[] {
        let pkgs = new Set<string>()
        this.getClassPaths().forEach(p => {
            this.findDirectories(p, false).forEach(d => {
                p = (p.endsWith('/')) ? p : p + '/'
                pkgs.add(d.replace(p, '').replace(/\//g, '.'))
            })
        })
        return Array.from(pkgs)
    }

    /**
     * Find all directories recursively starting at the given directory
     * Optionally, only return non-empty directories
     */
    private findDirectories(dir: string, empty: boolean = true) : string[] {
        let dirs = []
        if (!fs.existsSync(dir)) return dirs
        let entryCount = 0
        fs.readdirSync(dir).forEach((entry) => {
            let file = PathHelper.join(dir, entry)
            if (fs.statSync(file).isDirectory()) {
                dirs = dirs.concat(this.findDirectories(file))
                if (empty || entryCount > 0) dirs.push(file)
            }
            else {
                entryCount++
            }
        })
        return dirs
    }
    
    /**
     * Find all files recursively starting in the given directory optionally matching the given filename
     */
    private findFiles(dir: string, filename?: string) : string[] {
        let files = []
        if (!fs.existsSync(dir)) return files
        fs.readdirSync(dir).forEach((entry) => {
            let file = PathHelper.join(dir, entry)
            if (fs.statSync(file).isDirectory()) {
                files = files.concat(this.findFiles(file, filename))
            } else if (!filename || entry === filename) {
                files.push(file)
            }
        })
        return files
    }

    /**
     * Given a FQCN for project class, return a Uri
     * @param classData 
     */
    
    
    /**
    * Find the corresponding source file for the given class data
    */
    private getClassUri(classData: ClassData) : vscode.Uri {
        let parts = classData.name.split('.')
        let pkgPath = parts.slice(0, parts.length-1).join('/')
        let dir = this.getSourcePaths().find((p) => {
            let file = PathHelper.join(p, pkgPath, classData.srcFile)
            return fs.existsSync(file)
        })
        if (dir) return vscode.Uri.file(PathHelper.join(dir, pkgPath, classData.srcFile))
        else return undefined
    }
}