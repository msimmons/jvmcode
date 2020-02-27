package net.contrapt.jvmcode.language

import io.vertx.core.logging.LoggerFactory
import io.vertx.core.shareddata.Shareable
import net.contrapt.jvmcode.model.CompileRequest
import net.contrapt.jvmcode.model.CompileResult
import net.contrapt.jvmcode.model.LanguageCompiler
import java.util.*
import javax.tools.Diagnostic
import javax.tools.DiagnosticCollector
import javax.tools.JavaFileObject
import javax.tools.ToolProvider

class JavaCompiler : LanguageCompiler, Shareable {

    private val logger = LoggerFactory.getLogger(javaClass)
    private val compiler = ToolProvider.getSystemJavaCompiler()

    override fun compile(request: CompileRequest): CompileResult {
        val reply = JavaCompileResult()
        val diagnostics = compile(request.files, request.outputDir, request.classpath, request.sourcepath)
        diagnostics.forEach {d ->
            if (d.source?.name == null) logger.warn("Compiler Message: ${d.getMessage(Locale.getDefault())}")
            else reply.diagnostics.add(JavaDiagnostic.from(d))
        }
        return reply
    }

    private fun compile(fileNames: Collection<String>, outputDir: String, classpath: String, sourcepath: String) : List<Diagnostic<out JavaFileObject>>  {
        val collector = DiagnosticCollector<JavaFileObject>()
        val fileManager = compiler.getStandardFileManager(collector, null, null)
        val compilationUnits = fileManager.getJavaFileObjects(*fileNames.toTypedArray())
        val options = listOf("-d", outputDir, "-cp", classpath, "-sourcepath", sourcepath, "-deprecation", "-Xlint")
        val compileTask = compiler.getTask(null, fileManager, collector, options, null, compilationUnits)
        compileTask.call()
        return collector.diagnostics
    }

}