'use strict';

import * as vscode from 'vscode'
import { DependencyData, JarEntryData, JarPackageData, JvmProject, PathData, ProjectUpdateData} from "server-models"
import { JvmServer } from './jvm_server';
import { JarEntryNode, CompilationContext } from './models';
import { ConfigService } from './config_service';

/**
 * Service to make project related requests to JvmServer on behalf of other components.  Also manage caching of 
 * dependency data to be used by other components
 */
export class ProjectService {

    private server: JvmServer
    private projectListeners = [] // Array of dependency callbacks
    // A Map of source directories to associated compilation contexts
    private compilationContexts : Map<String, CompilationContext> = new Map()

    public constructor(server: JvmServer) {
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
    public async addDependency(jarFile: string, srcFile: string) {
        let reply = await this.server.send('jvmcode.add-dependency', {jarFile: jarFile, srcFile: srcFile, config: ConfigService.getConfig()})
        this.projectListener(undefined, reply)
    }

    /**
     * Add a path component(s) to the project
     */
    public async addPath(userPath: PathData) {
        let reply = await this.server.send('jvmcode.add-path', userPath)
        this.projectListener(undefined, reply)
    }

    /**
     * Update the user project (mostly for when the workspace is opened and user settings are restored )
     */
    public async updateUserProject(userProject: ProjectUpdateData) {
        await this.server.send('jvmcode.update-user-project', userProject).catch((e) => {
            console.error(e)
        })
    }

    /**
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    public async getPackages(dependency: DependencyData) : Promise<JarPackageData[]> {
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
    // public getCompilationContext(file: vscode.Uri) : CompilationContext {
    //     let compilationContext = new CompilationContext()
    //     compilationContext.classpath = this.classpath
    //     compilationContext.outputDir = this.pathRootNode.data[0].classDirs[0]
    //     return new CompilationContext()
    // }

}