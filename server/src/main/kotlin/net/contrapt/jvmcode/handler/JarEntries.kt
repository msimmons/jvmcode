package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.model.Dependency
import net.contrapt.jvmcode.service.ProjectService

class JarEntries(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx, true) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val dependencyData = message.body().getJsonObject("dependency").mapTo(Dependency::class.java)
        val jarData = projectService.getJarData(dependencyData)
        return JsonObject.mapFrom(jarData)
    }

}