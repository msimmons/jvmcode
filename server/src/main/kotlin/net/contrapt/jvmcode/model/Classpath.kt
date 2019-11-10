package net.contrapt.jvmcode.model

class Classpath(
        override val source: String,
        override val name: String,
        override val module: String,
        override val sourceDirs: MutableSet<String> = mutableSetOf(),
        override val classDirs: MutableSet<String> = mutableSetOf()
) : ClasspathData {
}