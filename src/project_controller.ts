'use strict';

import * as vscode from 'vscode'
import { DependencyTreeProvider } from './dependency_tree_provider';
import { JarContentProvider } from './jar_content_provider';
import { ProjectService } from './project_service';
import { DependencyData, JarEntryNode, JarEntryData } from './models';

/**
 * Responsible for managing various views related to a project
 */
export class ProjectController {

    private service: ProjectService
    private dependencyTree: DependencyTreeProvider
    private contentProvider: JarContentProvider
    private isStarted = false

    public constructor(service: ProjectService) {
        this.service = service
        this.registerProjectListener()
    }

    public start() {
        if (this.isStarted) return
        this.dependencyTree = new DependencyTreeProvider(this.service)
        vscode.window.registerTreeDataProvider(this.dependencyTree.viewId, this.dependencyTree)
        this.contentProvider = new JarContentProvider()
        vscode.workspace.registerTextDocumentContentProvider(this.contentProvider.scheme, this.contentProvider)
        vscode.commands.executeCommand('setContext', 'jvmcode.context.isJvmProject', true)
        this.isStarted = true
        this.service.requestProject()
    }

    /** 
     * Register a consumer for dependencies coming from
     * the server
     */
    private registerProjectListener() {
        this.service.registerProjectListener((error, result) => {
            if (error) {
                vscode.window.showErrorMessage(error.message)
            }
            else {
                this.start()
                this.updateDependencies(result.body.dependencies)
            }
        })
    }

    /**
     * Update dependencies for any components that use them
     * @param dependencies 
     */
    public updateDependencies(dependencies: DependencyData[]) {
        this.dependencyTree.setDependencies(dependencies)
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
        let uri = vscode.Uri.parse(this.contentProvider.scheme + '://' + entryNode.dependency + '/' + entryNode.pkg + '/' + entryNode.contentName)
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
}