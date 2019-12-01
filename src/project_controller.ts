'use strict';

import * as vscode from 'vscode'
import { DependencySourceData, JarEntryData, JvmProject, PathData } from "server-models"
import { ProjectTreeProvider } from './project_tree_provider';
import { JarContentProvider } from './jar_content_provider';
import { ProjectService } from './project_service';
import { JarEntryNode, dependencyLabel } from './models';
import { projectService, projectController } from './extension';

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

    public constructor(context: vscode.ExtensionContext, service: ProjectService) {
        this.context = context
        this.service = service
        this.registerProjectListener()
        this.restoreUserData()
    }

    public async start() {
        if (this.isStarted) return
        this.dependencyTree = new ProjectTreeProvider(this.service)
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
            this.updateDependencies(jvmProject.dependencySources)
            this.saveUserData(jvmProject)
        })
    }

    /**
     * Alert components that dependencies have been updated
     * @param dependencies 
     */
    public updateDependencies(dependencies: DependencySourceData[]) {
        this.dependencyTree.update()
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
        let jarEntries = projectService.getJarEntryNodes()
        let classes = projectService.getClasses()
        Promise.all([jarEntries]).then((results) => {
            let quickPick = vscode.window.createQuickPick()
            let classItems = classes.map((c) => {
                return { label: c.name, description: c.pkg, detail: c.pkg, entry: c } as vscode.QuickPickItem
            })
            let jarItems = results[0].map((r) => {
                let detail = r.data.pkg + ' (' + dependencyLabel(r.dependency) + ')'
                return { label: r.name, description: r.package.name, detail: detail, entry: r } as vscode.QuickPickItem
            })
            quickPick.items = classItems
            quickPick.onDidAccept(selection => {
                quickPick.dispose()
                if (quickPick.selectedItems.length) {
                    projectController.openJarEntry(quickPick.selectedItems[0]['entry'])
                }
            })
            quickPick.onDidChangeSelection(selection => {
            })
            quickPick.onDidChangeActive(event => {
            })
            quickPick.onDidChangeValue(event => {
                if (event.length > 0 && quickPick.activeItems.length === 0) {
                    quickPick.items = quickPick.items.concat(jarItems.filter((ji) => {
                        return ji.label.toLowerCase().startsWith(event.toLowerCase())
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
            console.log(project)
            await projectService.updateUserProject(project)
        }
    }

    /**
     * Return the FQCN or the current file
     */
    public getFQCN() : string {
        let curFile = vscode.window.activeTextEditor.document.fileName
        curFile = curFile.substring(0, curFile.lastIndexOf('.'))
        let path = projectService.getSourcePaths().find((p) => { return curFile.startsWith(p)})
        if (!path) return `No FQCN found for ${curFile} in ${projectService.getSourcePaths()}`
        path = (path.endsWith('/')) ? path : path + '/'
        return curFile.replace(path, '').replace(/\//g, '.')
    }

    public file2fqcn(filename: string) : string {
        let path = projectService.getSourcePaths().find((p) => { return filename.startsWith(p)})
        if (!path) return `No FQCN found for ${filename} in ${projectService.getSourcePaths()}`
        path = (path.endsWith('/')) ? path : path + '/'
        return filename.replace(path, '').replace(/\//g, '.')
    }
}