package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.ClasspathData

class UserClasspath(
        override val sourceDirs: MutableSet<String> = mutableSetOf(),
        override val classDirs: MutableSet<String> = mutableSetOf()
) : ClasspathData {
    override val source: String = "USER"
    override val name: String = "USER"
    override val module: String = "USER"
}