package net.contrapt.jvmcode.model

import java.io.File

/**
 * A source of dependencies such as JDK, user, gradle
 */
data class DependencySource(
    val name: String,
    val description: String,
    val dependencies: MutableCollection<DependencyData> = mutableSetOf()
) {

    companion object {

        val SYSTEM = "System"
        val USER = "User"

        /**
         * Create the JDK dependency source
         */
        fun create(javaHome: String, javaVersion: String) : DependencySource {
            val fileName = javaHome + File.separator + "jre/lib/rt.jar"
            val sourceFileName = javaHome + File.separator + "src.zip"
            val vendor = System.getProperty("java.vendor")
            val version = javaVersion
            val dependency = DependencyData(fileName, sourceFileName, "", "", "")
            return DependencySource(SYSTEM, "$vendor JDK $version").apply {
                dependencies.add(dependency)
            }
        }

    }
}
