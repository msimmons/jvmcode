package net.contrapt.jvmcode.model

/**
 * Represents a set of source and class directories, usually provided by a tool like gradle, could also be
 * provided by the user
 * @property source Who is supplying this data
 * @property name The name of this set of dirs, eg main, test
 * @property module The module that this applies to (in multi module project)
 * @property sourceDirs The set of source directories that this describes
 * @property classDirs The set of associated class directories
 */
interface ClasspathData {
    val source: String
    val name: String
    val module: String
    val sourceDirs: Set<String>
    val classDirs: Set<String>
}
