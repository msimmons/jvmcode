package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.language.*

class RequestParse(vertx: Vertx, val parseService: ParseService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val request = message.body().mapTo(JavaParseRequest::class.java)
        val result = JavaParseResult(file = request.file).apply {
            pkg = JavaParseSymbol("", "", JavaParseLocation(0,0), "")
        }
        return JsonObject.mapFrom(result)
    }

}