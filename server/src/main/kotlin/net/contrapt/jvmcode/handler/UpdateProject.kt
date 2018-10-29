package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.model.JvmProject
import net.contrapt.jvmcode.service.ProjectService

class UpdateProject(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val source = message.body().getString("source")
        val project = message.body().getJsonObject("project").mapTo(JvmProject::class.java)
        projectService.updateProject(source, project)
        val projectJson = JsonObject.mapFrom(projectService.getJvmProject())
        vertx.eventBus().publish("jvmcode.project", projectJson)
        return projectJson
    }

}