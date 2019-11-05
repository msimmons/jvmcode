package net.contrapt.jvmcode.model

import java.io.File

class DependencyData (
    val fileName: String,
    val sourceFileName: String?,
    val jmod: String?,
    val groupId: String,
    val artifactId: String,
    val version: String,
    val scopes: MutableSet<String> = mutableSetOf(),
    val modules: MutableSet<String> = mutableSetOf(),
    val transitive: Boolean = false,
    val resolved: Boolean = false
) : Comparable<DependencyData> {

    override fun compareTo(other: DependencyData): Int {
        return fileName.compareTo(other.fileName)
    }

    override fun equals(other: Any?): Boolean {
        return when(other) {
            null -> false
            is DependencyData -> other.fileName == fileName
            else -> false
        }
    }

    override fun hashCode(): Int {
        return fileName.hashCode()
    }

    companion object {

        /**
         * Create a user added dependency
         */
        fun create(jarFile: String) : DependencyData {
            val fileName = jarFile.split(File.separator).last()
            return DependencyData(jarFile, null, null, "", fileName, "")
        }

    }
}