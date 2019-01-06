package net.contrapt.jvmcode.model

class JvmProject(
        val dependencySources: Collection<DependencySource>,
        val classDirs: Collection<ClasspathData>,
        val classpath: String
)
