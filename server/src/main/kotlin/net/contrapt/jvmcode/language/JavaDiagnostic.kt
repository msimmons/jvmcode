package net.contrapt.jvmcode.language

import net.contrapt.jvmcode.model.Diagnostic
import java.util.*

import javax.tools.JavaFileObject

data class JavaDiagnostic(
    override val file: String,
    override val line: Long,
    override val column: Long,
    override val message: String,
    override val severity: String
) : Diagnostic {
    val source = "javac"

    companion object {

        fun from(javacDiagnostic: javax.tools.Diagnostic<out JavaFileObject>): JavaDiagnostic {
            val file = javacDiagnostic.source.name
            val line = javacDiagnostic.lineNumber
            val column = javacDiagnostic.columnNumber
            val message = javacDiagnostic.getMessage(Locale.getDefault())
            val severity = javacDiagnostic.kind.name
            return JavaDiagnostic(file, line, column, message, severity)
        }
    }
}
