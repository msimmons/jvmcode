package net.contrapt.jvmcode

import io.vertx.core.AbstractVerticle
import io.vertx.core.DeploymentOptions
import io.vertx.core.Handler
import io.vertx.core.http.HttpServer
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import io.vertx.ext.web.Router
import io.vertx.ext.web.handler.StaticHandler
import io.vertx.ext.web.handler.sockjs.*

class RouterVerticle(val startupToken: String) : AbstractVerticle() {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val deployments = mutableMapOf<String, String>()

    var httpPort = 0
        private set

    lateinit var httpServer: HttpServer
    lateinit var router: Router

    override fun start() {
        startRouter()
    }

    fun startRouter() {
        httpServer = vertx.createHttpServer()
        router = Router.router(vertx)

        val bridgeOptions = BridgeOptions().apply {
            addInboundPermitted(PermittedOptions().apply { addressRegex = ".*" })
            addOutboundPermitted(PermittedOptions().apply { addressRegex = ".*" })
        }

        val sockJs = SockJSHandler.create(vertx).bridge(bridgeOptions, bridgeEventHandler())

        router.route("/jvmcode/ws/*").handler(sockJs)

        httpServer.requestHandler(router::accept).listen(0, {res ->
            if (res.succeeded()) {
                httpPort = httpServer.actualPort()
                logger.info("Started server: $startupToken : $httpPort")
                startConsumers()
            } else {
                logger.error("Failed to start server", res.cause())
                vertx.close()
            }
        })
    }

    private fun bridgeEventHandler() = Handler<BridgeEvent> { event ->
        when ( event.type() ) {
            BridgeEventType.SOCKET_PING -> {}
            //TODO Configurable logging
            else -> logger.info("Got bridge event: ${event.type()} ${event.socket().uri()} ${event.rawMessage?.encode()}")
        }
        event.complete(true)
    }

    fun startConsumers() {

        vertx.eventBus().consumer<JsonObject>("jvmcode.echo", { message ->
            logger.debug("Got the message ${message.body().encode()}")
            message.reply(JsonObject(mapOf("echo" to message.body())))
        })

        vertx.eventBus().consumer<JsonObject>("jvmcode.echo-fail", { message ->
            logger.debug("Got the message ${message.body().encode()}")
            message.fail(500, "Responding to echo-fail")
        })

        vertx.eventBus().consumer<JsonObject>("jvmcode.shutdown", { message ->
            logger.info("Shutting down $startupToken")
            message.reply(JsonObject(mapOf("message" to "shutting down")))
            httpServer.close()
            vertx.close()
        })

        vertx.eventBus().consumer<JsonObject>("jvmcode.install", { message ->
            val jarFiles = message.body().getJsonArray("jarFiles")
            val verticleName = message.body().getString("verticleName")
            val options = DeploymentOptions().apply {
                extraClasspath = jarFiles.list as List<String>
                isolationGroup = verticleName
            }
            val deploymentId = deployments[verticleName]
            if ( deploymentId != null ) vertx.undeploy(deploymentId)
            vertx.deployVerticle(verticleName, options, {ar ->
                if ( ar.failed() ) {
                    logger.error("Failed deployment", ar.cause())
                    message.fail(500, ar.cause().toString())
                }
                else {
                    deployments[verticleName] = ar.result()
                    message.reply(JsonObject().put("deploymentId", ar.result()).put("port", httpPort))
                }
            })
        })

        vertx.eventBus().consumer<JsonObject>("jvmcode.serve", { message ->
            val path = message.body().getString("path")
            val webRoot = message.body().getString("webRoot")
            val handler = StaticHandler.create().apply {
                setAllowRootFileSystemAccess(true)
                setWebRoot(webRoot)
                setFilesReadOnly(true)
                setCachingEnabled(false) //TODO configurable caching
            }
            router.route(path).handler(handler)
            message.reply(JsonObject().put("port", httpPort))
        })
    }
}