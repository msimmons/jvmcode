package net.contrapt.jvmcode.model

data class MethodData(
        val name: String,
        val type: String,
        val params: List<FieldData>,
        val isConstructor: Boolean,
        val isMethod: Boolean,
        val isStaticInit: Boolean,
        val extSignature: String?
)