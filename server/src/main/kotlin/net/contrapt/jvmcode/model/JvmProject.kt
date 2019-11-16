package net.contrapt.jvmcode.model

class JvmProject(
        val dependencySources: Collection<DependencySourceData>,
        val classDirs: Collection<ClasspathData>,
        val classpath: String = ""
)
