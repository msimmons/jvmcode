package net.contrapt.jvmcode.model

open class JarEntryData(
    val name: String,
    val path: String
) : Comparable<JarEntryData> {

    open val fqcn = path
    override fun compareTo(other: JarEntryData): Int {
        return fqcn.compareTo(other.fqcn)
    }
    open val type: JarEntryType = JarEntryType.PACKAGE

    companion object {
        fun packageAndFile(path: String, isJmod: Boolean): Pair<String, String> {
            val parts = path.split("/")
            val filtered = parts.filterIndexed { index, _ ->
                when (isJmod) {
                    true -> index > 0 && parts[0] == "classes"
                    else -> true
                } && index < parts.size - 1
            }
            return filtered.joinToString(".") { it } to parts[parts.size-1]
        }
    }
}
