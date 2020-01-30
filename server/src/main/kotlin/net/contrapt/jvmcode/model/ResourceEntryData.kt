package net.contrapt.jvmcode.model

class ResourceEntryData(
    val pkg: String,
    name: String,
    path: String
) : JarEntryData(name, path) {

    override val type : JarEntryType = JarEntryType.RESOURCE

    companion object {

        fun create(path: String, isJmod: Boolean) : ResourceEntryData {
            val names = packageAndFile(path, isJmod)
            return ResourceEntryData(names.first, names.second, path)
        }

    }
}