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
    private depListeners = [] // Array of dependency callbacks

    public constructor(context: vscode.ExtensionContext, server: JvmServer) {
        this.context = context
        this.server = server
        this.server.registerConsumer('jvmcode.dependencies', this.dependencyListener)
    }

    /**
     * Listen to dependency updates and cache them here, then call any other registered callbacks
     * @param callback 
     */
    private dependencyListener = (error, result) => {
        if (!error && result) {
            this.dependencies = result.body.dependencies
        }
        this.depListeners.forEach((listener) => {
            listener(error, result)
        })
    }

    /**
     * Register a listener for incoming dependencies
     * @param callback 
     */
    public registerDependencyListener(callback) {
        this.depListeners.push(callback)
    }

    /**
     * Request dependencies to be published
     */
    public requestDependencies() {
        this.server.publish('jvmcode.request-dependencies', ConfigService.getConfig())
    }

     /**
     * Add a new single jar file dependency
     * @param dependency 
     */
    public addDependency(jarFile: string) {
        this.server.publish('jvmcode.add-dependency', {jarFile: jarFile, config: ConfigService.getConfig()})
    }

    /**
     * Add a class directory to the classpath
     */
    public addClassDirectory(classDir: string) {
        this.server.publish('jvmcode.add-classdir', {classDir: classDir})
    }

    /**
     * Return all of the jar entries across all dependencies
     */
    public async getJarEntries() : Promise<JarEntryData[]> {
        let depPkgs = []
        for (var dep of this.dependencies) {
            depPkgs.push(await this.getPackages(dep))
        }
        // Wait for all the packages to resolve, than get the entries
        return Promise.all(depPkgs).then((depPkgs) => {
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
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    public async getPackages(dependency: DependencyData) : Promise<JarPackageData[]> {
        if (!dependency.packages) {
            let result = await this.server.send('jvmcode.jar-entries', {dependency: dependency})
            dependency.packages = result.body.packages
        }
        return dependency.packages
    }

    /**
     * Returns JarEntryData with text content if available, otherwise content set to empty
     * @param jarEntry 
     */
    public async getJarEntryContent(jarEntry: JarEntryNode) : Promise<JarEntryData> {
        let reply = await this.server.send('jvmcode.jar-entry', {jarEntry: jarEntry})
        return reply.body
    }

    /**
     * Get the current classpath
     */
    public async getClasspath() : Promise<string> {
        let response =  await this.server.send('jvmcode.classpath', {})
        return response.body.classpath
    }

}