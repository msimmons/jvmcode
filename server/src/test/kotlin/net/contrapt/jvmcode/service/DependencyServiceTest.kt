package net.contrapt.jvmcode.service

import io.kotlintest.matchers.beGreaterThan
import io.kotlintest.matchers.shouldBe
import io.kotlintest.matchers.shouldNotBe
import net.contrapt.jvmcode.model.JvmConfig
import org.junit.Test

class DependencyServiceTest {

    @Test
    fun systemJdkTest() {
        val service = DependencyService()
        val deps = service.getDependencies(JvmConfig(setOf()))
        deps.size shouldBe 1
        val depData = deps.first()
        depData.source shouldBe "System"
        val jarEntries = service.getJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        val entry = jarEntries.packages.first().entries.first()
        service.getJarEntryContents(entry)
        entry.text shouldNotBe null
    }

    @Test
    fun systemJdkWithExcludesTest() {
        val service = DependencyService()
        val deps = service.getDependencies(JvmConfig(setOf("com.sun")))
        deps.size shouldBe 1
        val depData = deps.first()
        val jarEntries = service.getJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        jarEntries.packages.any { pkg -> pkg.name.startsWith("com.sun") } shouldBe false
    }

    @Test
    fun addDependencyTest() {
        val service = DependencyService()
        javaClass.classLoader
        val path = javaClass.classLoader.getResource("postgresql-42.1.4.jar").path
        service.addDependency(path)
        val deps = service.getDependencies(JvmConfig(setOf("com.sun")))
        deps.size shouldBe 2
    }
}