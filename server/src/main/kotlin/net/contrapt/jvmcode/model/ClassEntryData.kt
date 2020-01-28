package net.contrapt.jvmcode.model

import io.vertx.core.json.Json

class ClassEntryData(
    pkg: String,
    name: String,
    path: String
) : JarEntryData(pkg, name, path) {
    override val type: JarEntryType = JarEntryType.CLASS
    var classData : ClassData? = null
    var srcEntry : SourceEntryData? = null

    fun resolve(cd: ClassData) {
        this.classData = cd
    }
    fun isResolved() = classData != null
    fun srcName() = classData?.srcFile ?: name

    override val content: String
        get() { return if (classData != null) Json.encodePrettily(classData) else "" }

    companion object {

        fun create(path: String, isJmod: Boolean) : ClassEntryData {
            val names = packageAndFile(path, isJmod)
            val pkgName = names.first
            // Determine filename
            val name = names.second.replace(".class", "")
            return ClassEntryData(pkgName, name, path)
        }

    }
}
