package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.PathData

class UserPath(
        override val sourceDirs: MutableSet<String> = mutableSetOf(),
        override val classDirs: MutableSet<String> = mutableSetOf()
) : PathData {
    override val source: String = "USER"
    override val name: String = "User"
    override val module: String = "All"
}