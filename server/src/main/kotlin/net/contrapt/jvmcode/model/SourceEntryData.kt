package net.contrapt.jvmcode.model

class SourceEntryData(
    name: String,
    path: String,
    val jarFile: String
) : JarEntryData(name, path) {
    override val type : JarEntryType = JarEntryType.SOURCE
    var parseData: ParseResult? = null

    companion object {

        fun create(path: String, jarFile: String) : SourceEntryData {
            val names = packageAndFile(path, false)
            return SourceEntryData(names.second, path, jarFile)
        }
    }
}