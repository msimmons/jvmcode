package net.contrapt.jvmcode

import io.vertx.core.Vertx
import io.vertx.core.logging.LoggerFactory

open class Application {

    private val logger = LoggerFactory.getLogger(javaClass)

    fun startup(startupToken: String) {
        val vertx = Vertx.vertx()
        vertx.deployVerticle(RouterVerticle(startupToken))
    }

    companion object {

        /**
         * Start the server - args specify the transport
         * and the project base directory
         */
        @JvmStatic
        fun main(args : Array<String>) {
            val startupToken = args[1]
            Application().startup(startupToken)
        }
    }
}