package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.PathData

class Path(
        override val source: String,
        override val name: String,
        override val module: String,
        override val sourceDir: String,
        override val classDir: String
) : PathData {
}