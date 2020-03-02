package net.contrapt.jvmcode.model

/**
 * Request sent by language provider to indicate it is ready to handle the given language
 *
 * @property name The name of the provider
 * @property languageId The languageId it supports
 * @property extensions The file extensions for source code
 * @property imports Auto-imports for the language
 * @property triggerChars list of completion trigger chars
 */
interface LanguageRequest {
    val name: String
    val languageId: String
    val extensions: Collection<String>
    val imports: Collection<String>
    val triggerChars: Collection<String>
}
