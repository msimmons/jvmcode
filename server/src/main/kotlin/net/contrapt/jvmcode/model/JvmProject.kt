package net.contrapt.jvmcode.model

class JvmProject(
        val dependencySources: Collection<DependencySourceData>,
        val paths: Collection<PathData>,
        val classdata: Collection<ClassData>,
        val classpath: String = ""
)
