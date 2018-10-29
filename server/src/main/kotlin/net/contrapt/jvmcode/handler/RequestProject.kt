package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.model.JvmConfig
import net.contrapt.jvmcode.service.ProjectService

class RequestProject(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        // Get config, like list of package filters, etc
        val config = message.body().mapTo(JvmConfig::class.java)
        // Get the current JDK dependencies
        val project = projectService.getJvmProject(config)
        // Send them to the client
        return  JsonObject.mapFrom(project)
    }

}