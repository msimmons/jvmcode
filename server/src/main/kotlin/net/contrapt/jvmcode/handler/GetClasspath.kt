package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

class GetClasspath(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val classpath = projectService.getClasspath()
        return JsonObject().put("classpath", classpath)
    }

}