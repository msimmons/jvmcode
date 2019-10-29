package net.contrapt.jvmcode.handler

import io.vertx.core.Handler
import io.vertx.core.Promise
import io.vertx.core.Vertx
import io.vertx.core.eventbus.Message
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory

/**
 * Abstract out the boiler plate for blocking message handers
 */
abstract class AbstractHandler(val vertx: Vertx, val blocking: Boolean = false) : Handler<Message<JsonObject>> {

    private val logger = LoggerFactory.getLogger(javaClass)

    private fun handler(message: Message<JsonObject>) = Handler<Promise<JsonObject>> { future ->
        try {
            val result = processMessage(message)
            future.complete(result)
        } catch (e: Exception) {
            future.fail(e)
        }
    }

    /**
     * Handle message where the processing is potentially blocking
     */
    private fun handleBlocking(message: Message<JsonObject>) {
        vertx.executeBlocking(handler(message), false, Handler { ar ->
            if (ar.failed()) {
                logger.error(ar.cause())
                message.fail(500, ar.cause().message)
            } else {
                message.reply(ar.result())
            }
        })
    }

    /**
     * Handle a message where the processing is non-blocking (quick)
     */
    private fun handleNonBlocking(message: Message<JsonObject>) {
        try {
            val result = processMessage(message)
            message.reply(result)
        } catch (e: Exception) {
            logger.error(e)
            message.fail(500, e.message)
        }
    }

    /**
     * Handle a message where the processing is non-blocking (quick)
     */
    override fun handle(message: Message<JsonObject>) {
        if (blocking) handleBlocking(message)
        else handleNonBlocking(message)
    }

    /**
     * Implement this to process your message and return a resulting [JsonObject]
     */
    abstract fun processMessage(message: Message<JsonObject>) : JsonObject

}