package net.contrapt.jvmcode.service

import net.contrapt.jvmcode.model.*
import java.io.File
import java.io.InputStream
import java.util.jar.JarFile

class DependencyService {
    private val dependencies = mutableSetOf<DependencyData>()
    private val entryToDependencyMap = mutableMapOf<String, DependencyData>()
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

    fun getJarData(dependencyData: DependencyData) : JarData {
        val pkgMap = mutableMapOf<String, MutableSet<JarEntryData>>()
        try {
            val jarFile = JarFile(dependencyData.fileName)
            jarFile.entries().toList().forEach { entry ->
                if ( entry.isDirectory ) pkgMap.put(pathToPackage(entry.name), mutableSetOf())
                else {
                    val packageName = pathToPackage(entry.name)
                    val entryData = pathToJarEntry(entry.name)
                    pkgMap.getOrPut(packageName, { sortedSetOf() }).add(entryData)
                    entryToDependencyMap.put(entryData.name, dependencyData)
                }
            }
            return JarData(pkgMap
                    .map { entry -> JarPackageData(entry.key).apply { entries.addAll(entry.value) } }
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
        val dependency = entryToDependencyMap[entry.name]
        if ( dependency == null ) return entry
        else if ( dependency.sourceFileName != null && entry.type.equals("class")) return getContentFromSourceJar(dependency.sourceFileName as String, entry)
        else return getContentFromJar(dependency.fileName, entry)
    }

    private fun getContentFromSourceJar(fileName: String, entry: JarEntryData) : JarEntryData {
        try {
            val jarFile = JarFile(fileName)
            jarFile.entries().toList().forEach { jarEntry ->
                if ( jarEntry.isDirectory ) return@forEach
                val className = entry.name
                val sourceEntry = pathToJarEntry(jarEntry.name)
                if ( className.split(".", "$")[0] == sourceEntry.name.split(".")[0] ) {
                    sourceEntry.text = jarFile.getInputStream(jarEntry).bufferedReader().use {
                        it.readText()
                    }
                    return sourceEntry
                }
            }
            return entry
        }
        catch (e: Exception) {
            throw RuntimeException("Unable to read content for ${entry.name}")
        }
    }

    private fun getContentFromJar(fileName: String, entry: JarEntryData) : JarEntryData {
        try {
            val jarFile = JarFile(fileName)
            jarFile.entries().toList().forEach { jarEntry ->
                if ( !jarEntry.isDirectory && pathToJarEntry(jarEntry.name).name.equals(entry.name)) {
                    jarFile.getInputStream(jarEntry).use {
                        entry.text = when (entry.type) {
                            "resource" -> getResourceFromJar(it)
                            "class" -> getClassFromJar(it)
                            else -> throw IllegalStateException("Don't know about entry type ${entry.type}")
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
    private fun pathToJarEntry(path: String) : JarEntryData {
        val parts = path.split("/")
        val name = parts[parts.size-1]
        val type = if ( name.endsWith(".class") ) "class" else "resource"
        return JarEntryData(name, type)
    }

    /**
     * Turn the given jar entry path into a package name
     */
    private fun pathToPackage(path: String) : String {
        val parts = path.split("/")
        return parts.take(parts.size-1).joinToString(".") { it }
    }

}