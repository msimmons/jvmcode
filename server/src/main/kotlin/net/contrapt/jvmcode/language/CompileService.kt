package net.contrapt.jvmcode.language

import javax.tools.Diagnostic
import javax.tools.DiagnosticCollector
import javax.tools.JavaFileObject
import javax.tools.ToolProvider

class CompileService {

    private val compiler = ToolProvider.getSystemJavaCompiler()

    fun compile(fileName: String, outputDir: String, classpath: String, sourcepath: String) : List<Diagnostic<out JavaFileObject>>  {
        val collector = DiagnosticCollector<JavaFileObject>()
        val fileManager = compiler.getStandardFileManager(collector, null, null)
        val compilationUnits = fileManager.getJavaFileObjects(fileName)
        val options = listOf("-d", outputDir, "-cp", classpath, "-sourcepath", sourcepath, "-deprecation", "-Xlint")
        val compileTask = compiler.getTask(null, fileManager, collector, options, null, compilationUnits)
        compileTask.call()
        return collector.diagnostics
    }

}