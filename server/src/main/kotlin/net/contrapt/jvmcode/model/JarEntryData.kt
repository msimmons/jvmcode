package net.contrapt.jvmcode.model

data class JarEntryData(
        var name: String = "",
        var type: String = "",
        var text: String? = null
) : Comparable<JarEntryData> {

    override fun compareTo(other: JarEntryData): Int {
        return name.compareTo(other.name)
    }

}