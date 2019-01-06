package net.contrapt.jvmcode.service

import io.kotlintest.matchers.*
import net.contrapt.jvmcode.model.DependencySource
import net.contrapt.jvmcode.model.JarEntryType
import net.contrapt.jvmcode.model.JvmConfig
import org.junit.Test
import java.io.File

class ProjectServiceTest {

    @Test
    fun systemJdkTest() {
        val config = JvmConfig(setOf(), setOf("java"))
        val service = ProjectService(config)
        val project = service.getJvmProject()
        project.dependencySources.size shouldBe 2 // System and User
        val depSource = project.dependencySources.first()
        depSource.name shouldBe DependencySource.SYSTEM
        depSource.dependencies.size shouldBe 1
        val depData = depSource.dependencies.first()
        val jarEntries = service.getJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        val resourceEntry = jarEntries.packages.first().entries.first()
        service.getJarEntryContents(resourceEntry)
        resourceEntry.text shouldNotBe null
        val classEntry = jarEntries.packages.first { it.name == "java.lang" }.entries.first { it.type == JarEntryType.CLASS }
        val javaEntry = service.getJarEntryContents(classEntry)
        if (File(depData.sourceFileName).exists()) {
            javaEntry.text shouldNotBe null
        }
    }

    @Test
    fun systemJdkWithExcludesTest() {
        val config = JvmConfig(setOf("com.sun"), setOf("java"))
        val service = ProjectService(config)
        val deps = service.getJvmProject().dependencySources
        deps.size shouldBe 2
        val depSource = deps.first()
        val depData = depSource.dependencies.first()
        val jarEntries = service.getJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        jarEntries.packages.any { pkg -> pkg.name.startsWith("com.sun") } shouldBe false
    }

    @Test
    fun addDependencyTest() {
        val config = JvmConfig(setOf("com.sun"), setOf("java"))
        val service = ProjectService(config)
        val path = javaClass.classLoader.getResource("postgresql-42.1.4.jar").path
        service.addDependency(path)
        val deps = service.getJvmProject().dependencySources
        deps.size shouldBe 2
        val depSource = deps.last()
        val jarData = service.getJarData(depSource.dependencies.last())
        val pkg = jarData.packages.find { it.name == "META-INF.maven.org.postgresql.postgresql" } // META-INF/maven/org.postgresql/postgresql
        val je = pkg?.entries?.first()
        val jec = when (je) {
            null -> null
            else -> {} //service.getJarEntryContents(je) TODO Fix paths whose components contain '.'
        }
        jec
    }

    @Test
    fun getClasspathTest() {
        val service = ProjectService(JvmConfig(setOf(), setOf()))
        val path1 = javaClass.classLoader.getResource("postgresql-42.1.4.jar").path
        service.addDependency(path1)
        var classpath = service.getClasspath()
        classpath should endWith("postgresql-42.1.4.jar")
        // Add a second jar file
        val path2 = javaClass.classLoader.getResource("jd-gui-1.4.0.jar").path
        service.addDependency(path2)
        classpath = service.getClasspath()
        classpath should haveSubstring("postgresql-42.1.4.jar:")
        classpath should endWith("jd-gui-1.4.0.jar")
        // Add a class directory
        service.addClassDirectory("/home/mark/classes")
        classpath = service.getClasspath()
        classpath should startWith("/home/mark/classes:")
        classpath should endWith("jd-gui-1.4.0.jar")
    }
}