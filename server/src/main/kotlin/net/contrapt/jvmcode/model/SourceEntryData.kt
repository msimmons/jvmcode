package net.contrapt.jvmcode.model

class SourceEntryData(
    pkg: String,
    name: String,
    path: String,
    override val content: String,
    val jarFile: String
) : JarEntryData(pkg, name, path) {
    override val type : JarEntryType = JarEntryType.SOURCE
    var parseData: ParseResult? = null

    companion object {

        fun create(path: String, pkg: String, jarFile: String, text: String) : SourceEntryData {
            val names = packageAndFile(path, false)
            return SourceEntryData(pkg, names.second, path, text, jarFile)
        }
    }
}