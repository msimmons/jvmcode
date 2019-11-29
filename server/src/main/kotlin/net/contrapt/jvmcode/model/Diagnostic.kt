package net.contrapt.jvmcode.model

import java.util.*
import javax.tools.Diagnostic
import javax.tools.JavaFileObject

data class Diagnostic(
        val file: String,
        val line: Long,
        val column: Long,
        val message: String,
        val severity: String
) {
    val source = "javac"

    companion object {

        fun from(javacDiagnostic: Diagnostic<out JavaFileObject>): net.contrapt.jvmcode.model.Diagnostic {
            val file = javacDiagnostic.source.name
            val line = javacDiagnostic.lineNumber
            val column = javacDiagnostic.columnNumber
            val message = javacDiagnostic.getMessage(Locale.getDefault())
            val severity = javacDiagnostic.kind.name
            return Diagnostic(file, line, column, message, severity)
        }
    }
}
