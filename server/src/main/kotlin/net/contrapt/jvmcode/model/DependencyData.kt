package net.contrapt.jvmcode.model

import java.io.File

data class DependencyData (
    var source: String = "",
    var fileName: String = "",
    var sourceFileName: String? = "",
    var docFilename: String? = "",
    val scopes: MutableSet<String> = mutableSetOf(),
    val modules: MutableSet<String> = mutableSetOf(),
    var groupId: String = "",
    var artifactId: String = "",
    var version: String = ""
) : Comparable<DependencyData> {

    constructor(javaHome: String, javaVersion: String) : this() {
        source = "System"
        fileName = javaHome + File.separator + "jre/lib/rt.jar"
        sourceFileName = javaHome + File.separator + "src.zip"
        groupId = System.getProperty("java.vendor")
        artifactId = "JDK"
        version = javaVersion
    }

    override fun compareTo(other: DependencyData): Int {
        return "${groupId}:${artifactId}:${version}".compareTo("${other.groupId}:${other.artifactId}:${other.version}")
    }

    private fun extractArtifactInfo(path: String) : Triple<String, String, String> {
        val parts = path.split("/")
        val version = parts[parts.size-3]
        val artifact = parts[parts.size-4]
        val group = parts[parts.size-5]
        return Triple(group, artifact, version)
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
}