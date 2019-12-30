package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.language.JavaParseRequest
import net.contrapt.jvmcode.language.ParseService

class RequestParse(vertx: Vertx, val parseService: ParseService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val request = message.body().mapTo(JavaParseRequest::class.java)
        val result = parseService.parse(request)
        return JsonObject.mapFrom(result)
    }

}