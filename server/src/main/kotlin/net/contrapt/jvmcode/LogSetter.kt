package net.contrapt.jvmcode

import ch.qos.logback.classic.Level
import ch.qos.logback.classic.Logger

class LogSetter {

    companion object {

        fun intitialize(level: String) {
            System.setProperty("vertx.logger-delegate-factory-class-name", "io.vertx.core.logging.SLF4JLogDelegateFactory")
            setRootLevel(level)
        }

        fun setRootLevel(level: String) : String {
            val logger = org.slf4j.LoggerFactory.getLogger(Logger.ROOT_LOGGER_NAME) as Logger
            logger.level = Level.toLevel(level, Level.INFO)
            return logger.level.levelStr
        }
    }
}