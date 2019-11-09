package net.contrapt.jvmcode.model

/**
 * Represents a set of source and class directories, usually provided by a tool like gradle, could also be
 * provided by the user
 */
data class ClasspathData(
    val source: String,
    val name: String,
    val module: String,
    val sourceDirs: MutableSet<String> = mutableSetOf(),
    val classDirs: MutableSet<String> = mutableSetOf()
)
