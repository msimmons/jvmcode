package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.DependencyData
import java.io.File

class Dependency(
        override val fileName: String,
        override val sourceFileName: String?,
        override val jmod: String?,
        override val groupId: String,
        override val artifactId: String,
        override val version: String,
        override val scopes: MutableSet<String> = mutableSetOf(),
        override val modules: MutableSet<String> = mutableSetOf(),
        override val transitive: Boolean = false,
        override val resolved: Boolean = false
) : DependencyData, Comparable<DependencyData>  {

    override fun equals(other: Any?): Boolean {
        return when (other) {
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
        fun create(jarFile: String, srcFile: String?): Dependency {
            val fileName = jarFile.split(File.separator).last()
            return Dependency(jarFile, srcFile, null, "", fileName, "")
        }

    }
}