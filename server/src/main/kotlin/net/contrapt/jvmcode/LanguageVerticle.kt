package net.contrapt.jvmcode

import io.vertx.core.AbstractVerticle
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.handler.RequestCompile
import net.contrapt.jvmcode.service.CompileService

class LanguageVerticle() : AbstractVerticle() {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val compileService = CompileService()

    override fun start() {
        startLanguage()
    }

    fun startLanguage() {
        /**
         * Request compilation for the given files
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.request-compile", RequestCompile(vertx, compileService))
    }

}