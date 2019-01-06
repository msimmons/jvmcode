package net.contrapt.kt2ts

data class Kt2TsExtension(
        var classNames: List<String> = mutableListOf(),
        var packages: List<String> = mutableListOf(),
        var outDir: String = "",
        var outFile: String = "types.d.ts",
        var jarFile: String = "",
        var moduleName: String = ""
)
