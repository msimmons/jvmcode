package net.contrapt.jvmcode

import com.fasterxml.jackson.databind.DeserializationFeature
import com.fasterxml.jackson.module.kotlin.KotlinModule
import io.vertx.core.Vertx
import io.vertx.core.json.Json
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import net.contrapt.jvmcode.model.JvmConfig

open class Application {

    private val logger = LoggerFactory.getLogger(javaClass)

    fun startup(startupToken: String) {
        val vertx = Vertx.vertx()

        // Configure Jackson as needed
        Json.mapper.apply {
            registerModule(KotlinModule())
            configure(DeserializationFeature.FAIL_ON_IGNORED_PROPERTIES, false)
            configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false)
        }

        // Read standard in for config
        val configString = System.`in`.bufferedReader().readLine()
        val config = Json.mapper.readValue(configString, JvmConfig::class.java)

        // Unhandled exceptions get published on the event bus
        vertx.exceptionHandler { e ->
            vertx.eventBus().publish("jvmcode.exception", JsonObject().put("message", e.message))
            logger.error("Unhandled exception", e)
        }
        vertx.deployVerticle(RouterVerticle(startupToken, config))
    }

    companion object {

        /**
         * Start the server - args specify the transport
         * and the project base directory
         */
        @JvmStatic
        fun main(args : Array<String>) {
            LogSetter.intitialize(args[0])
            val startupToken = args[1]
            Application().startup(startupToken)
        }
    }
}