'use strict';

import * as fs from 'fs'
import JSZip = require("jszip");
import * as PathHelper from 'path'
import { JarEntryData, ClassEntryData, JarPackageData, SourceEntryData, ResourceEntryData } from './jar_model'
import { DependencyData, DependencySourceData, PathData, JvmProject, ProjectUpdateData, SYSTEM_SOURCE, USER_SOURCE } from './project_model'
import { ClassData } from "./class_data/class_data"
import { LocalConfig } from "./models";
import { ClassFileReader } from "./class_data/class_file_reader";
import { promisify } from 'util'

/**
 * All non-vscode specific Project services; integration with vscode is handled in the controllers
 */
export class ProjectRepository {

    private fqcnMap = new Map<string, {entry: JarEntryData, dependency: DependencyData}>() // Fqcn -> related data
    private sourceMap = new Map<string, SourceEntryData[]>() // Filename -> list of matches
    private jdkDependencySource: DependencySourceData
    private userDependencySource: DependencySourceData = {source: USER_SOURCE, description: 'User Provided', dependencies: []}
    private userPaths: PathData[] = []
    private externalDependencySources: DependencySourceData[] = []
    private externalPaths: PathData[] = []
    private classFileReader = new ClassFileReader()

    public constructor() {
    }

    /**
     * Get the version of java for the configured java home
     */
    public getVersion(javaHome: string) : string {
        let releaseFile = PathHelper.join(javaHome, 'release')
        if (fs.existsSync(releaseFile)) {
            let line = fs.readFileSync(releaseFile).toString().split('\n').find(l => {
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
        let pre9 = fs.existsSync(PathHelper.join(config.javaHome, 'jre/lib/rt.jar'))
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
    public addDependency(config: LocalConfig, jarFile: string, srcFile: string) : Promise<JvmProject> {
        let dependency = {fileName: jarFile, sourceFileName: srcFile, transitive: false} as DependencyData
        this.userDependencySource.dependencies.push(dependency)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Remove a jar depdnency
     * @param jarFile
     */
    public removeDependency(config: LocalConfig, jarFile: string) : Promise<JvmProject> {
        this.userDependencySource.dependencies = this.userDependencySource.dependencies.filter(d => d.fileName != jarFile)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Add a path component(s) to the project
     */
    public addPath(config: LocalConfig, userPath: PathData) : Promise<JvmProject> {
        this.userPaths.push(userPath)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Remove a user path
     * @param path
     */
    public removePath(config: LocalConfig, sourceDir: string) : Promise<JvmProject> {
        this.userPaths = this.userPaths.filter(p => p.sourceDir != sourceDir)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Update a project, to be called by specific project extensions such as Gradle, Maven
     */
    public async updateProject(config: LocalConfig, project: ProjectUpdateData) : Promise<JvmProject> {
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
        let classData = await this.getClassData()
        return {dependencySources: allSources, paths: allPaths, classdata: classData}
    }

    /**
     * Return the classpath
     */
    public getClasspath() : string {
        let classDirs = this.userPaths.concat(this.externalPaths).map(p => p.classDir).concat()
        let jarFiles = this.userDependencySource.dependencies.map(d => d.fileName)
        let extSources = this.externalDependencySources.map(s => s.dependencies.map(d => d.fileName))
        let extJars = extSources.length > 0 ? extSources.reduce((p,c) => p.concat(c)) : []
        return classDirs.concat(jarFiles).concat(extJars).join(PathHelper.delimiter)
    }

    /**
     * Load all class data from all the declared class directories
     */
    public async getClassData() : Promise<ClassData[]> {
        let allPaths = this.userPaths.concat(this.externalPaths).map(p => p.classDir)
        let files = (await Promise.all(allPaths.map(async dir => await this.findClassFiles(dir)))).reduce((p,c) => p.concat(c))
        return (await Promise.all(files.map(async file => await this.classFileReader.load(file)))) .filter(d => d)
    }

    /**
     * Return all of this project's local class files recursively from the given directory
     */
    public async findClassFiles(dir: string) : Promise<string[]> {
        let entries = await promisify(fs.readdir)(dir)
        let files = Promise.all(entries.map(async entry => {
            let file = PathHelper.join(dir, entry)
            let stats = await promisify(fs.stat)(file)
            return (stats.isDirectory()) ? this.findClassFiles(file) : file.endsWith('.class') ? [file] : []
        }))
        return (await files).reduce((p, c) => p.concat(c))
    }
    
    /**
     * Return classdata for the given path
     */
    public async getClassDataForPath(path: string) : Promise<ClassData> {
        return this.classFileReader.load(path)
    }

    /**
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    public async getPackages(dependency: DependencyData) : Promise<JarPackageData[]> {
        this.indexSourceJar(dependency)
        return this.resolveDependency(dependency)
    }

    /**
     * Returns the jar entry data given the fqcn and (optional) dependency jar; resolved means the path to the source file
     * has been determined if possible and the class data has been read
     * - user chooses class from dependency tree or 'find class' (fqcn and jarFile)
     * - Goto definition (fqcn)
     * @param fqcn 
     * @param jarFile 
     */
    public async resolveJarEntryData(fqcn : string, jarFile : string) : Promise<JarEntryData> {
        let entry = this.fqcnMap.get(fqcn)
        if (!entry) throw `No entry found for ${fqcn}`
        if (!jarFile) jarFile = entry.dependency.fileName
        let classEntry = entry.entry as ClassEntryData
        if (classEntry.classData && classEntry.srcEntry) return classEntry
        return this.readJarEntry(jarFile, entry.entry.path, '').then(data => {
            classEntry.classData = this.classFileReader.create(entry.entry.path, 0, data)
            classEntry.srcEntry = this.resolveSourceEntry(classEntry, entry.dependency.sourceFileName)
            return classEntry
        })
    }

    /**
     * Find the source entry for the given [ClassEntryData]
     */
    private resolveSourceEntry(entry: ClassEntryData, srcJar: string) : SourceEntryData {
        let filename = entry.classData ? entry.classData.sourceFile : undefined
        let sourceEntries = this.sourceMap.get(filename)
        return sourceEntries ? sourceEntries.find(e => e.jarFile === srcJar) : undefined
    }

    /**
     * Resolve all the packages and package entries in the given dependency jar file
     * @param dependency 
     */
    private async resolveDependency(dependency: DependencyData) : Promise<JarPackageData[]> {
        return this.findJarEntries(dependency.fileName).then(entries => {
            let packages = new Map<string, JarEntryData[]>()
            entries.forEach(entry => {
                let pkg = PathHelper.dirname(entry.name).replace(/\//g, '.')
                pkg = (dependency.jmod && pkg.startsWith('classes.')) ? pkg.replace('classes.', '') : pkg
                let ext = PathHelper.extname(entry.name)
                let filename = PathHelper.basename(entry.name)
                let name = PathHelper.basename(entry.name, ext)
                if (entry.dir) packages.set(pkg, [])
                else {
                    let jarEntry: JarEntryData = ext.endsWith('class') ? new ClassEntryData(pkg, name, entry.name) : new ResourceEntryData(filename, entry.name)
                    if (!packages.has(pkg)) packages.set(pkg, [])
                    packages.get(pkg).push(jarEntry)
                    this.fqcnMap.set(jarEntry.fqcn, {entry: jarEntry, dependency: dependency})
                }
            })
            let packageData = []
            Array.from(packages.entries()).forEach(entry => {
                if (entry[1].length > 0) {
                    let pkg = {name: entry[0], entries: entry[1]} as JarPackageData
                    packageData.push(pkg)
                }
            })
            return packageData
        })
    }

    /**
     * Find and index all the entries in the given dependency's source jar file
     */
    private async indexSourceJar(dependency: DependencyData) {
        if (!dependency.sourceFileName) return
        this.findJarEntries(dependency.sourceFileName).then(entries => {
            entries.forEach(entry => {
                if (!entry.dir) {
                    let filename = PathHelper.basename(entry.name)
                    let sourceEntry = new SourceEntryData(filename, entry.name, dependency.sourceFileName)
                    this.sourceMap.has(filename) ? this.sourceMap.get(filename).push(sourceEntry) : this.sourceMap.set(filename, [sourceEntry])
                }
            })
        })
    }

    public readJarEntry(jarFile: string, path: string, jmod: string) : Promise<Buffer> {
        return new Promise((resolve, reject) => {
            fs.readFile(jarFile, (err, data) => {
                console.log(`Got data ${data.length}`)
                if (err) reject(`Error opening jar file ${jarFile}:  ${err}`)
                else {
                    JSZip.loadAsync(data).then(zip => {
                        let entry = zip.file(path)
                        if (!entry) reject(`No entry found in ${jarFile} for ${path}`)
                        entry.async("nodebuffer").then((buffer) =>{
                            resolve(buffer)
                        }).catch(reason => {
                            reject(`Error in entry.async for ${entry.name} in ${jarFile}:  ${reason}`)
                        })
                    }).catch(reason => {
                        reject(`Error reading data from ${jarFile}:  ${reason}`)
                    })
                }
            })
        })
    }

    private findJarEntries(jarFile: string) : Promise<JSZip.JSZipObject[]> {
        return new Promise((resolve, reject) => {
            fs.readFile(jarFile, (err, data) => {
                if (err) reject(`Error opening jar file ${jarFile}:  ${err}`)
                else {
                    JSZip.loadAsync(data).then(zip => {
                        resolve(Object.values(zip.files))
                    }).catch(reason => {
                        reject(`Error in reading jar file ${jarFile}:  ${reason}`)
                    })
                }
            })
        })
    }
}