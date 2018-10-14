package net.contrapt.jvmcode.service

import net.contrapt.jvmcode.model.*
import java.io.File
import java.io.InputStream
import java.util.jar.JarEntry
import java.util.jar.JarFile

class DependencyService {

    // All the dependencies being tracked TODO store user added ones persistently?
    private val dependencies = mutableSetOf<DependencyData>()

    // All the output class directories for adding to classpath
    private val classDirs = mutableSetOf<String>()

    // Map of entry name to entry data and dependency it belongs to
    private val entryMap = mutableMapOf<String, Pair<JarEntryData, DependencyData>>()

    private val javaVersion : String
    private val javaHome : String
    private val jdkDependencyData : DependencyData
    private lateinit var config: JvmConfig

    init {
        javaVersion = System.getProperty("java.version")
        javaHome = System.getProperty("java.home").replace("${File.separator}jre", "")
        jdkDependencyData = DependencyData.create(javaHome, javaVersion)
    }

    /**
     * Get dependencies
     */
    fun getDependencies(config: JvmConfig) : Collection<DependencyData> {
        this.config = config
        val jdk = listOf(jdkDependencyData)
        val sorted = dependencies.sorted()
        return jdk + sorted
    }

    /**
     * Add a single JAR file dependency
     */
    fun addDependency(jarFile: String) {
        dependencies.add(DependencyData.create(jarFile))
    }

    /**
     * Add an output directory
     */
    fun addClassDirectory(classDir: String) {
        classDirs.add(classDir)
    }

    /**
     * Add a collection of dependencies
     */
    fun addDependencies(dependencyList: DependencyList) {
        dependencies.addAll(dependencyList.dependencies)
    }

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
                    entryMap.put(entryData.name, Pair(entryData, dependencyData))
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

    fun getJarEntryContents(entry: JarEntryData) : JarEntryData {
        val entryRecord = entryMap[entry.name]
        if ( entryRecord == null ) return entry
        val dependency = entryRecord.second
        if (dependency.sourceFileName != null && entry.type == JarEntryType.CLASS) return getContentFromSourceJar(dependency.sourceFileName, entry)
        else return getContentFromJar(dependency.fileName, entry)
    }

    /**
     * Return the classpath represented by the current dependencies
     */
    fun getClasspath() : String {
        val components = classDirs + dependencies.map{ it.fileName }
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
                return entry
            } else {
                val sourceEntry = pathToJarEntry(entry.pkg, jarEntry.name)
                sourceEntry.text = jarFile.getInputStream(jarEntry).bufferedReader().use {
                    it.readText()
                }
                return sourceEntry
            }
        }
        catch (e: Exception) {
            throw RuntimeException("Unable to read content for ${entry.name}")
        }
    }

    private fun getContentFromJar(fileName: String, entry: JarEntryData) : JarEntryData {
        try {
            val jarFile = JarFile(fileName)
            jarFile.entries().toList().forEach { jarEntry ->
                if ( !jarEntry.isDirectory && pathToJarEntry(entry.pkg, jarEntry.name).name.equals(entry.name)) {
                    jarFile.getInputStream(jarEntry).use {
                        entry.text = when (entry.type) {
                            JarEntryType.RESOURCE -> getResourceFromJar(it)
                            JarEntryType.CLASS -> getClassFromJar(it)
                        }
                    }
                    return entry
                }
            }
            entry.text = "Not Found"
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
        stream.use {  it.readBytes() } // Decompile the byte code some day
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