package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

class AddClassDir(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val classDir = message.body().getString("classDir")
        projectService.addUserClassDirectory(classDir)
        val project = projectService.getJvmProject()
        return JsonObject.mapFrom(project)
    }

}