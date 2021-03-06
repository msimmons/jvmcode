package net.contrapt.jvmcode.service

import io.vertx.core.*
import io.vertx.core.logging.LoggerFactory
import javassist.bytecode.ClassFile
import net.contrapt.jvmcode.model.*
import net.contrapt.jvmcode.service.model.*
import java.io.DataInputStream
import java.io.File
import java.lang.IllegalArgumentException
import java.lang.IllegalStateException
import java.util.*
import java.util.concurrent.locks.ReentrantLock
import java.util.jar.JarEntry
import java.util.jar.JarFile
import kotlin.concurrent.withLock

class ProjectService(
    var config: JvmConfig, val javaHome : String,
    val symbolRepo: SymbolRepository
) {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val jdkSource : JDKDependencySource

    //TODO store user added ones persistently?
    private val userSource: UserDependencySource
    private val userSourceLock = ReentrantLock()
    // Classpath data added by user
    private val userPaths = mutableSetOf<UserPath>()
    private val userPathLock = ReentrantLock()

    // All the external dependencies being tracked
    private val externalSource = mutableSetOf<DependencySourceData>()
    private val externalSourceLock = ReentrantLock()
    // Classpath data added by other extensions
    private val externalPaths = mutableSetOf<PathData>()

    // Map of entry FQCN to the dependency it belongs to -- allow for multiple with same FQCN
    private val dependencyMap = mutableMapOf<String, MutableSet<Pair<JarEntryData,DependencyData>>>()
    private val dependencyMapLock = ReentrantLock()

    // Map of jarFile to [JarData]
    private val jarDataMap = mutableMapOf<String, JarData>()
    private val jarDataMapLock = ReentrantLock()

    // Map of source file name to source entry -- allow for multiple with same path
    private val sourceMap = mutableMapOf<String, MutableSet<Pair<SourceEntryData, DependencyData>>>()
    private val sourceMapLock = ReentrantLock()

    // Map of path to class data for all project classes
    private val classMap = mutableMapOf<String, ClassData>()
    private val classMapLock = ReentrantLock()

    val javaVersion : String

    init {
        javaVersion = getVersion()
        jdkSource =  JDKDependencySource.create(config, javaHome, javaVersion)
        jdkSource.dependencies.associate { dep ->
            indexJarData(dep)
            dep.sourceFileName to dep
        }.forEach {
            indexSourceJarData(it.value)
        }
        userSource = UserDependencySource()
    }

    /**
     * Try to find the 'release' file to get the version, otherwise use system property
     */
    private fun getVersion() : String {
        val file = File(javaHome+File.separator+"release")
        if (file.exists()) {
            val versionEntry = File(javaHome + File.separator + "release").readLines().firstOrNull {
                it.startsWith("JAVA_VERSION")
            }
            return versionEntry?.split("=")?.get(1)?.replace("\"", "") ?: System.getProperty("java.version")
        }
        else return System.getProperty("java.version")
    }

    /**
     * Get a JvmProject representation of current dependencies and classpath
     */
    fun getJvmProject(config: JvmConfig = this.config) : JvmProject {
        this.config = config
        val sorted = listOf(jdkSource, userSource) + externalSource
        return JvmProject(sorted, externalPaths + userPaths, classMap.values, getClasspath())
    }

    private fun removeJarData(fileName: String) {
        jarDataMapLock.withLock { jarDataMap.remove(fileName) }
    }

    private fun addJarData(fileName: String, entry: JarData) {
        jarDataMapLock.withLock { jarDataMap.put(fileName, entry) }
    }

    private fun removeSourceData(entryName: String?) {
        sourceMapLock.withLock { sourceMap.remove(entryName) }
    }

    private fun addSourceData(entry: SourceEntryData, dep: DependencyData) {
        sourceMapLock.withLock {
            sourceMap.getOrPut(entry.name, { mutableSetOf() }).add(entry to dep)
        }
    }

    private fun addClassMap(path: String, data: ClassData) {
        classMapLock.withLock { classMap.put(path, data) }
    }

    /**
     * User adds a single JAR file dependency
     */
    fun addUserDependency(jarFile: String, srcFile: String?) {
        userSourceLock.withLock {
            userSource.dependencies.add(Dependency.create(jarFile, srcFile))
        }
    }

    /**
     * Remove a user dependency
     */
    fun removeUserDependency(jarFile: String) {
        userSourceLock.withLock {
            userSource.dependencies.removeIf { it.fileName == jarFile }
        }
    }

    /**
     * User adds a path component
     */
    fun addUserPath(pathData: PathData) {
        userPathLock.withLock {
            userPaths.add(UserPath(pathData.sourceDir, pathData.classDir, pathData.name))
        }
        indexClassData(listOf(pathData.classDir))
    }

    /**
     * Remove a user path component
     */
    fun removeUserPath(name: String) {
        val removed = userPathLock.withLock {
            userPaths.removeIf { it.name == name }
        }
        if (removed) {
            // Remove class data?
        }
    }

    /**
     * Update all user project info in single operation (for restoring user settings)
     */
    fun updateUserProject(request: ProjectUpdateRequest) {
        request.dependencySources.forEach {
            userSourceLock.withLock {
                userSource.dependencies.forEach {
                    removeJarData(it.fileName)
                }
                userSource.dependencies.clear()
                userSource.dependencies.addAll(it.dependencies)
            }
        }
        request.paths.forEach {
            userPathLock.withLock {
                userPaths.clear()
                userPaths.add(UserPath(it.sourceDir, it.classDir, it.name))
            }
        }
        userSource.dependencies.forEach {
            indexDependency(it)
        }
        indexClassData(userPaths.map { it.classDir }.toSet())
    }

    /**
     * Process update of project dependency information from an external source
     */
    fun updateProject(request: ProjectUpdateRequest) {
        externalSourceLock.withLock {
            externalSource.filter { it.source == request.source }.forEach {
                it.dependencies.forEach { removeJarData(it.fileName) }
            }
            externalSource.removeIf { it.source == request.source }
            externalPaths.removeIf { it.source == request.source }
            externalSource.addAll(request.dependencySources)
            externalPaths.addAll(request.paths)
            externalSource.filter { it.source == request.source }.forEach {
                it.dependencies.forEach {
                    indexDependency(it)
                }
            }
        }
        val paths = request.paths.map { it.classDir }
        indexClassData(paths)
    }

    private fun addDependencyMap(entry: JarEntryData, dependencyData: DependencyData) {
        dependencyMapLock.withLock {
            dependencyMap.getOrPut(entry.fqcn, { mutableSetOf() }).add(entry to dependencyData)
        }
    }

    private fun indexDependency(dep: DependencyData) {
        Vertx.currentContext().apply {
            executeBlocking( Handler<Promise<Unit>> { _ -> indexJarData(dep) }, false, Handler { ar ->
                if (ar.failed()) throw ar.cause()
            })
            executeBlocking( Handler<Promise<Unit>> { _ -> indexSourceJarData(dep) }, false, Handler { ar ->
                if (ar.failed()) throw ar.cause()
            })
        }
    }

    fun indexJarData(dependencyData: DependencyData) : JarData {
        val start = System.currentTimeMillis()
        var entryCount = 0
        if (jarDataMap.containsKey(dependencyData.fileName)) {
            val data = jarDataMap[dependencyData.fileName]!!
            logger.debug("Returning ${data.packages.size} packages for ${dependencyData.fileName}")
            return data
        }
        logger.debug("Indexing ${dependencyData.fileName}")
        val pkgMap = mutableMapOf<String, MutableSet<JarEntryData>>()
        val isJmod = dependencyData.fileName.endsWith(".jmod")
        val jarFile = runCatching { JarFile(dependencyData.fileName) }
        jarFile.getOrElse { e -> throw RuntimeException("Unable to get jar entries for ${dependencyData.fileName}", e) }.use {
            it.entries().toList().forEach { entry ->
                entryCount++
                when (val ed = createEntryData(entry, isJmod)) {
                    is PackageEntryData -> pkgMap.putIfAbsent(ed.pkg, sortedSetOf())
                    is ClassEntryData -> {
                        pkgMap.getOrPut(ed.pkg, { sortedSetOf() }).add(ed)
                        symbolRepo.saveJarEntry(ed)
                        addDependencyMap(ed, dependencyData)
                    }
                    is ResourceEntryData -> {
                        pkgMap.getOrPut(ed.pkg, { sortedSetOf() }).add(ed)
                        addDependencyMap(ed, dependencyData)
                    }
                    else -> logger.warn("Unhandled when for $ed")
                }
            }
        }
        val packages = pkgMap.asSequence()
            .map { entry -> JarPackageData(entry.key).apply { entries.addAll(entry.value) } }
            .filter { pkg -> pkg.entries.size > 0 && !config.excludes.any { exclude -> pkg.name.startsWith(exclude)} }
            .toSortedSet()
        val jarData = JarData(dependencyData.fileName, packages)
        addJarData(dependencyData.fileName, jarData)
        val end = System.currentTimeMillis()
        logger.debug("Finished indexing ${dependencyData.fileName} $entryCount entries in ${end-start}ms")
        return jarData
    }

    fun indexSourceJarData(dependencyData: DependencyData) {
        val start = System.currentTimeMillis()
        var entryCount = 0
        val jarFileName = dependencyData.sourceFileName
        if (jarFileName.isNullOrEmpty()) return
        val jarFile = runCatching { JarFile(jarFileName) }
        if (jarFile.isFailure) return
        logger.debug("Indexing ${jarFileName}")
        jarFile.getOrThrow().use {
            it.entries().asSequence().forEach { entry ->
                entryCount++
                val ed = SourceEntryData.create(entry.name, jarFileName)
                addSourceData(ed, dependencyData)
            }
        }
        val end = System.currentTimeMillis()
        logger.debug("Finished indexing ${jarFileName} $entryCount entries in ${end-start}ms")
    }

    private fun createEntryData(entry: JarEntry, isJmod: Boolean) : JarEntryData {
        if (entry.isDirectory) {
            return PackageEntryData.create(entry.name, isJmod)
        }
        else if (entry.name.endsWith(".class")) {
            return ClassEntryData.create(entry.name, isJmod)
        }
        else {
            return ResourceEntryData.create(entry.name, isJmod)
        }
    }

    private fun indexClassData(path: String) : ClassData? {
        val file = File(path)
        logger.info("Got file $file")
        if (!file.exists()) return null
        val cached = classMap.get(path)
        if (cached?.lastModified ?: 0 < file.lastModified()) {
            val data = ClassData.create(ClassFile(DataInputStream(file.inputStream())), file.path, file.lastModified())
            resolveSourceFile(data)
            symbolRepo.addClassData(data)
            addClassMap(path, data)
            return data
        }
        else return cached
    }

    private fun indexClassData(paths: Collection<String>) {
        val start = System.currentTimeMillis()
        var fileCount = 0
        var refreshCount = 0
        paths.forEach {dir ->
            File(dir).walkTopDown().filter { it.extension == "class" }.forEach {
                fileCount++
                val cached = classMap.get(it.path)
                if (cached?.lastModified ?: 0 < it.lastModified()) {
                    refreshCount++
                    val data = ClassData.create(ClassFile(DataInputStream(it.inputStream())), it.path, it.lastModified())
                    resolveSourceFile(data)
                    symbolRepo.addClassData(data)
                    addClassMap(it.path, data)
                }
            }
        }
        val end = System.currentTimeMillis()
        logger.info("indexClassData: $fileCount files, $refreshCount refreshed, ${end-start}ms")
    }

    /**
     * Find the full path of the source file for the given [ClassData]
     */
    private fun resolveSourceFile(data: ClassData) {
        val pkgDir = data.name.substringBeforeLast('.').replace('.', File.separatorChar)
        val path = (externalPaths.map { it.sourceDir } + userPaths.map { it.sourceDir })
            .map { "$it${File.separatorChar}$pkgDir${File.separatorChar}${data.srcFile}" }
            .firstOrNull {
                File(it).exists()
        }
        if (path != null) data.srcFile = path
    }

    /**
     * Get [ClassData] for all project classes
     */
    fun getClassData() : ClassDataHolder {
        val paths = (userPaths.map{ it.classDir } + externalPaths.map { it.classDir }).toSet()
        indexClassData(paths)
        return ClassDataHolder(classMap.values.sorted())
    }

    /**
     * Get [ClassData] for the given path
     */
    fun getClassData(path: String) : ClassData? {
        return indexClassData(path)
    }

    /**
     * Resolve the location of the source code for the given [JarEntryData]
     * If it is a class, resolve the [ClassData] and resolve the [ClassEntryData.srcEntry]
     * If a resource, return the entry as is.
     * TODO decompile a class?
     */
    fun resolveJarEntrySource(jarFile: String, fqcn: String) : JarEntryData {
        val entryPair = dependencyMap[fqcn]?.firstOrNull { it.second.fileName == jarFile }
        if ( entryPair == null ) throw IllegalArgumentException("No such entry $fqcn in $jarFile")
        val entry = entryPair.first
        val dependencyData = entryPair.second
        return when (entry) {
            is ClassEntryData -> {
                ensureResolved(dependencyData.fileName, entry)
                entry.srcEntry = getSourceEntryData(entry, dependencyData)
                entry
            }
            is ResourceEntryData -> entry
            else -> throw IllegalStateException("Unhandled type for ${entry}")
        }
    }

    private fun ensureResolved(file: String, entry: ClassEntryData) {
        if (entry.isResolved()) return
        val jarFile = JarFile(file)
        val jarEntry = jarFile.getJarEntry(entry.path)
        val cf = ClassFile(DataInputStream(jarFile.getInputStream(jarEntry)))
        entry.resolve(ClassData.create(cf, entry.path, 0L))
    }

    /**
     * Return the full classpath implied by the current dependencies (minus jdk dependencies)
     */
    fun getClasspath() : String {
        val components = (userPaths.map { it.classDir } +
                externalPaths.map { it.classDir }).toSet() +
                userSource.dependencies.map { it.fileName } +
                externalSource.asSequence().flatMap { it.dependencies.asSequence().map { it.fileName } }
        return components.joinToString(File.pathSeparator) { it }
    }

    private fun getSourceEntryData(entry: ClassEntryData, dependencyData: DependencyData) : SourceEntryData? {
        val srcName = entry.srcName()
        val entries = sourceMap.getOrElse(srcName) {
            val srcEntry : Set<Pair<SourceEntryData, DependencyData>>? = null
            config.extensions.fold(srcEntry) { curEntry, ext ->
                if (curEntry == null) sourceMap.get("$srcName.$ext") else curEntry
            }
        }
        val found = entries?.firstOrNull { it.second.fileName == dependencyData.fileName }
        return if (found != null) found.first else entries?.firstOrNull()?.first
    }

}