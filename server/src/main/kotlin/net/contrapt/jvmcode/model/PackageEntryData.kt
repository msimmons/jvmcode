package net.contrapt.jvmcode.model

class PackageEntryData(
    val pkg: String,
    name: String,
    path: String
) : JarEntryData(name, path) {
    override val type : JarEntryType = JarEntryType.PACKAGE

    companion object {

        fun create(path: String, isJmod: Boolean) : PackageEntryData {
            val names = packageAndFile(path, isJmod)
            return PackageEntryData(names.first, names.first, path)
        }

    }
}