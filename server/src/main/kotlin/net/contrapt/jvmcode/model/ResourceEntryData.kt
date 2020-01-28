package net.contrapt.jvmcode.model

class ResourceEntryData(
    pkg: String,
    name: String,
    path: String
) : JarEntryData(pkg, name, path) {

    override val type : JarEntryType = JarEntryType.RESOURCE
    override var content : String = ""

    companion object {

        fun create(path: String, isJmod: Boolean) : ResourceEntryData {
            val names = packageAndFile(path, isJmod)
            return ResourceEntryData(names.first, names.second, path)
        }

    }
}