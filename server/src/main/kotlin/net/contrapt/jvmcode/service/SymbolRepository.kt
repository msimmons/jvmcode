package net.contrapt.jvmcode.service

import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.ClassData
import net.contrapt.jvmcode.model.JarEntryData
import net.contrapt.jvmcode.model.ParseResult

/**
 * Cache various relationships between symbols, files and class data and parse results
 */
class SymbolRepository {

    val logger = LoggerFactory.getLogger(javaClass)

    class DataHolder(
        var parseData: ParseResult?,
        var classData: ClassData?
    )

    private val jarEntryByFqcn = mutableMapOf<String, JarEntryData>()
    private val dataByFqcn = mutableMapOf<String, DataHolder>()
    private val jarEntryByPath = mutableMapOf<String, JarEntryData>()
    private val dataByPath = mutableMapOf<String, DataHolder>()

    fun getJarEntryByFile(file: String) : JarEntryData? {
        val key = if (!file.startsWith("/")) "/$file" else file
        logger.debug("Getting jar entry for file $key")
        return jarEntryByPath.getOrDefault(key, null)
    }

    fun getJarEntryByFqn(fqn: String) : JarEntryData? {
        logger.info("Getting jar entry for fqn $fqn")
        return jarEntryByFqcn.getOrDefault(fqn, null)
    }

    fun saveJarEntry(jarEntry: JarEntryData) {
        val fileKey = if (!jarEntry.path.startsWith("/")) "/${jarEntry.path}" else jarEntry.path
        logger.debug("Storing jar entry for $fileKey (${jarEntry.fqcn()})")
        jarEntryByPath.put(fileKey, jarEntry)
        jarEntryByFqcn.put(jarEntry.fqcn(), jarEntry)
    }

}