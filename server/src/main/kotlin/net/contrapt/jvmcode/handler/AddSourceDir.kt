package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

class AddSourceDir(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val sourceDir = message.body().getString("sourceDir")
        projectService.addUserSourceDirectory(sourceDir)
        val project = projectService.getJvmProject()
        return JsonObject.mapFrom(project)
    }

}