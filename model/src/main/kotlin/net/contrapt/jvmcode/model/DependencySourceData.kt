package net.contrapt.jvmcode.model

/**
 * A source of dependencies such as JDK, user, gradle
 *
 * @property name The name of the source
 * @property description A description
 * @property dependencies A collection of dependencies declared by this source
 */
interface DependencySourceData {
    val name: String
    val description: String
    val dependencies: Collection<DependencyData>
}