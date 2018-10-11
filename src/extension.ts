'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server'
import { JarEntryNode } from './models';
import { DependencyService } from './dependency_service';
import { DependencyController } from './dependency_controller';
import { StatsController } from './stats_controller';

let server: JvmServer
let dependencyService: DependencyService
let dependencyController: DependencyController
let statsController: StatsController

export function activate(context: vscode.ExtensionContext) {

    // Start and manage the JVM vertx server -- one server per workspace
    if (!server) {
        server = new JvmServer(context)
        server.start()
        dependencyService = new DependencyService(context, server)
        dependencyController = new DependencyController(dependencyService)
        dependencyController.registerDependencyListener()
        statsController = new StatsController()
        statsController.registerStatsListener(server)
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

    // Possibly deprecated
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.jvm-project', () => {
        dependencyController.start()
    }))

    /**
     * Allow the user to find any class in the projects current dependencies
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.find-class', () => {
        vscode.window.createQuickPick()
    }))

    /**
     * Command to get the content of a jar entry and show it in an editor
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.jar-entry', (entryNode: JarEntryNode) => {
        dependencyController.openJarEntry(entryNode)
    }))

    /**
     * Allows the user to manually enter a jar dependency
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-dependency', () => {
        vscode.window.showOpenDialog({filters: {'Dependency': ['jar']}, canSelectMany: false}).then((jarFile) => {
            if (!jarFile || jarFile.length === 0) return
            dependencyService.addDependency(jarFile[0]['path'])
        })
    }))

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