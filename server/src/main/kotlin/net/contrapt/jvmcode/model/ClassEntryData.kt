package net.contrapt.jvmcode.model

class ClassEntryData(
    val pkg: String,
    name: String,
    path: String
) : JarEntryData(name, path) {
    override val fqcn = if (pkg.isEmpty()) name else "$pkg.$name"
    override val type: JarEntryType = JarEntryType.CLASS
    var classData : ClassData? = null
    var srcEntry : SourceEntryData? = null

    fun resolve(cd: ClassData) {
        this.classData = cd
    }
    fun isResolved() = classData != null
    fun srcName() = classData?.srcFile ?: name

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
