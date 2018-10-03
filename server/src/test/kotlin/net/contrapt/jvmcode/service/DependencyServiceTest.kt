package net.contrapt.jvmcode.service

import io.kotlintest.matchers.beGreaterThan
import io.kotlintest.matchers.shouldBe
import io.kotlintest.matchers.shouldNotBe
import org.junit.Test

class DependencyServiceTest {

    @Test
    fun systemJdkTest() {
        val service = DependencyService()
        val deps = service.getDependencies()
        deps.size shouldBe 1
        val depData = deps.first()
        depData.source shouldBe "System"
        val jarEntries = service.getJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        val entry = jarEntries.packages.first().entries.first()
        service.getJarEntryContents(entry)
        entry.text shouldNotBe null
    }
}