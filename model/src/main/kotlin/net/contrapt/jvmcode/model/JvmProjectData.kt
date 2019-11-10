package net.contrapt.jvmcode.model

/**
 * Represents data about a JVM project as discovered by a project tool such as Maven, Gradle, etc.
 *
 * @property dependencySources Collection of dependency sources such as JAR files
 * @property classDirs Collection of class directories to which compile output is being written
 * @property classpath The classpath for this project
 */
interface JvmProjectData {
    val dependencySources: Collection<DependencySourceData>
    val classDirs: Collection<ClasspathData>
    val classpath: String
}
