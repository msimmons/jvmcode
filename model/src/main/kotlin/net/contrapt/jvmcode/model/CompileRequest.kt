package net.contrapt.jvmcode.model

/**
 * Represents a set of source and class directories, usually provided by a tool like gradle, could also be
 * provided by the user
 * @property files List of files that should be compiled
 * @property name A name for this compile request
 * @property outputDir where to put the resulting classfiles
 * @property classpath The classpath to use for compilation
 * @property sourcepath The sourcepath to use for compilation (?)
 */
interface CompileRequest {
    val files: Collection<String>
    val name: String
    val outputDir: String
    val classpath: String
    val sourcepath: String
}