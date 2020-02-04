package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.language.JavaParseRequest
import net.contrapt.jvmcode.service.ParseService
import net.contrapt.jvmcode.model.LanguageParser

class RequestParse(vertx: Vertx, val parseService: ParseService) : AbstractHandler(vertx, true) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val request = message.body().mapTo(JavaParseRequest::class.java)
        val parser = vertx.sharedData().getLocalMap<String, LanguageParser>(LanguageParser.MAP_NAME)[request.languageId]
        val result = parseService.parse(request, parser)
        return JsonObject.mapFrom(result)
    }

}