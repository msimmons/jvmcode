package net.contrapt.jvmcode.service

import io.vertx.core.json.Json
import io.vertx.core.logging.LoggerFactory
import javassist.bytecode.ClassFile
import net.contrapt.jvmcode.language.JavaParseRequest
import net.contrapt.jvmcode.language.ParseService
import net.contrapt.jvmcode.model.*
import net.contrapt.jvmcode.service.model.*
import java.io.DataInputStream
import java.io.File
import java.io.InputStream
import java.util.jar.JarEntry
import java.util.jar.JarFile

class ProjectService(
    var config: JvmConfig, val javaHome : String,
    val parseService: ParseService,
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

    // Map of entry FQCN to the dependency it belongs to
    private val dependencyMap = mutableMapOf<String, DependencyData>()

    // Map of path to class data for all project classes
    private val classMap = mutableMapOf<String, ClassData>()

    val javaVersion : String

    init {
        javaVersion = getVersion()
        jdkSource =  JDKDependencySource.create(config, javaHome, javaVersion)
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
            userSource.dependencies.clear()
            userSource.dependencies.addAll(it.dependencies)
        }
        request.paths.forEach {
            userPath.classDirs.clear()
            userPath.sourceDirs.clear()
            userPath.classDirs.addAll(it.classDirs)
            userPath.sourceDirs.addAll(it.sourceDirs)
        }
    }

    /**
     * Process update of project dependency information from an external source
     */
    fun updateProject(request: ProjectUpdateRequest) {
        externalSource.removeIf { it.source == request.source }
        externalPaths.removeIf { it.source == request.source }
        externalSource.addAll(request.dependencySources)
        externalPaths.addAll(request.paths)
    }

    /**
     * For the given dependency, find all the entries contained in the jar file and organize them by package
     * in the resulting data structures [JarData] -> [JarPackageData]
     */
    fun getJarData(dependencyData: DependencyData) : JarData {
        val pkgMap = mutableMapOf<String, MutableSet<JarEntryData>>()
        val isJmod = dependencyData.fileName.endsWith(".jmod")
        try {
            val jarFile = JarFile(dependencyData.fileName)
            jarFile.entries().toList().forEach { entry ->
                val jed = JarEntryData.create(entry.name, isJmod)
                when (jed.type) {
                    JarEntryType.PACKAGE -> pkgMap.putIfAbsent(jed.pkg, sortedSetOf())
                    else -> {
                        pkgMap.getOrPut(jed.pkg, { sortedSetOf()}).add(jed)
                        /** The [dependencyMap] records this entry by FQCN */
                        symbolRepo.saveJarEntry(jed)
                        dependencyMap.put(jed.fqcn(), dependencyData)
                    }
                }
            }
            /** The [JarData] is a collection of [JarPackageData] for each non-empty package in the jar file */
            return JarData(dependencyData.fileName,
                    pkgMap.asSequence()
                    .map {
                        entry -> JarPackageData(entry.key).apply { entries.addAll(entry.value) }
                    }
                    .filter { pkg ->
                        pkg.entries.size > 0 && !config.excludes.any { exclude -> pkg.name.startsWith(exclude) }
                    }
                    .toSortedSet()
            )
        }
        catch (e: Exception) {
            throw RuntimeException("Unable to get jar entries for ${dependencyData.fileName}", e)
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
    fun getJarEntryContents(entry: JarEntryData) : JarEntryData {
        val dependency = dependencyMap[entry.fqcn()]
        if ( dependency == null ) return entry
        if ( entry.type == JarEntryType.CLASS && !entry.isResolved()) {
            val jarFile = JarFile(dependency.fileName)
            val jarEntry = jarFile.getJarEntry(entry.path)
            val cf = ClassFile(DataInputStream(jarFile.getInputStream(jarEntry)))
            entry.resolve(cf)
        }
        return when (entry.type) {
            JarEntryType.CLASS -> getSourceContent(dependency.sourceFileName, dependency.jmod, entry)
            else -> getContentFromJar(dependency.fileName, entry)
        }
    }

    /**
     * Return the source code content for a class if available or fill in content from [ClassData]
     */
    private fun getSourceContent(srcFile: String?, jmod: String?, entry: JarEntryData) : JarEntryData {
        val sourceEntry = when (srcFile) {
            null -> entry
            else -> getContentFromSourceJar(srcFile, jmod, entry)
        }
        if (sourceEntry.text == null) sourceEntry.text = Json.encodePrettily(entry.classData)
        else sourceEntry.parseData = parseService.parse(JavaParseRequest(file = entry.path, text = sourceEntry.text))
        symbolRepo.saveJarEntry(sourceEntry)
        return sourceEntry
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

    private fun getContentFromSourceJar(fileName: String, jmod: String?, entry: JarEntryData) : JarEntryData {
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
            if (jarEntry == null) {
                return entry // TODO could use getContentFromJar if we had a decompiler
            } else {
                val sourceEntry = pathToJarEntry(entry.pkg, jarEntry.name)
                sourceEntry.text = jarFile.getInputStream(jarEntry).bufferedReader().use {
                    it.readText() + "/*\n${entry.text}\n*/"
                }
                return sourceEntry
            }
        }
        catch (e: Exception) {
            logger.warn("Unable to read content for ${entry.name} from ${fileName}", e)
            return entry
        }
    }

    private fun getContentFromJar(fileName: String, entry: JarEntryData) : JarEntryData {
        try {
            val jarFile = JarFile(fileName)
            val jarEntry = jarFile.getJarEntry(entry.path)
            jarFile.getInputStream(jarEntry).use {
                entry.text = when (entry.type) {
                    JarEntryType.RESOURCE -> getResourceFromJar(it)
                    JarEntryType.CLASS -> getClassFromJar(it)
                    JarEntryType.PACKAGE -> throw IllegalStateException()
                }
            }
            return entry
        }
        catch (e: Exception) {
            throw RuntimeException("Unable to read content for ${entry.name}")
        }
    }

    private fun getResourceFromJar(stream: InputStream) : String {
        return stream.bufferedReader().use {
            it.readText()
        }
    }

    private fun getClassFromJar(stream: InputStream) : String {
        stream.use {  it.readBytes() } // TODO Decompile the byte code some day
        return "No Source Found"
    }

    /**
     * Turn a jar path into a JarEntryData
     */
    private fun pathToJarEntry(packageName: String, path: String) : JarEntryData {
        val parts = path.split("/")
        val fileName = parts[parts.size-1]
        val type = when (fileName.endsWith(".class")) {
            true -> JarEntryType.CLASS
            else -> JarEntryType.RESOURCE
        }
        val name = when (type) {
            JarEntryType.CLASS -> fileName.replace(".class", "")
            else -> fileName
        }
        return JarEntryData(name, type, packageName, path)
    }


}