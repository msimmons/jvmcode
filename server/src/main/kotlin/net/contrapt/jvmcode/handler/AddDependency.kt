package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.model.JvmConfig
import net.contrapt.jvmcode.service.ProjectService

class AddDependency(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val jarFile = message.body().getString("jarFile")
        val config = message.body().getJsonObject("config").mapTo(JvmConfig::class.java)
        projectService.addUserDependency(jarFile)
        return JsonObject.mapFrom(projectService.getJvmProject(config))
    }

}