'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server';
import { DependencyData, JarPackageData, JarEntryNode, JarEntryData } from './models';
import { ConfigService } from './config_service';

/**
 * Service to make dependency related request to JvmServer on behalf of other components
 */
export class DependencyService {

    private context: vscode.ExtensionContext
    private server: JvmServer
    private dependencies: DependencyData[] = []

    public constructor(context: vscode.ExtensionContext, server: JvmServer) {
        this.context = context
        this.server = server
    }

    start() {
        let configuration = vscode.workspace.getConfiguration('jvmcode')
        this.registerDependencyListener(this.dependencyListener)
        this.server.publish('jvmcode.enable-dependencies', ConfigService.getConfig())
    }

    /**
     * Listen to dependency updates and cache them here
     * @param callback 
     */
    private dependencyListener = (error, result) => {
        if (error) return
        this.dependencies = result.body.dependencies
    }

    /**
     * Register a listener for incoming dependencies
     * @param callback 
     */
    public registerDependencyListener(callback) {
        this.server.registerConsumer('jvmcode.dependencies', callback)
    }

    /**
     * Add a new single jar file dependency
     * @param dependency 
     */
    public addDependency(jarFile: string) {
        this.server.publish('jvmcode.add-dependency', {jarFile: jarFile, config: ConfigService.getConfig()})
    }

    /**
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    public async getPackages(dependency: DependencyData) : Promise<JarPackageData[]> {
        let result = await this.server.send('jvmcode.jar-entries', {dependency: dependency})
        return result.body.packages
    }

    /**
     * Returns JarEntryData with text content if available, otherwise content set to empty
     * @param jarEntry 
     */
    public async getJarEntryContent(jarEntry: JarEntryNode) : Promise<JarEntryData> {
        let reply = await this.server.send('jvmcode.jar-entry', {jarEntry: jarEntry})
        return reply.body
    }

}