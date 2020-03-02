package net.contrapt.jvmcode.model

import com.fasterxml.jackson.annotation.JsonProperty

data class MethodData(
        val name: String,
        val type: String,
        val params: List<FieldData>,
        val locals: List<FieldData>,
        val annotations: List<AnnotationData>,
        @get:JsonProperty(value = "isConstructor")
        val isConstructor: Boolean,
        @get:JsonProperty(value = "isMethod")
        val isMethod: Boolean,
        @get:JsonProperty(value = "isStaticInit")
        val isStaticInit: Boolean,
        @get:JsonProperty(value = "isMain")
        val isMain: Boolean,
        val extSignature: String?
)