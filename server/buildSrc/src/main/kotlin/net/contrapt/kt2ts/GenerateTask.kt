package net.contrapt.kt2ts

import me.ntrrgc.tsGenerator.TypeScriptGenerator
import org.gradle.api.DefaultTask
import org.gradle.api.tasks.TaskAction
import java.io.File
import java.net.URLClassLoader
import java.time.LocalDate
import java.time.LocalDateTime
import java.util.jar.JarFile

open class GenerateTask : DefaultTask() {


    @TaskAction
    fun execute() {
        val extension = project.extensions.findByType(Kt2TsExtension::class.java) ?: Kt2TsExtension()
        val outDir = File(extension.outDir)
        if (!outDir.exists()) {
            outDir.mkdirs()
        }
        val outFilePath = extension.outDir + File.separator + extension.outFile
        val jarFileName = extension.jarFile
        val classNames = extension.classNames + getClassNamesFromPackages(extension.packages, jarFileName)
        val moduleName = extension.moduleName
        doExecute(classNames, outFilePath, jarFileName, moduleName)
    }

    fun doExecute(classNames: Iterable<String>, outFilePath: String, jarFileName: String, moduleName: String) {
        val classLoader = URLClassLoader(arrayOf(File(jarFileName).toURI().toURL()), javaClass.classLoader)
        val classes = classNames.map {
            Class.forName(it, false, classLoader).kotlin
        }
        val text = TypeScriptGenerator(classes, mapOf(LocalDate::class to "Date", LocalDateTime::class to "Date")).definitionsText
        val outFile = File(outFilePath)
        outFile.writeText("declare module \"${moduleName}\" {\n${text}\n}")
    }

    private fun getClassNamesFromPackages(packages: List<String>, jarFileName: String) : List<String> {
        val classNames = mutableListOf<String>()
        val jarFile = JarFile(jarFileName)
        jarFile.entries().iterator().forEach {
            if (!it.isDirectory) {
                val fqcn = getEntry(it.name)
                if (fqcn != null && packages.any { fqcn.startsWith(it) }) classNames.add(fqcn)
            }
        }
        return classNames
    }

    /**
     * Return the package name and class name from a jar entry name
     */
    private fun getEntry(jarEntryName: String) : String? {
        val fqcn = when(jarEntryName.endsWith(".class") && !jarEntryName.contains("$")) {
            true -> jarEntryName.replace(File.separator, ".").replace(".class", "")
            else -> null
        }
        return fqcn
    }

}