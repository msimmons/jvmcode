package net.contrapt.jvmcode.model

/**
 * Describes a source directory and its associated output directory.  Can be provided by a build tool such as Gradle
 * or directory by the user
 * @property source Who is supplying this data
 * @property name The name of this set of dirs, eg main, test
 * @property module The module that this applies to (in multi module project)
 * @property sourceDir The source directory that this describes
 * @property classDir The associated output directory
 */
interface PathData {
    val source: String
    val name: String
    val module: String
    val sourceDir: String
    val classDir: String
}
