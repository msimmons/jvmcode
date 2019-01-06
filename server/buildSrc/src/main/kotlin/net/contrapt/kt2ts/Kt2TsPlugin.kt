package net.contrapt.kt2ts

import org.gradle.api.Plugin
import org.gradle.api.Project
import java.io.File

open class Kt2TsPlugin : Plugin<Project> {

    override fun apply(project: Project) {

        // Extension Propertions
        val extension = Kt2TsExtension()
        extension.outDir = project.buildDir.absolutePath + File.separator + "kt2ts"
        project.extensions.add("k2ts", extension)

        // Tasks
        project.tasks.create("kt2ts", GenerateTask::class.java)

    }
}