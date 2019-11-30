package net.contrapt.jvmcode.model

/**
 * The result of a compilation
 * @property diagnostics A collection of diagnostics
 */
interface CompileResult {
    val diagnostics: Collection<Diagnostic>
}
