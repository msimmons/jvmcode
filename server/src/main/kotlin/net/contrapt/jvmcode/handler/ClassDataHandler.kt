package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

class ClassDataHandler(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx, true) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val path = message.body().getString("path")
        val classData = projectService.getClassData(path)
        return JsonObject.mapFrom(classData)
    }

}