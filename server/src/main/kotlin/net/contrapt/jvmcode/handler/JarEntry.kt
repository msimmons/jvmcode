package net.contrapt.jvmcode.handler

import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.service.ProjectService

class JarEntry(vertx: Vertx, val projectService: ProjectService) : AbstractHandler(vertx, true) {

    override fun processMessage(message: Message<JsonObject>): JsonObject {
        val fqcn = message.body().getString("fqcn")
        val jarFile = message.body().getString("jarFile")
        val resolved = projectService.resolveJarEntrySource(jarFile, fqcn)
        return JsonObject.mapFrom(resolved)
    }

}