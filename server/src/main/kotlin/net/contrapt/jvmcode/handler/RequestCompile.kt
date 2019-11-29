package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.model.CompileRequest
import net.contrapt.jvmcode.model.CompileResult
import net.contrapt.jvmcode.model.Diagnostic
import net.contrapt.jvmcode.service.CompileService

class RequestCompile(vertx: Vertx, val compileService: CompileService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        // Get config, like list of package filters, etc
        val request = message.body().mapTo(CompileRequest::class.java)
        // Compile and get diagnostcis
        val diagnostics = compileService.compile(request.files.first(), request.outputDir, request.classpath, request.sourcepath)
        // Send them to the client
        val reply = CompileResult()
        diagnostics.forEach {d ->
            reply.diagnostics.add(Diagnostic.from(d))
        }
        return JsonObject.mapFrom(reply)
    }

}