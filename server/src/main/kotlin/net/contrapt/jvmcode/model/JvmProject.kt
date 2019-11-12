package net.contrapt.jvmcode.model

class JvmProject(
        override val dependencySources: Collection<DependencySource>,
        override val classDirs: Collection<Classpath>,
        val classpath: String = ""
) : JvmProjectData
