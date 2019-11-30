'use strict';

import * as vscode from 'vscode'
import { DependencyData, JarEntryData, JarPackageData, JvmProject} from "server-models"
import { readdirSync, statSync, existsSync } from 'fs'
import { JvmServer } from './jvm_server';
import { JarEntryNode, DependencySourceNode, DependencyNode, JarPackageNode, CompilationContext, ClasspathRootNode, DependencyRootNode, TreeNode } from './models';
import { ConfigService } from './config_service';
import * as path from 'path'

/**
 * Service to make project related requests to JvmServer on behalf of other components.  Also manage caching of 
 * dependency data to be used by other components
 */
export class ProjectService {

    private context: vscode.ExtensionContext
    private server: JvmServer
    private classDirNode: ClasspathRootNode
    private depedencyRootNode: DependencyRootNode
    private classpath: string
    private projectListeners = [] // Array of dependency callbacks
    // A Map of source directories to associated compilation contexts
    private compilationContexts : Map<String, CompilationContext> = new Map()

    public constructor(context: vscode.ExtensionContext, server: JvmServer) {
        this.context = context
        this.server = server
        this.server.registerConsumer('jvmcode.project', this.projectListener)
        this.server.registerConsumer('jvmcode.language', this.languageListener)
    }

    /**
     * Listen to dependency updates and cache them here, then call any other registered callbacks
     * @param callback 
     */
    private projectListener = (error, result) => {
        if (error || !result) {
            console.error('Got a project event with bad payload', error)
        }
        else {
            let jvmProject = result.body as JvmProject
            this.depedencyRootNode = new DependencyRootNode(jvmProject.dependencySources)
            this.classDirNode = new ClasspathRootNode(jvmProject.classDirs)
            this.classpath = jvmProject.classpath
            this.projectListeners.forEach((listener) => {
                listener(jvmProject)
            })
        }
    }

    /**
     * List for language service registrations
     * @param callback 
     */
    private languageListener = (error, result) => {
        if (error || !result) {
            console.error('Got a language event with bad payload', error)
        }
        else {
            let languageInfo = result.body
            // Name of language
            // What file extensions it covers
            // Is there any need for other listeners?
        }
    }

    /**
     * Register a listener for incoming dependencies
     * @param callback(project: JvmProject)
     */
    public registerProjectListener(callback) {
        this.projectListeners.push(callback)
    }

    /**
     * Return the root nodes for the tree view 
     */
    public getRootNodes() : TreeNode[] {
        return [this.classDirNode, this.depedencyRootNode]
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
     * Return all the dependency source nodes
     */
    public getSourceNodes() : DependencySourceNode[] {
        return this.depedencyRootNode.sourceNodes
    }

    /**
     * Return all the dependency nodes for the given source
     */
    public getDependencyNodes(source: DependencySourceNode) : DependencyNode[] {
        let nodes = source.data.dependencies.filter((d) => { return !d.transitive }).map((d) => {
            return new DependencyNode(d)
        })
        source.dependencies = nodes
        return nodes
    }

    /**
     * Return all the package nodes for the given dependency
     */
    public async getPackageNodes(dependency: DependencyNode) : Promise<JarPackageNode[]> {
        if (dependency.packages) return dependency.packages
        try {
            let packages = await this.getPackages(dependency.data)
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
     * Return all classes in registered class directories (returned as JarEntryData for uniformity)
     */
    public getClasses() : JarEntryData[] {
        let entries = []
        this.classDirNode.data.forEach((cp) => {
            cp.classDirs.forEach((dir) => {
                let files = this.getFiles(dir).filter((file) => {return file.indexOf('$') <= 0})
                entries = entries.concat(files.map((file) => {
                    file = file.replace(dir, '').replace('.class', '')
                    let ndx = file.lastIndexOf('/')
                    let name = file.substr(ndx+1)
                    let pkg = file.substr(1, ndx-1).replace(/\//g, '.')
                    return { type: 'CLASS', name: name, pkg: pkg } as JarEntryData
                })
            )})
        })
        return entries
    }

    /**
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    private async getPackages(dependency: DependencyData) : Promise<JarPackageData[]> {
        let result = await this.server.send('jvmcode.jar-entries', {dependency: dependency})
        dependency.resolved = true
        return result.body.packages
    }

    /**
     * Returns JarEntryData with text content if available, otherwise content set to empty
     * @param jarEntry 
     */
    public async getJarEntryContent(jarEntry: JarEntryNode) : Promise<JarEntryData> {
        let reply = await this.server.send('jvmcode.jar-entry', {jarEntry: jarEntry.data})
        return reply.body
    }

    /**
     * Get the current classpath
     */
    public getClasspath() : string {
        return this.classpath ? this.classpath : ""
    }

    /**
     * Request that a buffer be parsed by an appropriate language service
     * @param file 
     */
    public requestParse(file: vscode.Uri) {

    }

    /**
     * Request that a file be compiled by an appropriate language service
     * @param file 
     */
    public requestCompile(file: vscode.Uri) {
        // Are there any appropriate services?
        // Find dependent files to add to compile list
        // Send compile request
    }

    /**
     * 
     * @param file The file for which context is requested
     */
    public getCompilationContext(file: vscode.Uri) : CompilationContext {
        let compilationContext = new CompilationContext()
        compilationContext.classpath = this.classpath
        compilationContext.outputDir = this.classDirNode.data[0].classDirs[0]
        return new CompilationContext()
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