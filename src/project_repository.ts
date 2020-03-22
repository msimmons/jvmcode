'use strict';

import { readFile, fstat, existsSync, readFileSync } from "fs";
import JSZip = require("jszip");
import * as PathHelper from 'path'
import { JarEntryData, ClassEntryData, JarPackageData, SourceEntryData, ResourceEntryData } from './jar_model'
import { DependencyData, DependencySourceData, PathData, JvmProject, ProjectUpdateData, SYSTEM_SOURCE, USER_SOURCE } from './project_model'
import { ClassData } from "./class_data/class_data"
import { LocalConfig } from "./models";

/**
 */
export class ProjectRepository {

    private projectListeners = [] // Array of project callbacks
    private fqcnMap = new Map<string, any>()
    private jvmProject: JvmProject
    private jdkDependencySource: DependencySourceData
    private userDependencySource: DependencySourceData = {source: USER_SOURCE, description: 'User Provided', dependencies: []}
    private userPaths: PathData[] = []
    private externalDependencySources: DependencySourceData[] = []
    private externalPaths: PathData[] = []

    public constructor() {
    }

    /**
     * Get the version of java for the configured java home
     */
    public getVersion(javaHome: string) : string {
        let releaseFile = PathHelper.join(javaHome, 'release')
        if (existsSync(releaseFile)) {
            let line = readFileSync(releaseFile).toString().split('\n').find(l => {
                return l.startsWith('JAVA_VERSION')
            })
            let pair = line ? line.split('=') : undefined
            let version = (pair && pair.length == 2) ? pair[1].replace(/"/g, '') : undefined
            version = version ? version : PathHelper.basename(javaHome)
            return version
        }
    }

    public createJdkSource(config: LocalConfig) : DependencySourceData {
        let version = this.getVersion(config.javaHome)
        let pre9 = existsSync(PathHelper.join(config.javaHome, 'jre/lib/rt.jar'))
        if (pre9) {
            let fileName = PathHelper.join(config.javaHome, 'jre/lib/rt.jar')
            let sourceFileName = config.srcLocation ? config.srcLocation : PathHelper.join(config.javaHome, 'src.zip')
            let dependency = {fileName: fileName, sourceFileName: sourceFileName} as DependencyData
            return {source: SYSTEM_SOURCE, description: `JDK ${version}`, dependencies: [dependency]} as DependencySourceData
        }
        else {
            let dirName = PathHelper.join(config.javaHome, 'jmods')
            let sourceFileName = config.srcLocation ? config.srcLocation : PathHelper.join(config.javaHome, 'lib/src.zip')
            let jmods = config.jmodIncludes.map(i => {
                let jmod = PathHelper.join(dirName, `${i}.jmod`)
                return {fileName: jmod, sourceFileName: sourceFileName, jmod: i} as DependencyData
            })
            return {source: SYSTEM_SOURCE, description: `JDK ${version}`, dependencies: jmods} as DependencySourceData
        }
    }

    /**
     * Request that the project be published
     */
    public async initializeJDK(config: LocalConfig) {
        if (!this.jdkDependencySource) this.jdkDependencySource = this.createJdkSource(config)
    }

    /**
     * Add a new single jar file dependency
     * @param dependency 
     */
    public addDependency(config: LocalConfig, jarFile: string, srcFile: string) : JvmProject {
        let dependency = {fileName: jarFile, sourceFileName: srcFile, transitive: false} as DependencyData
        this.userDependencySource.dependencies.push(dependency)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Remove a jar depdnency
     * @param jarFile
     */
    public removeDependency(config: LocalConfig, jarFile: string) : JvmProject {
        this.userDependencySource.dependencies = this.userDependencySource.dependencies.filter(d => d.fileName != jarFile)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Add a path component(s) to the project
     */
    public addPath(config: LocalConfig, userPath: PathData) : JvmProject {
        this.userPaths.push(userPath)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Remove a user path
     * @param path
     */
    public removePath(config: LocalConfig, sourceDir: string) : JvmProject {
        this.userPaths = this.userPaths.filter(p => p.sourceDir != sourceDir)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Update a project, to be called by specific project extensions such as Gradle, Maven
     */
    public updateProject(config: LocalConfig, project: ProjectUpdateData) : JvmProject {
        this.initializeJDK(config)
        if (project.source === USER_SOURCE) {
            this.userDependencySource = project.dependencySources[0]
            this.userPaths = project.paths
        }
        else {
            this.externalDependencySources = this.externalDependencySources.filter(ds => ds.source != project.source).concat(project.dependencySources)
            this.externalPaths = this.externalPaths.filter(p => p.source != project.source).concat(project.paths)
        }
        let allSources = [this.jdkDependencySource, this.userDependencySource].concat(this.externalDependencySources)
        let allPaths = this.userPaths.concat(this.externalPaths)
        //this.notifyListeners(jvmProject)
        return {dependencySources: allSources, paths: allPaths, classdata: [], classpath: ''}
    }

    /**
     * Return all of this project's local classdata
     */
    public async getClassData() : Promise<ClassData[]> {
        // return it
        return []
    }
    
    /**
     * Return classdata for the given path
     */
    public async getClassDataForPath(path: string) : Promise<ClassData> {
        return undefined
    }

    /**
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    public async getPackages(dependency: DependencyData) : Promise<JarPackageData[]> {
        let packages = await this.readJarFile(dependency.fileName, dependency.jmod)
        let packageData = []
        Array.from(packages.entries()).forEach(entry => {
            if (entry[1].length > 0) {
                let pkg = {name: entry[0], entries: entry[1]} as JarPackageData
                packageData.push(pkg)
            }
        })
        return packageData
    }

    /**
     * Returns the jar entry data given the fqcn and (optional) dependency jar; resolved means the path to the source file
     * has been determined if possible and the class data has been read
     * @param fqcn 
     * @param jarFile 
     */
    public async resolveJarEntryData(fqcn : string, jarFile : string) : Promise<JarEntryData> {
        if (!jarFile) jarFile = this.fqcnMap.get(fqcn).jarFile


        return undefined
//        let reply = await this.server.send('jvmcode.jar-entry', {fqcn: fqcn, jarFile: jarFile})
//        return reply.body
    }

    public readJarFile(jarFile: string, jmod: string) : Promise<Map<string, JarEntryData[]>> {
        return new Promise((resolve, reject) => {
            readFile(jarFile, (err, data) => {
                if (err) {
                    reject(`Error opening file ${jarFile}\n   ${err}`)
                }
                else {
                    JSZip.loadAsync(data).then(zip => {
                        let packages = new Map<string, JarEntryData[]>()
                        Object.values(zip.files).forEach((file) => {
                            let pkg = PathHelper.dirname(file.name).replace(/\//g, '.')
                            pkg = (jmod && pkg.startsWith('classes.')) ? pkg.replace('classes.', '') : pkg
                            let ext = PathHelper.extname(file.name)
                            let filename = PathHelper.basename(file.name)
                            let name = PathHelper.basename(file.name, ext)
                            if (file.dir) packages.set(pkg, [])
                            else {
                                let entry: JarEntryData = ext.endsWith('class') ? new ClassEntryData(pkg, name, file.name) : new ResourceEntryData(filename, file.name)
                                if (!packages.has(pkg)) packages.set(pkg, [])
                                packages.get(pkg).push(entry)
                                this.fqcnMap.set(entry.fqcn, {jarFile: jarFile})
                            }
                        })
                        resolve(packages)
                    }).catch(reason => {
                        reject(`Error in loadAsync for ${jarFile}\n   ${reason}`)
                    })
                }
            })
        })
    }
}