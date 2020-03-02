package net.contrapt.jvmcode.model

data class AnnotationData(
    val name: String,
    val members: Collection<Pair<String, String>>
)