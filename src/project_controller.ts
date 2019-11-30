'use strict';

import * as vscode from 'vscode'
import { DependencySourceData, JarEntryData, JvmProject } from "server-models"
import { ProjectTreeProvider } from './project_tree_provider';
import { JarContentProvider } from './jar_content_provider';
import { ProjectService } from './project_service';
import { JarEntryNode } from './models';
import { projectService } from './extension';

/**
 * Responsible for managing various views related to a project
 */
export class ProjectController {

    private service: ProjectService
    private dependencyTree: ProjectTreeProvider
    private contentProvider: JarContentProvider
    private isStarted = false

    public constructor(service: ProjectService) {
        this.service = service
        this.registerProjectListener()
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
}