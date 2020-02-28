package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.PathData
import java.util.*

data class UserPath(
    override val sourceDir: String,
    override val classDir: String,
    override val name: String
) : PathData {
    override val source: String = "USER"
    override val module: String = "All"
}