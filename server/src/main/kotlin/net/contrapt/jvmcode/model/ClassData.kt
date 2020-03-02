package net.contrapt.jvmcode.model

import com.fasterxml.jackson.annotation.JsonProperty
import javassist.bytecode.*
import javassist.bytecode.annotation.AnnotationMemberValue
import javassist.bytecode.annotation.ArrayMemberValue
import javassist.bytecode.annotation.ByteMemberValue

/**
 * All the useful data extracted from a .class file
 */
class ClassData(
        val name: String,
        val path: String,
        var lastModified: Long,
        var srcFile: String?,
        val implements: Collection<String>,
        val extends: String?,
        val inners: Collection<String>,
        val references: Collection<String>,
        val annotations: Collection<AnnotationData>,
        val fields: Collection<FieldData>,
        val methods: Collection<MethodData>,
        @get:JsonProperty(value = "isAbstract")
        val isAbstract: Boolean,
        @get:JsonProperty(value = "isFinal")
        val isFinal: Boolean,
        @get:JsonProperty(value = "isInterface")
        val isInterface: Boolean
) : Comparable<ClassData> {

    companion object {

        fun create(classFile: ClassFile, path: String, lastModified: Long) : ClassData {
            val implements = classFile.interfaces.map { it }
            val extends = classFile.superclass
            val references = classFile.constPool.classNames.map { it.replace('/', '.')}
            val name = classFile.constPool.className
            val srcFile = classFile.sourceFile
            val inners = getInners(classFile.attributes)
            classFile.attributes.forEach {
                when (it) {
                    is SourceFileAttribute -> println(it.fileName)
                    is InnerClassesAttribute -> {

                        (0..it.tableLength()-1).forEach { i -> println(it.innerClass(i)) }
                    }
                    else -> println((it as AttributeInfo).name)
                }
            }
            val annotations = getAnnotations(classFile.attributes)
            val fields = getFields(classFile.fields)
            val methods = getMethods(classFile.methods)
            println("static init ${classFile.staticInitializer}")
            // TODO do we need to consider InnerClassesAttribute
            return ClassData(name, path, lastModified, srcFile, implements, extends, inners, references, annotations, fields, methods, classFile.isAbstract, classFile.isFinal, classFile.isInterface)
        }

        private fun getInners(atts: List<AttributeInfo>) : List<String> {
            val ai = atts.filter { it is InnerClassesAttribute }.firstOrNull()
            return when (ai) {
                is InnerClassesAttribute -> {
                    (0..ai.tableLength()-1).map {i ->
                        ai.innerClass(i)
                    }
                }
                else -> listOf()
            }
        }

        private fun getAnnotations(atts: List<AttributeInfo>) : List<AnnotationData> {
            val ai = atts.filter { it is AnnotationsAttribute }.firstOrNull()
            return when (ai) {
                is AnnotationsAttribute -> ai.annotations.map { ann ->
                    getAnnotationMember(ann)
                }
                else -> emptyList()
            }
        }

        private fun getAnnotationMember(ann: javassist.bytecode.annotation.Annotation) : AnnotationData {
            val members = ann.memberNames?.map { n ->
                val value = when (val v = ann.getMemberValue(n)) {
                    is AnnotationMemberValue -> {v.toString()}
                    is ArrayMemberValue -> {v.value.size.toString()}
                    is ByteMemberValue -> {v.toString()}
                    else -> v.toString()
                }
                n to value
            } ?: listOf()
            return AnnotationData(ann.typeName, members)
        }

        /*
        FloatMemberValue (javassist.bytecode.annotation)
AnnotationMemberValue (javassist.bytecode.annotation)
ArrayMemberValue (javassist.bytecode.annotation)
ShortMemberValue (javassist.bytecode.annotation)
DoubleMemberValue (javassist.bytecode.annotation)
StringMemberValue (javassist.bytecode.annotation)
IntegerMemberValue (javassist.bytecode.annotation)
LongMemberValue (javassist.bytecode.annotation)
ClassMemberValue (javassist.bytecode.annotation)
EnumMemberValue (javassist.bytecode.annotation)
CharMemberValue (javassist.bytecode.annotation)
ByteMemberValue (javassist.bytecode.annotation)
BooleanMemberValue (javassist.bytecode.annotation)

         */
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
                FieldData(it.name, type, 0)
            }
        }

        private fun getMethods(methods: List<MethodInfo>) : List<MethodData> {
            return methods.map {
                val signature = getSignature(it.attributes)
                val type = if (signature != null) signature else it.descriptor
                val params = getParameterInfo(it.codeAttribute)
                val locals = getLocalInfo(it.codeAttribute)
                val extension = getExtensionSignature(it.name, params)
                val isMain = it.name == "main" && (it.accessFlags and AccessFlag.STATIC) != 0
                val annotations = getAnnotations(it.attributes)
                MethodData(it.name, type, params, locals, annotations, it.isConstructor, it.isMethod, it.isStaticInitializer, isMain, extension)
            }
        }

        private fun getExtensionSignature(name: String, params: Collection<FieldData>) : String? {
            val theThis = params.find { it.name == "\$this\$$name" }
            return theThis?.type
        }

        private fun getParameterInfo(code: CodeAttribute?) : List<FieldData> {
            if (code == null) return listOf()
            val ai = code.attributes.filter { it is LocalVariableAttribute }.firstOrNull()
            val lineAttr = code.attributes.filter { it is LineNumberAttribute }.firstOrNull() as LineNumberAttribute?
            return when (ai) {
                is LocalVariableAttribute -> getLocalVariableData(ai, lineAttr,true)
                else -> emptyList()
            }
        }

        private fun getLocalInfo(code: CodeAttribute?) : List<FieldData> {
            if (code == null) return listOf()
            val ai = code.attributes.filter { it is LocalVariableAttribute }.firstOrNull()
            val lineAttr = code.attributes.filter { it is LineNumberAttribute }.firstOrNull() as LineNumberAttribute?
            return when (ai) {
                is LocalVariableAttribute -> getLocalVariableData(ai, lineAttr,false)
                else -> emptyList()
            }
        }

        private fun getLocalVariableData(attr: LocalVariableAttribute, lines: LineNumberAttribute?, isParam: Boolean) : List<FieldData> {
            return IntRange(0, attr.tableLength()-1)
                    .filter { (attr.startPc(it) == 0 && isParam) || (attr.startPc(it) > 0 && !isParam) }
                    .map {
                        val line = try { lines?.toLineNumber(attr.startPc(it)) ?: -1 } catch (e: Exception) { -1 }
                        val descriptor = attr.descriptor(it)
                        val signature = attr.signature(it)
                        val type = (if (signature != null) signature else descriptor)
                        FieldData(attr.variableName(it), type, line)
                    }
        }
    }

    override fun compareTo(other: ClassData): Int {
        return path.compareTo(other.path)
    }

}