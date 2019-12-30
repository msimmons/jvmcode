package net.contrapt.jvmcode.model

import javassist.bytecode.ClassFile

class JarEntryData(
        val name: String,
        val type: JarEntryType,
        val pkg: String,
        val path: String
) : Comparable<JarEntryData> {

    var text: String? = null
    var classData : ClassData? = null
    var parseData : ParseResult? = null

    override fun compareTo(other: JarEntryData): Int {
        return fqcn().compareTo(other.fqcn())
    }

    fun fqcn() = "$pkg.$name"
    fun resolve(cf: ClassFile) {
        this.classData = ClassData.create(cf)
    }
    fun isResolved() = classData != null
    fun srcName() = classData?.srcFile ?: name

    companion object {

        fun create(path: String, isJmod: Boolean) : JarEntryData {
            val parts = path.split("/")
            val filtered = parts.filterIndexed { index, _ ->
                when(isJmod) {
                    true -> index > 0 && parts[0] == "classes"
                    else -> true
                } && index < parts.size - 1
            }
            val pkgName = filtered.joinToString(".") { it }
            // Determine filename
            var fileName = parts[parts.size-1]
            if (fileName.contains("$")) fileName = ""
            // Determine resource type
            val type = when (fileName.substringAfterLast(".")) {
                "" -> JarEntryType.PACKAGE
                "class" -> JarEntryType.CLASS
                else -> JarEntryType.RESOURCE
            }
            fileName = when (type) {
                JarEntryType.CLASS -> fileName.replace(".class", "")
                else -> fileName
            }
            return JarEntryData(fileName, type, pkgName, path)
        }

    }

}