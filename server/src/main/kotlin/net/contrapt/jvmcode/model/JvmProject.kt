package net.contrapt.jvmcode.model

class JvmProject(
        val dependencySources: Collection<DependencySourceData>,
        val paths: Collection<PathData>,
        val classpath: String = ""
)
