package net.contrapt.jvmcode.model

import io.kotlintest.shouldBe
import org.junit.jupiter.api.Test

class JarEntryDataTest {

    @Test
    fun getNamesTest() {
        val testData = listOf(
                Triple("classes/", true, Pair("", "")),
                Triple("classes/net/", true, Pair("net", "")),
                Triple("bin/", true, Pair("", "")),
                Triple("bin/net/", true, Pair("", "")),
                Triple("classes/net/File.java", true, Pair("net", "File.java"))
        )
        testData.forEach {
            val jed = ClassEntryData.create(it.first, it.second)
            jed.pkg shouldBe it.third.first
            jed.name shouldBe it.third.second
        }
    }
}