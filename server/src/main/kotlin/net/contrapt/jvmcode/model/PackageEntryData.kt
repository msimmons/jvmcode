package net.contrapt.jvmcode.model

class PackageEntryData(
    pkg: String,
    name: String,
    path: String
) : JarEntryData(pkg, name, path) {
    override val type : JarEntryType = JarEntryType.PACKAGE

    override val content = ""

    companion object {

        fun create(path: String, isJmod: Boolean) : PackageEntryData {
            val names = packageAndFile(path, isJmod)
            return PackageEntryData(names.first, names.first, path)
        }

    }
}