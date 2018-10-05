'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server'
import { DependencyTreeProvider } from './dependency_tree_provider';
import { DependencyData, JarEntryNode, JarEntryData } from './models';
import { JarContentProvider } from './jar_content_provider';

let server: JvmServer
let dependencyProvider: DependencyTreeProvider
let contentProvider: JarContentProvider
let statsStatus: vscode.StatusBarItem
let isJvmProject = false

export function activate(context: vscode.ExtensionContext) {

    // Start and manage the JVM vertx server -- one server per workspace
    if (!server) {
        server = new JvmServer(context)
        server.start()
        registerStatsListener()
        registerDependencyListener()
    }

    /**
     * Register a consumer for JVM stats message 
     */
    function registerStatsListener() {
        statsStatus = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
        statsStatus.text = '---'
        statsStatus.show()
        server.registerConsumer('jvmcode.stats', (error, result) => {
            if (error) {
                console.error(error)
            }
            else {
                var freeKB = Math.round(result.body.free/1000)
                var totalKB = Math.round(result.body.total/1000)
                var maxKB = Math.round(result.body.max/1000)
                var pct = Math.round(result.body.total/result.body.max)
                statsStatus.tooltip = `free: ${freeKB} total: ${totalKB} max: ${maxKB}`
                if (pct < 50) {
                    statsStatus.color = 'white'
                    statsStatus.text = `${freeKB}K`
                }
                else if (pct < 80) {
                    statsStatus.color = 'orange'
                    statsStatus.text = '$(alert)'
                }
                else {
                    statsStatus.color = 'red'
                    statsStatus.text = '$(stop)'
                }
            }
        })
    }

    /** 
     * Register a consumer for dependencies coming from
     * the server
     */
    function registerDependencyListener() {
        server.registerConsumer('jvmcode.dependencies', (error, result) => {
            if (error) {
                vscode.window.showErrorMessage(error.message)
            }
            else {
                startJvmProject()
                updateJvmDependencies(result.body.dependencies)
            }
        })
    }

    /**
     * Do the things necessary if this is a JVM project
     * It's a JVM project if
     * - another plugin pushes dependencies to it
     * - the user initiates adding a dependency
     * - the user opens a file? (.java, .kt, .groovy etc?)
     */
    function startJvmProject() {
        if (isJvmProject) return
        dependencyProvider = new DependencyTreeProvider(server)
        vscode.window.registerTreeDataProvider(dependencyProvider.viewId, dependencyProvider)
        contentProvider = new JarContentProvider(context)
        vscode.workspace.registerTextDocumentContentProvider(contentProvider.scheme, contentProvider)
        vscode.commands.executeCommand('setContext', 'jvmcode.context.isJvmProject', true)
        isJvmProject = true
        let configuration = vscode.workspace.getConfiguration('jvmcode')
        let excludes: string[] = configuration.get('excludes')
        server.publish('jvmcode.enable-dependencies', {excludes: excludes})
    }

    /**
     * Respond to updated dependencies by updating the dependency view
     * @param dependencies The updated dependencies
     */
    function updateJvmDependencies(dependencies: DependencyData[]) {
        dependencyProvider.setDependencies(dependencies)
    }

    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.start', () => {
        server = new JvmServer(context)
        server.start()
    }))

    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.echo', () => {
        vscode.window.showInputBox().then((message) => {
            if (message) {
                server.send('jvmcode.echo', { message: message }).then((reply) => {
                    vscode.window.showInformationMessage('Got reply: ' + JSON.stringify(reply.body))
                }).catch((error) => {
                    vscode.window.showErrorMessage('Got error: ' + error.message)
                })
            }
        })
    }))

    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.log-level', () => {
        vscode.window.showQuickPick(['DEBUG', 'INFO', 'WARN', 'ERROR']).then((choice) => {
            if (choice) {
                server.send('jvmcode.log-level', { level: choice }).then((reply) => {
                    vscode.window.showInformationMessage('Set level to: ' + JSON.stringify(reply.body.level))
                }).catch((error) => {
                    vscode.window.showErrorMessage('Unable to set level: ' + error.message)
                })
            }
        })
    }))

    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.stop', () => {
        server.shutdown()
        server = null
    }))

    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.jvm-project', () => {
        startJvmProject()
        server.publish('jvmcode.dependencies', { name: 'foo', value: 'bar' })
    }))

    /**
     * Command to get the content of a jar entry and show it in an editor
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.jar-entry', (entryNode: JarEntryNode) => {
        if (entryNode.content) {
            openJarEntryContent(entryNode, true)
        }
        vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: entryNode.name}, (progess) => {
            return getJarEntryContent(entryNode).then((reply) => {
                entryNode.content = reply.body.text
                openJarEntryContent(entryNode, true)
            }).catch(error => {
                vscode.window.showErrorMessage(error)
            })
        })
    }))

    /**
     * Allows the user to manually enter a jar dependency
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-dependency', () => {
        vscode.window.showOpenDialog({filters: {'Dependency': ['jar']}, canSelectMany: false}).then((jarFile) => {
            if (!jarFile || jarFile.length === 0) return
            let configuration = vscode.workspace.getConfiguration('jvmcode')
            let excludes: string[] = configuration.get('excludes')
            server.publish('jvmcode.add-dependency', {jarFile: jarFile[0]['path'], excludes: excludes})
        })
    }))

    async function getJarEntryContent(entryNode: JarEntryNode) {
        return await server.send('jvmcode.jar-entry', {jarEntry: entryNode})
    }

    /**
     * Open a jar entry's content
     */
    function openJarEntryContent(entryNode: JarEntryNode, preview: boolean) {
        if (!entryNode.content) return
        let uri = vscode.Uri.parse(contentProvider.scheme + '://' + entryNode.dependency + '/' + entryNode.pkg + '/' + entryNode.name)
        vscode.workspace.openTextDocument(uri).then((doc) => {
            contentProvider.update(uri, entryNode)
            vscode.window.showTextDocument(doc, { preview: preview })
        })
    }

    /* Export an api for use by other extensions */
    let api = {
        // Send message to the given address (one consumer with result callback)
        send(address: string, message: object): Promise<object> {
            return server.send(address, message)
        },
        // Publish a message to the given address (multiple consumers, no callback)
        publish(address: string, message: object) {
            server.publish(address, message)
        },
        // Install the given verticle
        install(jarFiles: string[], verticleName: string): Promise<object> {
            return server.install(jarFiles, verticleName)
        },
        // Serve static content at the given path from the given webRoot (absolute)
        serve(path: string, webRoot: string) {
            return server.serve(path, webRoot)
        },
        // Register a consumer
        registerConsumer(address: string, callback) {
            server.registerConsumer(address, callback)
        },
        // Unregister a consumer
        unregisterConsumer(address: string, callback) {
            server.unregisterConsumer(address, callback)
        }
    }
    return api
}


// this method is called when your extension is deactivated
export function deactivate() {
    server.shutdown()
}