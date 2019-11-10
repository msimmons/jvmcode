package net.contrapt.jvmcode.model

data class JvmProject(
        override val dependencySources: Collection<DependencySourceData>,
        override val classDirs: Collection<ClasspathData>,
        override val classpath: String
) : JvmProjectData
