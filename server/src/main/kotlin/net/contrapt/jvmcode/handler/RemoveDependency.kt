package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

/**
 * Handle user removes dependency
 */
class RemoveDependency(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val jarFile = message.body().getString("jarFile")
        projectService.removeUserDependency(jarFile)
        return JsonObject.mapFrom(projectService.getJvmProject())
    }

}