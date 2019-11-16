package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.DependencyData
import net.contrapt.jvmcode.model.DependencySourceData
import net.contrapt.jvmcode.model.JvmConfig
import java.io.File

class DependencySource(
        override val source: String,
        override val description: String,
        override val dependencies: Collection<DependencyData>
) : DependencySourceData {

    companion object {
        val SYSTEM = "System"
        val USER = "User"

        /**
         * Create the dependency source from incoming data
         */


        /**
         * Create the JDK dependency source as appropriate for the current JVM version
         */
        fun create(config: JvmConfig, javaHome: String, javaVersion: String): DependencySource {
            return when (javaVersion.substring(0, 3)) {
                "1.8", "1.7", "1.6" -> createPre9(config, javaHome, javaVersion)
                else -> createPost9(config, javaHome, javaVersion)
            }
        }

        /**
         * Create the JDK dependency for pre-version 9 jdks
         */
        private fun createPre9(config: JvmConfig, javaHome: String, javaVersion: String): DependencySource {
            val fileName = javaHome + File.separator + "jre/lib/rt.jar"
            val sourceFileName = config.srcLocation ?: javaHome + File.separator + "src.zip"
            val vendor = System.getProperty("java.vendor")
            val version = javaVersion
            val dependency = Dependency(fileName, sourceFileName, null, "", "", "")
            return DependencySource(SYSTEM, "$vendor JDK $version", mutableSetOf(dependency))
        }

        /**
         * Create the JDK dependency source for jdk 9 and above
         */
        private fun createPost9(config: JvmConfig, javaHome: String, javaVersion: String): DependencySource {
            val dirName = "${javaHome}${File.separator}jmods"
            val sourceFileName = if (config.srcLocation.isNullOrEmpty()) javaHome + File.separator + "lib/src.zip" else config.srcLocation
            val vendor = System.getProperty("java.vendor")
            val version = javaVersion
            val jmods = config.jmodIncludes.map {
                Dependency("${dirName}${File.separator}${it}.jmod", sourceFileName, it, "", "", "")
            }.toMutableSet()
            return DependencySource(SYSTEM, "$vendor JDK $version", jmods)
        }
    }

}
