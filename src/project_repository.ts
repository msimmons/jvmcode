'use strict';

import * as fs from 'fs'
import JSZip = require("jszip");
import * as PathHelper from 'path'
import { JarEntryData, ClassEntryData, JarPackageData, SourceEntryData, ResourceEntryData } from './jar_model'
import { DependencyData, DependencySourceData, PathData, JvmProject, ProjectUpdateData, SYSTEM_SOURCE, USER_SOURCE } from './project_model'
import { ClassData } from "./class_data/class_data"
import { LocalConfig, dependencyLabel } from "./models";
import { ClassFileReader } from "./class_data/class_file_reader";
import { promisify } from 'util'
import { performance } from 'perf_hooks'

/**
 * All non-vscode specific Project services; integration with vscode is handled in the controllers
 */
export class ProjectRepository {

    private fqcnEntryMap = new Map<string, {entry: JarEntryData, dependency: DependencyData}>() // Fqcn -> related data
    private entryNameToFqcn = new Map<string, Set<string>>()
    private fqncClassMap = new Map<string, ClassData>() // Fqcn -> local class data
    private classNameToFqcn = new Map<string, Set<string>>()
    private sourceMap = new Map<string, SourceEntryData[]>() // Filename -> list of matches
    private packageMap = new Map<string, JarPackageData[]>() // jar name to resolved packages
    private resolvedSourceJars = new Set<string>()
    private jdkDependencySource: DependencySourceData
    private userDependencySource: DependencySourceData = {source: USER_SOURCE, description: 'User Provided', dependencies: []}
    private userPaths: PathData[] = []
    private externalDependencySources: DependencySourceData[] = []
    private externalPaths: PathData[] = []
    private classFileReader = new ClassFileReader()

    public constructor() {
    }

    /**
     * Find all class jar entries by unqualified name
     */
    public findJarEntriesByName(name: string) : ClassEntryData[] {
        let fqcns = this.entryNameToFqcn.get(name)
        if (fqcns) return Array.from(fqcns).map(fqcn => this.fqcnEntryMap.get(fqcn)).filter(e => e).map(e => e.entry) as ClassEntryData[]
        else return []
    }

    /**
     * Find all class data entries by unqualified name
     */
    public findClassDataByName(name: string) : ClassData[] {
        let fqcns = this.classNameToFqcn.get(name)
        if (fqcns) return Array.from(fqcns).map(fqcn => this.fqncClassMap.get(fqcn)).filter(e => e)
        else return []
    }

    /**
     * Get the version of java for the configured java home
     */
    private getVersion(javaHome: string) : string {
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

    private createJdkSource(config: LocalConfig) : DependencySourceData {
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
    private initializeJDK(config: LocalConfig) {
        if (!this.jdkDependencySource) this.jdkDependencySource = this.createJdkSource(config)
    }

    /**
     * Add a new single jar file dependency
     * @param dependency 
     */
    public async addDependency(config: LocalConfig, jarFile: string, srcFile: string) : Promise<JvmProject> {
        let dependency = {fileName: jarFile, sourceFileName: srcFile, transitive: false} as DependencyData
        this.userDependencySource.dependencies.push(dependency)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Remove a jar depdnency
     * @param jarFile
     */
    public async removeDependency(config: LocalConfig, jarFile: string) : Promise<JvmProject> {
        this.userDependencySource.dependencies = this.userDependencySource.dependencies.filter(d => d.fileName != jarFile)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Add a path component(s) to the project
     */
    public async addPath(config: LocalConfig, userPath: PathData) : Promise<JvmProject> {
        this.userPaths.push(userPath)
        let update = {source: USER_SOURCE, paths: this.userPaths, dependencySources: [this.userDependencySource]} as ProjectUpdateData
        return this.updateProject(config, update)
    }

    /**
     * Remove a user path
     * @param path
     */
    public async removePath(config: LocalConfig, sourceDir: string) : Promise<JvmProject> {
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
            // Remove existing matching source
            this.externalDependencySources = this.externalDependencySources.filter(ds => ds.source != project.source)
            // Add the new ones (if they have dependencies)
            this.externalDependencySources = this.externalDependencySources.concat(project.dependencySources.filter(s => s.dependencies.length > 0))
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
        if (allPaths.length === 0) return []
        let files = (await Promise.all(allPaths.map(async dir => await this.findClassFiles(dir)))).reduce((p,c) => p.concat(c))
        let classData = (await Promise.all(files.map(async file => await this.classFileReader.load(file)))) .filter(d => d)
        classData.forEach(cd => this.addClassData(cd))
        return classData
    }

    /**
     * Return classdata for the given path
     */
    public async getClassDataForPath(path: string) : Promise<ClassData> {
        let classData =  await this.classFileReader.load(path)
        this.addClassData(classData)
        return classData
    }

    /**
     * Cache name and fqcn -> class data
     */
    private addClassData(classData: ClassData) {
        let name = classData.fqcn.split('.').slice(-1)[0]
        this.fqncClassMap.set(classData.fqcn, classData)
        this.classNameToFqcn.has(name) ? this.classNameToFqcn.get(name).add(classData.fqcn) : this.classNameToFqcn.set(name, new Set([classData.fqcn]))
    }

    /**
     * Find all directory entries recursively matching the given criteria
     * @param dir The directory to start in
     * @param name Optional exact match to filename plus extension
     * @param extension Optional exact match to extension (with dot)
     * @param directory Optional return directories if true
     */
    public async findRecursive(dir: string, name?: string, extension?: string, directory?: boolean) : Promise<string[]> {
        if (! await promisify(fs.exists)(dir)) return []
        let entries = await promisify(fs.readdir)(dir)
        let files = Promise.all(entries.map(async entry => {
            let file = PathHelper.join(dir, entry)
            let stats = await promisify(fs.stat)(file)
            let entryMatch = []
            let dirMatch = []
            if (directory) {
                if (stats.isDirectory()) dirMatch.push(file)
            }
            else if (name) {
                if (name === entry) entryMatch.push(file)
            }
            else if (extension) {
                if (extension === PathHelper.extname(entry)) entryMatch.push(file)
            }
            else if (!stats.isDirectory()) {
                entryMatch.push(file)
            }
            return stats.isDirectory() ? (await this.findRecursive(file, name, extension, directory)).concat(dirMatch) : entryMatch
        }))
        return (await files).reduce((p, c) => p.concat(c))
    }

    /**
     * Find a local source file in the configured source directories
     */
    public async findSourceFile(name: string) : Promise<string> {
        let allPaths = this.userPaths.concat(this.externalPaths).map(p => p.sourceDir)
        let paths = await Promise.all(allPaths.map(async p => {
            return await this.findRecursive(p, name)
        }))
        let reduced = paths.length > 0 ? paths.reduce((p,c) => p.concat(c)) : []
        return reduced.length > 0 ? reduced[0] : undefined
    }

    /**
     * Return all of this project's local class files recursively from the given directory
     */
    private async findClassFiles(dir: string) : Promise<string[]> {
        if (!await promisify(fs.exists)(dir)) return []
        let entries = await promisify(fs.readdir)(dir)
        let files = Promise.all(entries.map(async entry => {
            let file = PathHelper.join(dir, entry)
            let stats = await promisify(fs.stat)(file)
            return (stats.isDirectory()) ? this.findClassFiles(file) : file.endsWith('.class') ? [file] : []
        }))
        return (await files).reduce((p, c) => p.concat(c))
    }
    
    /**
     * Returns the collection of package entries for the dependency
     * @param dependency 
     */
    public async resolvePackages(dependency: DependencyData) : Promise<JarPackageData[]> {
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
        let entry = this.fqcnEntryMap.get(fqcn)
        if (!entry) throw `No entry found for ${fqcn}`
        if (!jarFile) jarFile = entry.dependency.fileName
        if (entry.entry.resolved) return entry.entry
        this.fqcnEntryMap.set(fqcn, entry)
        let classEntry = entry.entry as ClassEntryData
        return this.readJarEntry(jarFile, entry.entry.path).then(data => {
            classEntry.classData = this.classFileReader.create(entry.entry.path, 0, data)
            classEntry.srcEntry = this.resolveSourceEntry(classEntry, entry.dependency.sourceFileName)
            classEntry.resolved = true
            return classEntry
        })
    }

    /**
     * Find the source entry for the given [ClassEntryData] source file by searching
     * all the indexed source files preferring the one that comes from the associated source jar
     */
    private resolveSourceEntry(entry: ClassEntryData, srcJar: string) : SourceEntryData {
        let filename = entry.classData ? entry.classData.sourceFile : undefined
        let sourceEntries = this.sourceMap.get(filename)
        let match =  sourceEntries ? sourceEntries.find(e => e.jarFile === srcJar) : undefined
        return match ? match : (sourceEntries ? sourceEntries[0] : undefined)
    }

    /**
     * Resolve all the packages and package entries in the given dependency jar file
     * @param dependency 
     */
    private async resolveDependency(dependency: DependencyData) : Promise<JarPackageData[]> {
        this.indexSourceJar(dependency)
        if (this.packageMap.has(dependency.fileName)) return this.packageMap.get(dependency.fileName)
        let count = 0
        performance.mark('start')
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
                    this.fqcnEntryMap.set(jarEntry.fqcn, {entry: jarEntry, dependency: dependency})
                    let uqn = jarEntry.fqcn.split('.').slice(-1)[0]
                    this.entryNameToFqcn.has(uqn) ? this.entryNameToFqcn.get(uqn).add(jarEntry.fqcn) : this.entryNameToFqcn.set(uqn, new Set<string>([jarEntry.fqcn]))
                }
                count++
            })
            let packageData = Array.from(packages.entries()).filter(e => e[1].length > 0)
                .map(e => { return {name: e[0], entries: e[1].sort((a,b) => a.name.localeCompare(b.name))} })
                .sort((a, b) => a.name.localeCompare(b.name))
            dependency.resolved = true
            this.packageMap.set(dependency.fileName, packageData)
            performance.mark('end')
            performance.measure(`resolveDependency(${dependency.fileName}), ${count} entries`, 'start', 'end')
            return packageData
        })
    }

    /**
     * Find and index all the entries in the given dependency's source jar file
     */
    private async indexSourceJar(dependency: DependencyData) {
        if (!dependency.sourceFileName) return
        if (this.resolvedSourceJars.has(dependency.sourceFileName)) return
        this.resolvedSourceJars.add(dependency.sourceFileName)
        let count = 0
        performance.mark('start')
        this.findJarEntries(dependency.sourceFileName).then(entries => {
            entries.forEach(entry => {
                if (!entry.dir) {
                    let filename = PathHelper.basename(entry.name)
                    let sourceEntry = new SourceEntryData(filename, entry.name, dependency.sourceFileName)
                    this.sourceMap.has(filename) ? this.sourceMap.get(filename).push(sourceEntry) : this.sourceMap.set(filename, [sourceEntry])
                    count++
                }
            })
            performance.mark('end')
            performance.measure(`indexSourceJar(${dependency.sourceFileName}), ${count} entries`, 'start', 'end')
        })
    }

    /**
     * Read the given path from the given jar file returing contents as Buffer
     * @param jarFile 
     * @param path 
     */
    public async readJarEntry(jarFile: string, path: string) : Promise<Buffer> {
        try {
            performance.mark('startRead')
            let data = await promisify(fs.readFile)(jarFile)
            performance.mark('startZip')
            let zip = await JSZip.loadAsync(data)
            performance.mark('startFile')
            let entry = zip.file(path)
            performance.mark('endFile')
            performance.measure(`readJarEntry(${jarFile}).data, ${data.length}`, 'startRead', 'startZip')
            performance.measure(`readJarEntry(${jarFile}).zip, ${zip.length}`, 'startZip', 'startFile')
            performance.measure(`readJarEntry(${jarFile}).file, ${entry.name}`, 'startFile', 'endFile')
            if (!entry) {
                console.error(`No entry found in ${jarFile} for ${path}`)
                return undefined
            }
            return await entry.async("nodebuffer")
        } catch(reason) {
            console.error(`Error reading data from ${jarFile}:  ${reason}`)
            return undefined
        }
    }

    private async findJarEntries(jarFile: string) : Promise<JSZip.JSZipObject[]> {
        try {
            let data = await promisify(fs.readFile)(jarFile)
            let zip = await JSZip.loadAsync(data)
            return Object.values(zip.files)
        }
        catch (error) {
            console.error(error)
            return []
        }
    }
}