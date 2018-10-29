package net.contrapt.jvmcode.model

class JvmProject(
        val dependencies: Collection<DependencyData>,
        val classpath: Collection<ClasspathData>
)
