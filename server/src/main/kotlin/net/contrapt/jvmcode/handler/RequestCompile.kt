package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.language.CompileService
import net.contrapt.jvmcode.language.JavaCompileRequest
import net.contrapt.jvmcode.language.JavaCompileResult
import net.contrapt.jvmcode.language.JavaDiagnostic
import java.util.*

class RequestCompile(vertx: Vertx, val compileService: CompileService) : AbstractHandler(vertx) {

    val logger = LoggerFactory.getLogger(javaClass)

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        // Get config, like list of package filters, etc
        val request = message.body().mapTo(JavaCompileRequest::class.java)
        // Compile and get diagnostcis
        val diagnostics = compileService.compile(request.files.first(), request.outputDir, request.classpath, request.sourcepath)
        // Send them to the client
        val reply = JavaCompileResult()
        diagnostics.forEach {d ->
            if (d.source?.name == null) logger.warn("Compiler Message: ${d.getMessage(Locale.getDefault())}")
            else reply.diagnostics.add(JavaDiagnostic.from(d))
        }
        return JsonObject.mapFrom(reply)
    }

}