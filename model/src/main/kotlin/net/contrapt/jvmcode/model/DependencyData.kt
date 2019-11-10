package net.contrapt.jvmcode.model

/**
 * Dependency data provided by a dependency source
 *
 * @property fileName The file name, typically a JAR file containing the dependency
 * @property sourceFileName An optional file containing the source code associated with the dependency
 * @property jmod The optional name of the JDK module, aka jmod (>= JDK9)
 * @property groupId The maven style group id
 * @property artifactId The maven style artifact id
 * @property version The maven style version
 * @property scopes Which scopes this is relevant for, eg compile, test
 * @property modules Which modules this is relevant to
 * @property transitive is this a transitive dependency?
 * @property resolved Has this dependency been resolved
 *
 */
interface DependencyData : Comparable<DependencyData> {
    val fileName: String
    var sourceFileName: String?
    val jmod: String?
    val groupId: String
    val artifactId: String
    val version: String
    val scopes: MutableSet<String>
    val modules: MutableSet<String>
    val transitive: Boolean
    var resolved: Boolean

    override fun compareTo(other: DependencyData): Int {
        return fileName.compareTo(other.fileName)
    }

}