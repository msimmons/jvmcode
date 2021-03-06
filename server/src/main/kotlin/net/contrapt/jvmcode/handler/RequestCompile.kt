package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.language.JavaCompiler
import net.contrapt.jvmcode.language.JavaCompileRequest
import net.contrapt.jvmcode.model.LanguageCompiler
import net.contrapt.jvmcode.service.CompileService
import net.contrapt.jvmcode.service.model.JVMCompileRequest
import java.lang.IllegalStateException

class RequestCompile(vertx: Vertx, val compileService: CompileService) : AbstractHandler(vertx, true) {

    val logger = LoggerFactory.getLogger(javaClass)

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val request = message.body().mapTo(JVMCompileRequest::class.java)
        val compiler = vertx.sharedData().getLocalMap<String, LanguageCompiler>(LanguageCompiler.MAP_NAME)[request.languageId]
        val result = compileService.compile(request, compiler)
        return JsonObject.mapFrom(result)
    }

}