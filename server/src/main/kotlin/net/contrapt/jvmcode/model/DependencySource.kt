package net.contrapt.jvmcode.model

import java.io.File

class DependencySource(
        override val name: String,
        override val description: String,
        override val dependencies: MutableCollection<Dependency> = mutableSetOf()
) : DependencySourceData {

    companion object {
        val SYSTEM = "System"
        val USER = "User"

        /**
         * Create the JDK dependency source as appropriate for the current JVM version
         */
        fun create(config: JvmConfig, javaHome: String, javaVersion: String): DependencySourceData {
            return when (javaVersion.substring(0, 3)) {
                "1.8", "1.7", "1.6" -> createPre9(config, javaHome, javaVersion)
                else -> createPost9(config, javaHome, javaVersion)
            }
        }

        /**
         * Create the JDK dependency for pre-version 9 jdks
         */
        private fun createPre9(config: JvmConfig, javaHome: String, javaVersion: String): DependencySourceData {
            val fileName = javaHome + File.separator + "jre/lib/rt.jar"
            val sourceFileName = config.srcLocation ?: javaHome + File.separator + "src.zip"
            val vendor = System.getProperty("java.vendor")
            val version = javaVersion
            val dependency = Dependency(fileName, sourceFileName, null, "", "", "")
            return DependencySource(SYSTEM, "$vendor JDK $version").apply {
                dependencies.add(dependency)
            }
        }

        /**
         * Create the JDK dependency source for jdk 9 and above
         */
        private fun createPost9(config: JvmConfig, javaHome: String, javaVersion: String): DependencySourceData {
            val dirName = "${javaHome}${File.separator}jmods"
            val sourceFileName = if (config.srcLocation.isNullOrEmpty()) javaHome + File.separator + "lib/src.zip" else config.srcLocation
            val vendor = System.getProperty("java.vendor")
            val version = javaVersion
            val jmods = config.jmodIncludes.map {
                Dependency("${dirName}${File.separator}${it}.jmod", sourceFileName, it, "", "", "")
            }
            return DependencySource(SYSTEM, "$vendor JDK $version").apply {
                dependencies.addAll(jmods)
            }
        }
    }

}
