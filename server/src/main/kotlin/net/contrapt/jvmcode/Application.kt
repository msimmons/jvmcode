package net.contrapt.jvmcode

import io.vertx.core.Vertx
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory

open class Application {

    private val logger = LoggerFactory.getLogger(javaClass)

    fun startup(startupToken: String) {
        val vertx = Vertx.vertx()
        // Unhandled exceptions get published on the event bus
        vertx.exceptionHandler { e ->
            vertx.eventBus().publish("jvmcode.exception", JsonObject().put("message", e.message))
            logger.error("Unhandled exception", e)
        }
        vertx.deployVerticle(RouterVerticle(startupToken))
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