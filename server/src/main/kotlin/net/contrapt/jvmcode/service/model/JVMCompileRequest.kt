package net.contrapt.jvmcode.service.model

import net.contrapt.jvmcode.model.CompileRequest

data class JVMCompileRequest(
    override val languageId: String,
    override val name: String,
    override val files: Collection<String>,
    override val outputDir: String,
    override val classpath: String,
    override val sourcepath: String
) : CompileRequest
