package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.model.JarEntryData
import net.contrapt.jvmcode.service.ProjectService

class JarEntry(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx, true) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val jarEntryData = message.body().getJsonObject("jarEntry").mapTo(JarEntryData::class.java)
        val resolved = projectService.getJarEntryContents(jarEntryData.fqcn)
        return JsonObject.mapFrom(resolved)
    }

}