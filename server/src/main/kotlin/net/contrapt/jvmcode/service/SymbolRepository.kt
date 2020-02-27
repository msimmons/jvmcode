package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.ClassData
import net.contrapt.jvmcode.model.ClassEntryData
import net.contrapt.jvmcode.model.JarEntryData
import net.contrapt.jvmcode.model.ParseResult
import java.util.concurrent.locks.ReentrantLock
import kotlin.concurrent.withLock

/**
 * Cache various relationships between symbols, files, class data and parse results
 *
 * jarEntry, classData by simpleName (symbol resolution)
 */
class SymbolRepository {

    val logger = LoggerFactory.getLogger(javaClass)

    private val jarEntryByFqcn = mutableMapOf<String, ClassEntryData>()
    private val jarEntriesByName = mutableMapOf<String, MutableList<ClassEntryData>>()
    private val jarEntryByPath = mutableMapOf<String, ClassEntryData>()

    private val classDataLock = ReentrantLock()
    private val classDataByPath = mutableMapOf<String, ClassData>()
    private val classDataBySource = mutableMapOf<String, ClassData>()
    private val dependentClassData = mutableMapOf<String, MutableSet<ClassData>>() // classData name -> dependent names

    fun getJarEntryByFile(file: String) : ClassEntryData? {
        val key = if (!file.startsWith("/")) "/$file" else file
        logger.debug("Getting jar entry for file $key")
        return jarEntryByPath.getOrDefault(key, null)
    }

    fun getJarEntryByFqn(fqn: String) : ClassEntryData? {
        logger.debug("Getting jar entry for fqn $fqn")
        return jarEntryByFqcn.getOrDefault(fqn, null)
    }

    fun getJarEntriesByName(name: String) : List<ClassEntryData> {
        val found = jarEntriesByName.get(name)?.toList() ?: listOf()
        logger.debug("Found ${found} for $name")
        return found
    }

    fun saveJarEntry(jarEntry: ClassEntryData) {
        val fileKey = if (!jarEntry.path.startsWith("/")) "/${jarEntry.path}" else jarEntry.path
        logger.debug("Storing jar entry for $fileKey (${jarEntry.fqcn})")
        jarEntryByPath.put(fileKey, jarEntry)
        jarEntryByFqcn.put(jarEntry.fqcn, jarEntry)
        val entries = jarEntriesByName.getOrPut(jarEntry.name, {mutableListOf()})
        entries.add(jarEntry)
    }

    /**
     * Add a [ClassData] to repository and all appropriate indices
     */
    fun addClassData(classData: ClassData) {
        classDataLock.withLock {
            classDataByPath.put(classData.path, classData)
            if (classData.srcFile != null) classDataBySource.put(classData.srcFile!!, classData)
            classData.references.forEach {
                if (it != classData.name) dependentClassData.getOrPut(it, {mutableSetOf()}).add(classData)
            }
        }
    }

    fun findClassDataByPath(path: String) : ClassData? {
        return classDataByPath[path]
    }

    fun findDependentsBySource(path: String) : Collection<String> {
        val data = classDataBySource[path]
        if (data == null) return listOf()
        val dependents = dependentClassData[data.name]
        if (dependents == null) return listOf()
        return dependents.mapNotNull { it.srcFile }
    }

}