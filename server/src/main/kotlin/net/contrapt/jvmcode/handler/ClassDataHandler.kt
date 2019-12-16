package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

class ClassDataHandler(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx, true) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val classData = projectService.getClassData()
        return JsonObject.mapFrom(classData)
    }

}