package net.contrapt.jvmcode.model

import java.io.File

class DependencyData (
    val source: String,
    val fileName: String,
    val sourceFileName: String?,
    var groupId: String,
    var artifactId: String,
    var version: String,
    val scopes: MutableSet<String> = mutableSetOf(),
    val modules: MutableSet<String> = mutableSetOf()
) : Comparable<DependencyData> {

    override fun compareTo(other: DependencyData): Int {
        return "${groupId}:${artifactId}:${version}".compareTo("${other.groupId}:${other.artifactId}:${other.version}")
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
         * Create the JDK dependency
         */
        fun create(javaHome: String, javaVersion: String) : DependencyData {
            val fileName = javaHome + File.separator + "jre/lib/rt.jar"
            val sourceFileName = javaHome + File.separator + "src.zip"
            val groupId = System.getProperty("java.vendor")
            val artifactId = "JDK"
            val version = javaVersion
            return DependencyData("System", fileName, sourceFileName, groupId, artifactId, version)
        }

        /**
         * Create a user added dependency
         */
        fun create(jarFile: String) : DependencyData {
            val fileName = jarFile.split(File.separator).last()
            return DependencyData("User", jarFile, null, "", fileName, "")
        }

    }
}