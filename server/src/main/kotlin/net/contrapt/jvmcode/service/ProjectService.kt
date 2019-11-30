package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.*
import net.contrapt.jvmcode.service.model.*
import java.io.File
import java.io.InputStream
import java.util.jar.JarEntry
import java.util.jar.JarFile

class ProjectService(var config: JvmConfig, val javaHome : String) {

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

    // Map of entry FQCN to entry data and dependency it belongs to
    private val entryMap = mutableMapOf<String, Pair<JarEntryData, DependencyData>>()

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
     * User adds an output directory
     */
    fun addUserClassDirectory(classDir: String) {
        userPath.classDirs.add(classDir)
    }

    /**
     * User adds a source directory
     */
    fun addUserSourceDirectory(sourceDir: String) {
        userPath.sourceDirs.add(sourceDir)
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
     * in the resulting data structures [JarData] -> [JarEntryData]
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
                        entryMap.put(jed.fqcn(), Pair(jed, dependencyData))
                    }
                }
            }
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
     * Fill in the contents of the given [JarEntryData] -- if a class, try and find the source or TODO decompile
     * If resource, return the contents as is
     */
    fun getJarEntryContents(entry: JarEntryData) : JarEntryData {
        val entryRecord = entryMap[entry.fqcn()]
        if ( entryRecord == null ) return entry
        val dependency = entryRecord.second
        if (dependency.sourceFileName != null && entry.type == JarEntryType.CLASS) return getContentFromSourceJar(dependency.sourceFileName ?: "", dependency.jmod, entry)
        else return getContentFromJar(dependency.fileName, entry)
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
            val entryPath = "${prefix}${entry.pkg.replace(".", File.separator)}${File.separator}${entry.name}"
            var jarEntry : JarEntry? = null
            jarEntry = config.extensions.fold(jarEntry) { curEntry, ext ->
                if (curEntry == null) jarFile.getJarEntry("${entryPath}.${ext}") else curEntry
            }
            if (jarEntry == null) {
                return entry // TODO could use getContentFromJar if we had a decompiler
            } else {
                val sourceEntry = pathToJarEntry(entry.pkg, jarEntry.name)
                sourceEntry.text = jarFile.getInputStream(jarEntry).bufferedReader().use {
                    it.readText()
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
        return JarEntryData(name, type, packageName, "")
    }


}