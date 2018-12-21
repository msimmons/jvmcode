'use strict';

import * as vscode from 'vscode'
import { readdir, readdirSync, statSync, existsSync } from 'fs'
import { JvmServer } from './jvm_server';
import { DependencyData, JarPackageData, JarEntryNode, JarEntryData, ClasspathData } from './models';
import { ConfigService } from './config_service';
import * as path from 'path'

/**
 * Service to make dependency related request to JvmServer on behalf of other components
 */
export class ProjectService {

    private context: vscode.ExtensionContext
    private server: JvmServer
    private dependencies: DependencyData[] = []
    private classpath: ClasspathData[] = []
    private projectListeners = [] // Array of dependency callbacks

    public constructor(context: vscode.ExtensionContext, server: JvmServer) {
        this.context = context
        this.server = server
        this.server.registerConsumer('jvmcode.project', this.projectListener)
    }

    /**
     * Listen to dependency updates and cache them here, then call any other registered callbacks
     * @param callback 
     */
    private projectListener = (error, result) => {
        if (!error && result) {
            this.dependencies = result.body.dependencies
            this.classpath = result.body.classpath
        }
        this.projectListeners.forEach((listener) => {
            listener(error, result)
        })
    }

    /**
     * Register a listener for incoming dependencies
     * @param callback 
     */
    public registerProjectListener(callback) {
        this.projectListeners.push(callback)
    }

    /**
     * Request that the project be published
     */
    public async requestProject() {
        let reply = await this.server.send('jvmcode.request-project', ConfigService.getConfig())
        this.projectListener(undefined, reply)
    }

     /**
     * Add a new single jar file dependency
     * @param dependency 
     */
    public async addDependency(jarFile: string) {
        let reply = await this.server.send('jvmcode.add-dependency', {jarFile: jarFile, config: ConfigService.getConfig()})
        this.projectListener(undefined, reply)
    }

    /**
     * Add a class directory to the classpath
     */
    public async addClassDirectory(classDir: string) {
        let reply = await this.server.send('jvmcode.add-classdir', {classDir: classDir})
        this.projectListener(undefined, reply)
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
     * Return all classes in registered class directories (returned as JarEntryData for uniformity)
     */
    public getClasses() : JarEntryData[] {
        let entries = []
        this.classpath.forEach((cp) => {
            cp.classDirs.forEach((dir) => {
                let files = this.getFiles(dir).filter((file) => {return file.indexOf('$') <= 0})
                entries = entries.concat(files.map((file) => {
                    file = file.replace(dir, '').replace('.class', '')
                    let ndx = file.lastIndexOf('/')
                    let name = file.substr(ndx+1)
                    let pkg = file.substr(1, ndx-1).replace(/\//g, '.')
                    return { type: 'CLASS', name: name, pkg: pkg }
                })
            )})
        })
        return entries
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

    private getFiles(dir: string) : string[] {
        let files = []
        if (!existsSync(dir)) return files
        readdirSync(dir).forEach((entry) => {
            let file = path.join(dir, entry)
            if (statSync(file).isDirectory()) {
                files = files.concat(this.getFiles(file))
            } else {
                files.push(file)
            }
        })
        return files
    }

}