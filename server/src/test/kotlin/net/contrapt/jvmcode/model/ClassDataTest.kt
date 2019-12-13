package net.contrapt.jvmcode.model

import io.vertx.core.json.Json
import javassist.bytecode.ClassFile
import org.junit.jupiter.api.Test
import java.io.DataInputStream
import java.util.jar.JarFile

class ClassDataTest {

    @Test
    fun testStdlib() {
        val path = javaClass.classLoader?.getResource("kotlin-stdlib-1.3.50.jar")?.path ?: ""
        val file = JarFile(path)
        val entry = file.entries().asSequence().find {
            it.name.endsWith("StringsKt.class")
        }
        val classFile = ClassFile(DataInputStream(file.getInputStream(entry)))
        val classData = ClassData.create(classFile)
        val json = Json.encodePrettily(classData)
        println(json)
    }
}