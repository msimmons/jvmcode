package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import javassist.bytecode.ClassFile
import net.contrapt.jvmcode.model.*
import net.contrapt.jvmcode.service.model.*
import java.io.DataInputStream
import java.io.File
import java.lang.IllegalArgumentException
import java.lang.IllegalStateException
import java.util.jar.JarEntry
import java.util.jar.JarFile

class ProjectService(
    var config: JvmConfig, val javaHome : String,
    val symbolRepo: SymbolRepository
) {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val jdkSource : JDKDependencySource

    //TODO store user added ones persistently?
    private val userSource: UserDependencySource
    // Classpath data added by user
    private val userPath = UserPath()

    // All the external dependencies being tracked
    private val externalSource = mutableSetOf<DependencySourceData>()
    // Classpath data added by other extensions
    private val externalPaths = mutableSetOf<PathData>()

    // Map of entry FQCN to the dependency it belongs to -- allow for multiple with same FQCN
    private val dependencyMap = mutableMapOf<String, MutableSet<Pair<JarEntryData,DependencyData>>>()

    // Map of jarFile to [JarData]
    private val jarDataMap = mutableMapOf<String, JarData>()

    // Map of source file name to source entry -- allow for multiple with same path
    private val sourceMap = mutableMapOf<String, MutableSet<Pair<SourceEntryData, DependencyData>>>()

    // Map of path to class data for all project classes
    private val classMap = mutableMapOf<String, ClassData>()

    val javaVersion : String

    init {
        javaVersion = getVersion()
        jdkSource =  JDKDependencySource.create(config, javaHome, javaVersion)
        jdkSource.dependencies.forEach {
            indexJarData(it)
            indexSourceJarData(it)
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
        return JvmProject(sorted, externalPaths + userPath, getClasspath())
    }

    /**
     * User adds a single JAR file dependency
     */
    fun addUserDependency(jarFile: String, srcFile: String?) {
        userSource.dependencies.add(Dependency.create(jarFile, srcFile))
    }

    /**
     * Remove a user dependency
     */
    fun removeUserDependency(jarFile: String) {
        userSource.dependencies.removeIf { it.fileName == jarFile }
    }

    /**
     * User adds a path component
     */
    fun addUserPath(pathData: PathData) {
        pathData.classDirs.forEach { userPath.classDirs.add(it) }
        pathData.sourceDirs.forEach { userPath.sourceDirs.add(it) }
    }

    /**
     * Remove a user path component
     */
    fun removeUserPath(path: String) {
        userPath.classDirs.remove(path)
        userPath.sourceDirs.remove(path)
    }

    /**
     * Update all user project info in single operation (for restoring user settings)
     */
    fun updateUserProject(request: ProjectUpdateRequest) {
        request.dependencySources.forEach {
            userSource.dependencies.forEach { jarDataMap.remove(it.fileName) }
            userSource.dependencies.clear()
            userSource.dependencies.addAll(it.dependencies)
        }
        request.paths.forEach {
            userPath.classDirs.clear()
            userPath.sourceDirs.clear()
            userPath.classDirs.addAll(it.classDirs)
            userPath.sourceDirs.addAll(it.sourceDirs)
        }
        userSource.dependencies.forEach {
            indexJarData(it)
            indexSourceJarData(it)
        }
    }

    /**
     * Process update of project dependency information from an external source
     */
    fun updateProject(request: ProjectUpdateRequest) {
        externalSource.filter { it.source == request.source }.forEach {
            it.dependencies.forEach { jarDataMap.remove(it.fileName) }
        }
        externalSource.removeIf { it.source == request.source }
        externalPaths.removeIf { it.source == request.source }
        externalSource.addAll(request.dependencySources)
        externalPaths.addAll(request.paths)
        externalSource.filter { it.source == request.source }.forEach {
            it.dependencies.forEach {
                indexJarData(it)
                indexSourceJarData(it)
            }
        }
    }

    private fun addDependencyMap(entry: JarEntryData, dependencyData: DependencyData) {
        dependencyMap.getOrPut(entry.fqcn, { mutableSetOf() }).add(entry to dependencyData)
    }

    fun indexJarData(dependencyData: DependencyData) : JarData {
        if (jarDataMap.containsKey(dependencyData.fileName)) return jarDataMap[dependencyData.fileName]!!
        val pkgMap = mutableMapOf<String, MutableSet<JarEntryData>>()
        val isJmod = dependencyData.fileName.endsWith(".jmod")
        val jarFile = runCatching { JarFile(dependencyData.fileName) }
        jarFile.getOrElse { e -> throw RuntimeException("Unable to get jar entries for ${dependencyData.fileName}", e) }
            .entries().toList().forEach { entry ->
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
        val packages = pkgMap.asSequence()
            .map { entry -> JarPackageData(entry.key).apply { entries.addAll(entry.value) } }
            .filter { pkg -> pkg.entries.size > 0 && !config.excludes.any { exclude -> pkg.name.startsWith(exclude)} }
            .toSortedSet()
        val jarData = JarData(dependencyData.fileName, packages)
        jarDataMap[dependencyData.fileName] = jarData
        return jarData
    }

    fun indexSourceJarData(dependencyData: DependencyData) {
        val jarFileName = dependencyData.sourceFileName
        if (jarFileName.isNullOrEmpty()) return
        val jarFile = runCatching { JarFile(jarFileName) }
        jarFile.getOrElse { e -> throw java.lang.RuntimeException("Unable to get source entries for ${dependencyData.sourceFileName}", e) }
            .entries().asSequence().forEach { entry ->
                val ed = SourceEntryData.create(entry.name, jarFileName)
                sourceMap.getOrPut(ed.name, { mutableSetOf() })
                    .add(ed to dependencyData)
            }
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

    /**
     * Get [ClassData] for all project classes
     */
    fun getClassData() : ClassDataHolder {
        val paths = userPath.classDirs + externalPaths.flatMap { it.classDirs }
        paths.forEach {dir ->
            File(dir).walkTopDown().filter { it.extension == "class" && !it.name.contains("$") }.forEach {
                val data = ClassData.create(ClassFile(DataInputStream(it.inputStream())))
                data.lastModified = it.lastModified()
                data.path = it.path
                classMap.put(it.path, data)
            }
        }
        return ClassDataHolder(classMap.values)
    }

    /**
     * Fill in the contents of the given [JarEntryData]
     * If it is a class, try and find the source and resolve the [ClassData]
     * TODO decompile a class
     * If resource, return the contents as is
     */
    fun getJarEntryContents(jarFile: String, fqcn: String) : JarEntryData {
        val entryPair = dependencyMap[fqcn]?.firstOrNull { it.second.fileName == jarFile }
        if ( entryPair == null ) throw IllegalArgumentException("No such entry $fqcn in $jarFile")
        val entry = entryPair.first
        val dependencyData = entryPair.second
        return when (entry) {
            is ClassEntryData -> {
                ensureResolved(dependencyData.fileName, entry)
                entry.srcEntry = getSourceEntryData(entry, dependencyData)
                //getSourceContent(dependencyData.sourceFileName, dependencyData.jmod, entry)
                entry
            }
            is ResourceEntryData -> entry //getContentFromJar(dependencyData.fileName, entry)
            else -> throw IllegalStateException("Unhandled type for ${entry}")
        }
    }

    private fun ensureResolved(file: String, entry: ClassEntryData) {
        if (entry.isResolved()) return
        val jarFile = JarFile(file)
        val jarEntry = jarFile.getJarEntry(entry.path)
        val cf = ClassFile(DataInputStream(jarFile.getInputStream(jarEntry)))
        entry.resolve(ClassData.create(cf))
    }

    /**
     * Return the source code content for a class if available or fill in content from [ClassData]
     */
    private fun getSourceContent(srcFile: String?, jmod: String?, entry: ClassEntryData) : ClassEntryData {
        when (srcFile) {
            null -> {}
            else -> getContentFromSourceJar(srcFile, jmod, entry)
        }
        return entry
    }

    /**
     * Return the full classpath implied by the current dependencies (minus jdk dependencies)
     */
    fun getClasspath() : String {
        val components = userPath.classDirs +
                externalPaths.flatMap { it.classDirs } +
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

    private fun getContentFromSourceJar(fileName: String, jmod: String?, entry: ClassEntryData) : ClassEntryData {
        try {
            val jarFile = JarFile(fileName)
            val prefix = if (jmod == null) "" else "${jmod}${File.separator}"
            val entryPath = "${prefix}${entry.pkg.replace(".", File.separator)}${File.separator}${entry.srcName()}"
            logger.debug("${entry.name} -> ${entryPath} in ${fileName}")
            var jarEntry : JarEntry? = jarFile.getJarEntry(entryPath)
            // Handles cases where srcName is null by trying various extensions -- a bit of a hack
            jarEntry = config.extensions.fold(jarEntry) { curEntry, ext ->
                if (curEntry == null) jarFile.getJarEntry("${entryPath}.${ext}") else curEntry
            }
            // If still not found, maybe we have the directory wrong, so let's look thru the whole damn file.
            if ( jarEntry == null ) {
                jarEntry = jarFile.entries().asSequence().find { it.name.endsWith(entry.srcName()) }
            }
            if (jarEntry != null) {
                /*
                val content = jarFile.getInputStream(jarEntry).bufferedReader().use {
                    it.readText().replace("\r", "")
                }
                 */
                val sourceEntry = SourceEntryData.create(jarEntry.name, fileName)
                entry.srcEntry = sourceEntry
                //symbolRepo.saveJarEntry(sourceEntry)
            }
            return entry
        }
        catch (e: Exception) {
            logger.warn("Unable to read content for ${entry.name} from ${fileName}", e)
            return entry
        }
    }

    private fun getContentFromJar(fileName: String, entry: ResourceEntryData) : ResourceEntryData {
        try {
            val jarFile = JarFile(fileName)
            val jarEntry = jarFile.getJarEntry(entry.path)
/*
            jarFile.getInputStream(jarEntry).use {
                entry.content = it.bufferedReader().use {
                    it.readText()
                }
            }
*/
            return entry
        }
        catch (e: Exception) {
            throw RuntimeException("Unable to read content for ${entry.name}")
        }
    }

}