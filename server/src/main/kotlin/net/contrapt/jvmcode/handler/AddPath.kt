package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService
import net.contrapt.jvmcode.service.model.Path

/**
 * Handle user adding a class or source path component
 */
class AddPath(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val pathData = message.body().mapTo(Path::class.java)
        projectService.addUserPath(pathData)
        val project = projectService.getJvmProject()
        return JsonObject.mapFrom(project)
    }

}