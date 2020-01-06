package net.contrapt.jvmcode

import io.vertx.core.AbstractVerticle
import io.vertx.core.json.JsonObject
import net.contrapt.jvmcode.language.JavaCompiler
import net.contrapt.jvmcode.language.JavaLanguageRequest
import net.contrapt.jvmcode.language.JavaParser
import net.contrapt.jvmcode.model.LanguageCompiler
import net.contrapt.jvmcode.model.LanguageParser
import net.contrapt.jvmcode.service.SymbolRepository

class LanguageVerticle(val symbolRepository: SymbolRepository) : AbstractVerticle() {

    override fun start() {
        startLanguage()
    }

    fun startLanguage() {

        vertx.eventBus().consumer<JsonObject>("jvmcode.start-language") {
            val request = JavaLanguageRequest()
            vertx.sharedData().getLocalMap<String, LanguageParser>(LanguageParser.MAP_NAME)[request.languageId] = JavaParser()
            vertx.sharedData().getLocalMap<String, LanguageCompiler>(LanguageCompiler.MAP_NAME)[request.languageId] = JavaCompiler()
            vertx.eventBus().publish("jvmcode.language", JsonObject.mapFrom(request))
        }

    }
}