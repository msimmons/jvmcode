package net.contrapt.jvmcode.model

/**
 * A source of dependencies such as JDK, user, gradle
 *
 * @property source The source of the source
 * @property description A description
 * @property dependencies A collection of dependencies declared by this source
 */
interface DependencySourceData {
    val source: String
    val description: String
    val dependencies: Collection<DependencyData>
}