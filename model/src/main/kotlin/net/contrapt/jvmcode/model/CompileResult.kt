package net.contrapt.jvmcode.model

/**
 * The result of a compilation
 * @property diagnostics A collection of diagnostics
 */
interface CompileResult {
    val name: String
    val languageId: String
    val diagnostics: Collection<Diagnostic>
}
