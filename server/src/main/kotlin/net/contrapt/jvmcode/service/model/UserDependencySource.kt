package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.DependencyData
import net.contrapt.jvmcode.model.DependencySourceData

class UserDependencySource(
        override val dependencies: MutableCollection<DependencyData> = mutableSetOf()
) : DependencySourceData {
    override val source: String = "USER"
    override val description: String = "User entered"
}
