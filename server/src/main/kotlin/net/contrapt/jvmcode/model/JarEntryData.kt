package net.contrapt.jvmcode.model

class JarEntryData(
        val name: String,
        val type: JarEntryType,
        val pkg: String,
        var text: String? = null
) : Comparable<JarEntryData> {

    override fun compareTo(other: JarEntryData): Int {
        return name.compareTo(other.name)
    }

    fun fqcn() = "$pkg.$name"

}