package net.contrapt.jvmcode.model

class ClasspathData(
    val source: String,
    val name: String,
    val module: String,
    val sourceDirs: MutableSet<String> = mutableSetOf(),
    val classDirs: MutableSet<String> = mutableSetOf()
)
