package net.contrapt.jvmcode.model

/**
 * A compilation diagnostic message
 * @property file Absolute file path
 * @property line The line number in the file
 * @property column The column number
 * @property message The diagnostic message
 * @property severity The severity of the problem
 */
interface Diagnostic {
    val file: String
    val line: Long
    val column: Long
    val message: String
    val severity: String
}