package net.contrapt.jvmcode

import io.vertx.core.AbstractVerticle
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.handler.RequestCompile
import net.contrapt.jvmcode.handler.RequestParse
import net.contrapt.jvmcode.language.CompileService
import net.contrapt.jvmcode.language.JavaLanguageRequest
import net.contrapt.jvmcode.language.ParseService

class LanguageVerticle() : AbstractVerticle() {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val compileService = CompileService()
    private val parseService = ParseService()

    override fun start() {
        startLanguage()
    }

    fun startLanguage() {

        vertx.eventBus().consumer<JsonObject>("jvmcode.start-language") {
            val request = JavaLanguageRequest()
            vertx.eventBus().publish("jvmcode.language", JsonObject.mapFrom(request))
        }

        /**
         * Request compilation for the given files
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.request-compile", RequestCompile(vertx, compileService))

        /**
         * Request parsing the given files
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.request-parse", RequestParse(vertx, parseService))
    }

}