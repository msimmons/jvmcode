package net.contrapt.jvmcode.model

data class JarPackageData(
        var name: String = "",
        val entries: MutableCollection<JarEntryData> = mutableSetOf()
) : Comparable<JarPackageData> {

    override fun compareTo(other: JarPackageData): Int {
        return name.compareTo(other.name)
    }

}