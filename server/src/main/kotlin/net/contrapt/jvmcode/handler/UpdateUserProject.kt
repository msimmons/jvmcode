package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService
import net.contrapt.jvmcode.service.model.ProjectUpdateRequest

/**
 * Handles message from a user supplied project (usually when restoring a workspace) and publishes
 * results back
 */
class UpdateUserProject(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val request = message.body().mapTo(ProjectUpdateRequest::class.java)
        projectService.updateUserProject(request)
        val projectJson = JsonObject.mapFrom(projectService.getJvmProject())
        vertx.eventBus().publish("jvmcode.project", projectJson)
        return projectJson
    }

}