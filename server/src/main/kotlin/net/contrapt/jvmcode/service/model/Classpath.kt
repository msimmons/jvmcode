package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.ClasspathData

class Classpath(
        override val source: String,
        override val name: String,
        override val module: String,
        override val sourceDirs: Set<String>,
        override val classDirs: Set<String>
) : ClasspathData {
}