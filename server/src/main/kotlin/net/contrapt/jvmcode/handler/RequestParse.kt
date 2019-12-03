package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.language.JavaParseRequest
import net.contrapt.jvmcode.language.JavaParseResult
import net.contrapt.jvmcode.language.ParseService

class RequestParse(vertx: Vertx, val parseService: ParseService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val request = message.body().mapTo(JavaParseRequest::class.java)
        val result = JavaParseResult(file = request.file, symbols = "the symbols")
        return JsonObject.mapFrom(result)
    }

}