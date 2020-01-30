package net.contrapt.jvmcode

import io.vertx.core.AbstractVerticle
import io.vertx.core.DeploymentOptions
import io.vertx.core.Handler
import io.vertx.core.http.HttpServer
import io.vertx.core.http.HttpServerOptions
import io.vertx.core.json.JsonObject
import io.vertx.core.logging.LoggerFactory
import io.vertx.ext.bridge.BridgeEventType
import io.vertx.ext.bridge.PermittedOptions
import io.vertx.ext.web.Router
import io.vertx.ext.web.handler.StaticHandler
import io.vertx.ext.web.handler.sockjs.BridgeEvent
import io.vertx.ext.web.handler.sockjs.BridgeOptions
import io.vertx.ext.web.handler.sockjs.SockJSHandler
import io.vertx.ext.web.handler.sockjs.SockJSHandlerOptions
import net.contrapt.jvmcode.handler.*
import net.contrapt.jvmcode.service.ParseService
import net.contrapt.jvmcode.model.JvmConfig
import net.contrapt.jvmcode.service.CompileService
import net.contrapt.jvmcode.service.ProjectService
import net.contrapt.jvmcode.service.SymbolRepository
import java.io.File

class RouterVerticle(val startupToken: String, var config: JvmConfig, symbolRepository: SymbolRepository) : AbstractVerticle() {

    private val logger = LoggerFactory.getLogger(javaClass)
    private val deployments = mutableMapOf<String, String>()
    private val javaHome = System.getProperty("java.home").replace("${File.separator}jre", "")
    private val parseService = ParseService(symbolRepository)
    private val compileService = CompileService(symbolRepository)
    private val projectService = ProjectService(config, javaHome, symbolRepository)

    var httpPort = 0
        private set

    lateinit var httpServer: HttpServer
    lateinit var router: Router

    override fun start() {
        startRouter()
    }

    fun startRouter() {
        val httpServerOptions = HttpServerOptions().apply {
            maxWebsocketFrameSize = 1024 * 1024
        }
        httpServer = vertx.createHttpServer(httpServerOptions)
        router = Router.router(vertx)

        val bridgeOptions = BridgeOptions().apply {
            addInboundPermitted(PermittedOptions().apply { addressRegex = ".*" })
            addOutboundPermitted(PermittedOptions().apply { addressRegex = ".*" })
            setReplyTimeout(5 * 60 * 1000)
        }
        val sockJs = SockJSHandler.create(vertx)
        sockJs.bridge(bridgeOptions, bridgeEventHandler())

        router.route("/jvmcode/ws/*").handler(sockJs)

        httpServer.requestHandler(router).listen(0) { res ->
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
            BridgeEventType.SOCKET_PING -> { }
            BridgeEventType.REGISTER -> {
                if ( event.rawMessage?.getString("address") == "jvmcode.stats" ) vertx.setTimer(1000, {publishJvmStats()})
            }
            else -> logger.debug("Got bridge event: ${event.type()} ${event.socket().uri()} ${event.rawMessage?.encode()}")
        }
        event.complete(true)
    }

    fun publishJvmStats() {
        val free = Runtime.getRuntime().freeMemory()
        val total = Runtime.getRuntime().totalMemory()
        val max = Runtime.getRuntime().maxMemory()
        vertx.eventBus().publish("jvmcode.stats", JsonObject().put("free", free).put("total", total).put("max", max))
    }

    fun startConsumers() {

        /**
         * JVM stats monitoring
         */
        vertx.setPeriodic(30000) { _ ->
            publishJvmStats()
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
         * Signal that this is a JVM project, which will result in project info being published to any listeners
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.request-project", RequestProject(vertx, projectService))

        /**
         * Update project info (dependencies, classpath) -- likely called by other extensions such as Gradle or Maven integration
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.update-project", UpdateProject(vertx, projectService))

        /**
         * Update project info (dependencies, classpath) for user defined project
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.update-user-project", UpdateUserProject(vertx, projectService))

        /**
         * Return the jar entries for the given dependency
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.jar-entries", JarEntries(vertx, projectService))

        /**
         * Return all the class data for this project
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.classdata", ClassDataHandler(vertx, projectService))

        /**
         * Return the contents of the given jar entry
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.jar-entry", JarEntry(vertx, projectService))

        /**
         * Add a single jar file dependency and publish the new dependencies
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.add-dependency", AddDependency(vertx, projectService))

        /**
         * Remove a single jar file dependency
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.remove-dependency", RemoveDependency(vertx, projectService))

        /**
         * Add one or more path components (from the user)
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.add-path", AddPath(vertx, projectService))

        /**
         * Remove a user entered path component
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.remove-path", RemovePath(vertx, projectService))

        /**
         * Return the classpath for the current set of dependencies
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.classpath", GetClasspath(vertx, projectService))

        /**
         * Request compilation for the given files
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.request-compile", RequestCompile(vertx, compileService))

        /**
         * Request parsing the given file
         */
        vertx.eventBus().consumer<JsonObject>("jvmcode.request-parse", RequestParse(vertx, parseService))
    }

}