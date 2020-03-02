package net.contrapt.jvmcode.model

import io.vertx.core.json.Json
import javassist.bytecode.ClassFile
import org.junit.jupiter.api.Disabled
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfSystemProperty
import java.io.DataInputStream
import java.io.File
import java.util.jar.JarFile

class ClassDataTest {

    @Test
    @EnabledIfSystemProperty(named="name", matches = "foo")
    fun testStdlib() {
        val path = javaClass.classLoader?.getResource("kotlin-stdlib-1.3.50.jar")?.path ?: ""
        val file = JarFile(path)
        val entries = file.entries().asSequence().filter {
            it.name.endsWith("StringsKt.class") || it.name.endsWith("PropertyReference.class")
        }
        val classFile = ClassFile(DataInputStream(file.getInputStream(entries.first())))
        val classData = ClassData.create(classFile, "name", 0L)
/*
        entries.forEach {
            val classFile = ClassFile(DataInputStream(file.getInputStream(it)))
            val classData = ClassData.create(classFile, it.name, 0L)
            val json = Json.encodePrettily(classData)
            println(json)
        }
*/
    }

    @Test
    @Disabled
    fun testLocalClass() {
        val path = "/home/mark/work/jvmcode/server/build/classes/kotlin/main/net/contrapt/jvmcode/model/ClassData\$Companion.class"
        val classFile = ClassFile(DataInputStream(File(path).inputStream()))
        val classData = ClassData.create(classFile, "name", 0L)
        println(Json.encodePrettily(classData))
    }

}