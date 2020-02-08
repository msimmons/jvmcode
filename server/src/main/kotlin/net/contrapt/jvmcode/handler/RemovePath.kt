package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

/**
 * Handle user adding a class or source path component
 */
class RemovePath(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val path = message.body().getString("path")
        projectService.removeUserPath(path)
        val project = projectService.getJvmProject()
        return JsonObject.mapFrom(project)
    }

}