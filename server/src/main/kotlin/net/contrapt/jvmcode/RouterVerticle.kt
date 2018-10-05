package net.contrapt.jvmcode

import io.vertx.core.AbstractVerticle
import io.vertx.core.DeploymentOptions
import io.vertx.core.Future
import io.vertx.core.Handler
import io.vertx.core.http.HttpServer
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import io.vertx.ext.bridge.BridgeEventType
import io.vertx.ext.bridge.PermittedOptions
import io.vertx.ext.web.Router
import io.vertx.ext.web.handler.StaticHandler
import io.vertx.ext.web.handler.sockjs.BridgeEvent
import io.vertx.ext.web.handler.sockjs.BridgeOptions
import io.vertx.ext.web.handler.sockjs.SockJSHandler
import net.contrapt.jvmcode.model.DependencyData
import net.contrapt.jvmcode.model.JarEntryData
import net.contrapt.jvmcode.model.JvmConfig
import net.contrapt.jvmcode.model.JvmProject
import net.contrapt.jvmcode.service.DependencyService

class RouterVerticle(val startupToken: String, var config: JvmConfig) : AbstractVerticle() {

    private val logger = LoggerFactory.getLogger(javaClass)

    private val deployments = mutableMapOf<String, String>()

    private val dependencyService = DependencyService()

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
            setReplyTimeout(5 * 60 * 1000)
        }

        val sockJs = SockJSHandler.create(vertx).bridge(bridgeOptions, bridgeEventHandler())

        router.route("/jvmcode/ws/*").handler(sockJs)

        httpServer.requestHandler(router::accept).listen(0) { res ->
            if (res.succeeded()) {
                httpPort = httpServer.actualPort()
                logger.info("Started server: $startupToken : $httpPort")
                startConsumers()
            } else {
                logger.error("Failed to start server", res.cause())
                vertx.close()
            }
        }
    }

    private fun bridgeEventHandler() = Handler<BridgeEvent> { event ->
        when (event.type()) {
            BridgeEventType.SOCKET_PING -> {
            }
            else -> logger.debug("Got bridge event: ${event.type()} ${event.socket().uri()} ${event.rawMessage?.encode()}")
        }
        event.complete(true)
    }

    fun startConsumers() {

        /**
         * JVM stats monitoring
         */
        vertx.setPeriodic(30000) { handler ->
            val free = Runtime.getRuntime().freeMemory()
            val total = Runtime.getRuntime().totalMemory()
            val max = Runtime.getRuntime().maxMemory()
            vertx.eventBus().publish("jvmcode.stats", JsonObject().put("free", free).put("total", total).put("max", max))
        }

        /**
         * Simple echo for testing
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.echo") { message ->
            logger.debug("Got the message ${message.body().encode()}")
            message.reply(JsonObject(mapOf("echo" to message.body())))
        }

        /**
         * An echo endpoint that will trigger fail, for testing
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.echo-fail") { message ->
            logger.debug("Got the message ${message.body().encode()}")
            message.fail(500, "Responding to echo-fail")
        }

        /**
         * An echo endpoint that will trigger a timeout
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.echo-timeout") { message ->
            logger.debug("Got the message ${message.body().encode()}")
            vertx.setTimer(60000) { _ ->
                message.reply(JsonObject(mapOf("echo" to "timeout")))
            }
        }

        /**
         * An echo endpoint that will trigger an unhandled exception
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.echo-unhandled") { message ->
            logger.debug("Got the message ${message.body().encode()}")
            message.reply(JsonObject().put("echo", "Sending unhandled message"))
            throw RuntimeException("Triggered unhandled exception")
        }

        /**
         * Shutdown this vertx instance
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.shutdown") { message ->
            logger.info("Shutting down $startupToken")
            message.reply(JsonObject(mapOf("message" to "shutting down")))
            httpServer.close()
            vertx.close()
        }

        /**
         * Install a verticle defined by a collection of jarFiles and the FQCN of the verticle to install
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.install") { message ->
            val jarFiles = message.body().getJsonArray("jarFiles")
            val verticleName = message.body().getString("verticleName")
            val options = DeploymentOptions().apply {
                extraClasspath = jarFiles.list.map { it.toString() }
                isolationGroup = verticleName
            }
            val deploymentId = deployments[verticleName]
            if (deploymentId != null) vertx.undeploy(deploymentId)
            vertx.deployVerticle(verticleName, options) { ar ->
                if (ar.failed()) {
                    logger.error("Failed deployment", ar.cause())
                    message.fail(500, ar.cause().toString())
                } else {
                    deployments[verticleName] = ar.result()
                    message.reply(JsonObject().put("deploymentId", ar.result()).put("port", httpPort))
                }
            }
        }

        /**
         * Add a route to serve the static content located at the given absolute path using the given webRoot
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.serve") { message ->
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
        }

        /**
         * Set the root log level of the running system
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.log-level") { message ->
            val level = message.body().getString("level")
            val result = LogSetter.setRootLevel(level)
            message.reply(JsonObject().put("level", result))
        }

        /**
         * Signal that this is a JVM project, which will result in dependency info being sent to the client
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.enable-dependencies") { message ->
            // Get config, like list of package filters, etc
            config = message.body().mapTo(JvmConfig::class.java)
            // Get the current JDK dependencies
            val dependencies = dependencyService.getDependencies(config)
            // Send them to the client
            vertx.eventBus().publish("jvmcode.dependencies", JsonObject.mapFrom(JvmProject(dependencies)))
        }

        /**
         * Add dependencies to be managed for this project; these can come from the user via interaction with this
         * extension or from other extensions, eg Gradle, Maven
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.add-dependencies") { message ->
            // Process the new dependencies
            // Send all current dependencies to the client
            vertx.eventBus().publish("jvmcode.dependencies", JsonObject())
        }

        /**
         * Return the jar entries for the given dependency
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.jar-entries") { message ->
            vertx.executeBlocking( Handler<Future<JsonObject>> { future ->
                try {
                    val dependencyData = message.body().getJsonObject("dependency").mapTo(DependencyData::class.java)
                    future.complete(JsonObject.mapFrom(dependencyService.getJarData(dependencyData)))
                } catch (e: Exception) {
                    logger.error("Getting jar entries", e)
                    future.fail(e)
                }
            }, false, Handler { ar ->
                if (ar.failed()) message.fail(1, ar.cause().toString())
                else message.reply(ar.result())
            })
        }

        /**
         * Return the contents of the given jar entry
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.jar-entry") { message ->
            vertx.executeBlocking(Handler<Future<JsonObject>> { future ->
                try {
                    val jarEntryData = message.body().getJsonObject("jarEntry").mapTo(JarEntryData::class.java)
                    val resolved = dependencyService.getJarEntryContents(jarEntryData)
                    future.complete(JsonObject.mapFrom(resolved))
                } catch (e: Exception) {
                    logger.error("Getting jar entry contents", e)
                    future.fail(e)
                }
            }, false, Handler { ar ->
                if (ar.failed()) message.fail(1, ar.cause().toString())
                else message.reply(ar.result())
            })
        }

        /**
         * Add a single jar file dependency and publish the new dependencies
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.add-dependency") { message ->
            vertx.executeBlocking(Handler<Future<Unit>> { future ->
                try {
                    val jarFile = message.body().getString("jarFile")
                    dependencyService.addDependency(jarFile)
                    config = message.body().mapTo(JvmConfig::class.java)
                    val dependencies = dependencyService.getDependencies(config)
                    vertx.eventBus().publish("jvmcode.dependencies", JsonObject.mapFrom(JvmProject(dependencies)))
                    future.complete()
                } catch (e: Exception) {
                    logger.error("Getting jar entry contents", e)
                    future.fail(e)
                }
            }, false, Handler { ar ->
                if (ar.failed()) message.fail(1, ar.cause().toString())
            })
        }
    }
}