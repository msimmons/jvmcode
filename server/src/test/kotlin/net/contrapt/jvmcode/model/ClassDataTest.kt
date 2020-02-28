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
        val entries = file.entries().asSequence().filter {
            it.name.endsWith("StringsKt.class") || it.name.endsWith("PropertyReference.class")
        }
        entries.forEach {
            val classFile = ClassFile(DataInputStream(file.getInputStream(it)))
            val classData = ClassData.create(classFile, it.name, 0L)
            val json = Json.encodePrettily(classData)
            println(json)
        }
    }
}