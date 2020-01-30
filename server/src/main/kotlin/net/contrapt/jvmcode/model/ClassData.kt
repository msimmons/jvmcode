package net.contrapt.jvmcode.model

import com.fasterxml.jackson.annotation.JsonProperty
import javassist.bytecode.*

/**
 * All the useful data extracted from a .class file
 */
class ClassData(
        val name: String,
        val srcFile: String?,
        val implements: Collection<String>,
        val extends: String?,
        val references: Collection<String>,
        val annotations: Collection<String>,
        val fields: Collection<FieldData>,
        val methods: Collection<MethodData>,
        @get:JsonProperty(value = "isAbstract")
        val isAbstract: Boolean,
        @get:JsonProperty(value = "isFinal")
        val isFinal: Boolean,
        @get:JsonProperty(value = "isInterface")
        val isInterface: Boolean
) {
    var path: String? = null
    var lastModified: Long = 0

    companion object {

        fun create(classFile: ClassFile) : ClassData {
            val implements = classFile.interfaces.map { it }
            val extends = classFile.superclass
            val references = classFile.constPool.classNames
            val name = classFile.constPool.className
            val srcFile = classFile.sourceFile
            val annotations = getAnnotations(classFile.attributes)
            val fields = getFields(classFile.fields)
            val methods = getMethods(classFile.methods)
            // TODO do we need to consider InnerClassesAttribute
            return ClassData(name, srcFile, implements, extends, references, annotations, fields, methods, classFile.isAbstract, classFile.isFinal, classFile.isInterface)
        }

        private fun getAnnotations(atts: List<AttributeInfo>) : List<String> {
            val ai = atts.filter { it is AnnotationsAttribute }.firstOrNull()
            return when (ai) {
                is AnnotationsAttribute -> ai.annotations.map { it.typeName }
                else -> emptyList()
            }
        }

        private fun getSignature(attrs: List<AttributeInfo>) : String? {
            val ai = attrs.filter { it is SignatureAttribute }.firstOrNull()
            return when (ai) {
                is SignatureAttribute -> ai.signature
                else -> null
            }
        }

        private fun getFields(fields: List<FieldInfo>) : List<FieldData> {
            return fields.map {
                val signature = getSignature(it.attributes)
                val type = if (signature != null) signature else it.descriptor
                FieldData(it.name, type)
            }
        }

        private fun getMethods(methods: List<MethodInfo>) : List<MethodData> {
            return methods.map {
                val signature = getSignature(it.attributes)
                val type = if (signature != null) signature else it.descriptor
                val params = getParameterInfo(it.codeAttribute)
                val extension = getExtensionSignature(it.name, params)
                val isMain = it.name == "main" && (it.accessFlags and AccessFlag.STATIC) != 0
                MethodData(it.name, type, params, it.isConstructor, it.isMethod, it.isStaticInitializer, isMain, extension)
            }
        }

        private fun getExtensionSignature(name: String, params: Collection<FieldData>) : String? {
            val theThis = params.find { it.name == "\$this\$$name" }
            return theThis?.type
        }

        private fun getParameterInfo(code: CodeAttribute?) : List<FieldData> {
            if (code == null) return listOf()
            val ai = code.attributes.filter { it is LocalVariableAttribute }.firstOrNull()
            return when (ai) {
                is LocalVariableAttribute -> getLocalVariableData(ai)
                else -> emptyList()
            }
        }

        private fun getLocalVariableData(attr: LocalVariableAttribute) : List<FieldData> {
            return IntRange(0, attr.tableLength()-1)
                    .filter { attr.startPc(it) == 0 }
                    .map {
                        val descriptor = attr.descriptor(it)
                        val signature = attr.signature(it)
                        val type = (if (signature != null) signature else descriptor)
                        FieldData(attr.variableName(it), type)
                    }
        }
    }

}