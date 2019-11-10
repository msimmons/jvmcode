package net.contrapt.jvmcode.model

data class JvmConfig(
        val excludes: Collection<String>,
        val extensions: Collection<String>,
        val jmodIncludes: Collection<String> = emptySet(),
        val srcLocation: String? = null
)