package net.contrapt.jvmcode.service

import io.kotlintest.matchers.beGreaterThan
import io.kotlintest.matchers.endWith
import io.kotlintest.matchers.haveSubstring
import io.kotlintest.matchers.numerics.shouldBeGreaterThan
import io.kotlintest.matchers.startWith
import io.kotlintest.should
import io.kotlintest.shouldBe
import io.kotlintest.shouldNotBe
import io.vertx.core.json.Json
import net.contrapt.jvmcode.model.ClassEntryData
import net.contrapt.jvmcode.model.JarEntryType
import net.contrapt.jvmcode.model.JvmConfig
import net.contrapt.jvmcode.service.model.DependencySource
import net.contrapt.jvmcode.service.model.UserPath
import org.junit.jupiter.api.Assumptions.assumeTrue
import org.junit.jupiter.api.Test
import java.io.File

class ProjectServiceTest {

    val javaHomeSys = System.getProperty("java.home").replace("${File.separator}jre", "")
    val javaHome11 = "/usr/lib/jvm/java-11-openjdk-amd64"
    val symbolRepository = SymbolRepository()
    val parseService = ParseService(symbolRepository)

    @Test
    fun systemJdkTest() {
        assumeTrue(File(javaHomeSys).exists())
        val config = JvmConfig(setOf(), setOf("java"), setOf(), setOf("java.base", "java.sql"))
        val service = ProjectService(config, javaHomeSys, symbolRepository)
        val project = service.getJvmProject()
        project.dependencySources.size shouldBe 2 // System and User
        val depSource = project.dependencySources.first()
        depSource.source shouldBe DependencySource.SYSTEM
        depSource.dependencies.size shouldBeGreaterThan  0
        val depData = depSource.dependencies.first()
        val jarEntries = service.indexJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        val resourceEntry = jarEntries.packages.first().entries.first()
        service.resolveJarEntrySource(depData.fileName, resourceEntry.fqcn) shouldBe resourceEntry
        val classEntry = jarEntries.packages.first { it.name == "java.lang" }.entries.first { it.type == JarEntryType.CLASS }
        val javaEntry = service.resolveJarEntrySource(depData.fileName, classEntry.fqcn)
        if (File(depData.sourceFileName ?: "").exists()) {
            (javaEntry as ClassEntryData).srcEntry shouldNotBe null
        }
    }

    @Test
    fun systemJdkTest11() {
        assumeTrue(File(javaHome11).exists())
        val config = JvmConfig(setOf(), setOf("java"), setOf(), setOf("java.base", "java.sql"))
        val service = ProjectService(config, javaHome11, symbolRepository)
        val project = service.getJvmProject()
        project.dependencySources.size shouldBe 2 // System and User
        val depSource = project.dependencySources.first()
        depSource.source shouldBe DependencySource.SYSTEM
        depSource.dependencies.size shouldBe 2
        val depData = depSource.dependencies.first()
        val jarEntries = service.indexJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        val resourceEntry = jarEntries.packages.first().entries.first()
        val resolved = service.resolveJarEntrySource(depData.fileName, resourceEntry.fqcn)
        resolved shouldBe resourceEntry
        val classEntry = jarEntries.packages.first { it.name == "java.lang" }.entries.first { it.type == JarEntryType.CLASS }
        val javaEntry = service.resolveJarEntrySource(depData.fileName, classEntry.fqcn)
        if (File(depData.sourceFileName ?: "").exists()) {
            (javaEntry as ClassEntryData).srcEntry shouldNotBe null
        }
    }

    @Test
    fun systemJdkWithExcludesTest() {
        assumeTrue(File(javaHomeSys).exists())
        val config = JvmConfig(setOf("com.sun"), setOf("java"), setOf(), setOf("java.base", "java.sql"))
        val service = ProjectService(config, javaHomeSys, symbolRepository)
        val deps = service.getJvmProject().dependencySources
        deps.size shouldBe 2
        val depSource = deps.first()
        val depData = depSource.dependencies.first()
        val jarEntries = service.indexJarData(depData)
        jarEntries.packages.size shouldBe beGreaterThan(0)
        jarEntries.packages.any { pkg -> pkg.name.startsWith("com.sun") } shouldBe false
    }

    @Test
    fun addDependencyTest() {
        assumeTrue(File(javaHomeSys).exists())
        val config = JvmConfig(setOf("com.sun"), setOf("java"), setOf(), setOf("java.base", "java.sql"))
        val service = ProjectService(config, javaHomeSys, symbolRepository)
        val path = javaClass.classLoader?.getResource("postgresql-42.1.4.jar")?.path ?: ""
        service.addUserDependency(path, null)
        val deps = service.getJvmProject().dependencySources
        deps.size shouldBe 2
        val depSource = deps.last()
        val jarData = service.indexJarData(depSource.dependencies.last())
        val pkg = jarData.packages.find { it.name == "META-INF.maven.org.postgresql.postgresql" } // META-INF/maven/org.postgresql/postgresql
        val je = pkg?.entries?.first()
        when (je) {
            null -> {}
            else -> {} //service.getJarEntryContents(je) TODO Fix paths whose components contain '.'
        }
    }

    @Test
    fun getClasspathTest() {
        assumeTrue(File(javaHomeSys).exists())
        val service = ProjectService(JvmConfig(setOf(), setOf(), setOf()), javaHomeSys, symbolRepository)
        val path1 = javaClass.classLoader?.getResource("postgresql-42.1.4.jar")?.path ?: ""
        service.addUserDependency(path1, null)
        var classpath = service.getClasspath()
        classpath should endWith("postgresql-42.1.4.jar")
        // Add a second jar file
        val path2 = javaClass.classLoader?.getResource("jd-gui-1.4.0.jar")?.path ?: ""
        service.addUserDependency(path2, null)
        classpath = service.getClasspath()
        classpath should haveSubstring("postgresql-42.1.4.jar:")
        classpath should endWith("jd-gui-1.4.0.jar")
        // Add a class directory
        service.addUserPath(UserPath("/home/mark/source", "/home/mark/classes", "name"))
        classpath = service.getClasspath()
        classpath should startWith("/home/mark/classes:")
        classpath should endWith("jd-gui-1.4.0.jar")
    }

    @Test
    fun getClassDataTest() {
        assumeTrue(File(javaHome11).exists())
        val service = ProjectService(JvmConfig(setOf(), setOf(), setOf()), javaHome11, symbolRepository)
        val path = UserPath("/home/mark/work/jvmcode/server/src/main/kotlin","/home/mark/work/jvmcode/server/build/classes/kotlin/main", "name")
        service.addUserPath(path)
        val cd = service.getClassData()
        val classcount = cd.data.size
        service.getClassData().data.size shouldBe classcount
    }

}