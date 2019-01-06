package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.*
import java.io.File
import java.io.InputStream
import java.util.jar.JarEntry
import java.util.jar.JarFile

class ProjectService(var config: JvmConfig) {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val jdkSource : DependencySource
    //TODO store user added ones persistently?
    private val userSource: DependencySource

    // All the external dependencies being tracked
    private val externalSource = mutableMapOf<String, DependencySource>()

    // Classpath data added by other extensions or the user
    private val classDirs = mutableSetOf<ClasspathData>()

    // Map of entry FQCN to entry data and dependency it belongs to
    private val entryMap = mutableMapOf<String, Pair<JarEntryData, DependencyData>>()

    private val javaVersion : String
    private val javaHome : String

    init {
        javaVersion = System.getProperty("java.version")
        javaHome = System.getProperty("java.home").replace("${File.separator}jre", "")
        jdkSource =  DependencySource.create(javaHome, javaVersion)
        userSource = DependencySource(DependencySource.USER, "User")
    }

    /**
     * Get a JvmProject representation of current dependencies and classpath
     */
    fun getJvmProject(config: JvmConfig = this.config) : JvmProject {
        this.config = config
        val sorted = listOf(jdkSource, userSource) + externalSource.values
        return JvmProject(sorted, classDirs, getClasspath())
    }

    /**
     * User adds a single JAR file dependency
     * TODO allow a source file?
     */
    fun addDependency(jarFile: String) {
        userSource.dependencies.add(DependencyData.create(jarFile))
    }

    /**
     * User adds an output directory
     */
    fun addClassDirectory(classDir: String) {
        val cp = classDirs.firstOrNull { it.source == DependencySource.USER }
        if (cp != null) {
            cp.classDirs.add(classDir)
        } else {
            classDirs.add(ClasspathData(DependencySource.USER, "user", "user").apply {
                classDirs.add(classDir)
            })
        }
    }

    /**
     * Process update of project dependency information from an external source
     */
    fun updateProject(source: String, jvmProject: JvmProject) {
        externalSource.remove(source)
        classDirs.removeIf { it.source == source }
        externalSource[source] = DependencySource(source, source).apply {
            dependencies.addAll(jvmProject.dependencySources.flatMap { if (it.name == source) it.dependencies else mutableListOf() })
        }
        classDirs.addAll(jvmProject.classDirs)
    }

    /**
     * For the given dependency, find all the entries contained in the jar file and organize them by package
     * in the resulting data structures [JarData] -> [JarEntryData]
     */
    fun getJarData(dependencyData: DependencyData) : JarData {
        val pkgMap = mutableMapOf<String, MutableSet<JarEntryData>>()
        try {
            val jarFile = JarFile(dependencyData.fileName)
            jarFile.entries().toList().forEach { entry ->
                if ( entry.isDirectory ) pkgMap.put(pathToPackage(entry.name), mutableSetOf())
                else if (entry.name.contains("$")) { }
                else {
                    val packageName = pathToPackage(entry.name)
                    val entryData = pathToJarEntry(packageName, entry.name)
                    pkgMap.getOrPut(packageName, { sortedSetOf() }).add(entryData)
                    entryMap.put(entryData.fqcn(), Pair(entryData, dependencyData))
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
        if (dependency.sourceFileName != null && entry.type == JarEntryType.CLASS) return getContentFromSourceJar(dependency.sourceFileName, entry)
        else return getContentFromJar(dependency.fileName, entry)
    }

    /**
     * Return the full classpath implied by the current dependencies (minus jdk dependencies)
     */
    fun getClasspath() : String {
        val components = classDirs.flatMap { it.classDirs } +
                userSource.dependencies.map { it.fileName } +
                externalSource.values.asSequence().flatMap { it.dependencies.asSequence().map { it.fileName } }
        return components.joinToString(File.pathSeparator) { it }
    }

    private fun getContentFromSourceJar(fileName: String, entry: JarEntryData) : JarEntryData {
        try {
            val jarFile = JarFile(fileName)
            val entryPath = "${entry.pkg.replace(".", File.separator)}${File.separator}${entry.name}"
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
            val ext = if (entry.type == JarEntryType.CLASS) ".class" else ""
            val entryPath = "${entry.pkg.replace(".", File.separator)}${File.separator}${entry.name}${ext}"
            val jarEntry = jarFile.getJarEntry(entryPath)
            jarFile.getInputStream(jarEntry).use {
                entry.text = when (entry.type) {
                    JarEntryType.RESOURCE -> getResourceFromJar(it)
                    JarEntryType.CLASS -> getClassFromJar(it)
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
        return JarEntryData(name, type, packageName)
    }

    /**
     * Turn the given jar entry path into a package name
     */
    private fun pathToPackage(path: String) : String {
        val parts = path.split("/")
        return parts.take(parts.size-1).joinToString(".") { it }
    }

}