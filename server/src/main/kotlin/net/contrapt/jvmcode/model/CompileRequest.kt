package net.contrapt.jvmcode.model

/**
 * Represents a set of source and class directories, usually provided by a tool like gradle, could also be
 * provided by the user
 */
data class CompileRequest(
    val files: Collection<String>,
    val name: String,
    val outputDir: String,
    val classpath: String,
    val sourcepath: String
)
