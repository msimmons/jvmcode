package net.contrapt.jvmcode.model

/**
 * Represents a set of source and class directories, usually provided by a tool like gradle, could also be
 * provided by the user
 */
data class JavaCompileRequest(
    override val files: Collection<String>,
    override val name: String,
    override val outputDir: String,
    override val classpath: String,
    override val sourcepath: String
) : CompileRequest
