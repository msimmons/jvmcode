package net.contrapt.jvmcode.model

data class JvmProject(
        override val dependencySources: Collection<DependencySource>,
        override val classDirs: Collection<Classpath>,
        override val classpath: String
) : JvmProjectData
