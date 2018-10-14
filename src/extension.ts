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
        statsController = new StatsController(server)
    }

    //
    // Register all the commands below
    //

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

    /**
     * Allow the user to find any class in the projects current dependencies
     * Maybe show local project classes first, if no match, show dependency classes (possibly pre-filtered)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.find-class', () => {
        dependencyController.start() // This won't work correctly first time.
        dependencyService.getJarEntries().then((result) => {
            let quickPick = vscode.window.createQuickPick()
            let items = result.map((r) => { 
                return { label: r.name, detail: r.pkg } as vscode.QuickPickItem
            })
            quickPick.items = items
            quickPick.show()
        })
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

    /**
     * Allows the user to manually enter a class directory
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-classdir', () => {
        vscode.window.showInputBox({placeHolder: 'Class directory'}).then((classDir) => {
            if (!classDir) return
            dependencyService.addClassDirectory(classDir)
        })
    }))

    /**
     * Allow the user to execute the given main application class
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.exec-class', () => {
        vscode.window.showInputBox({placeHolder: "Enter FQCN for main class"}).then((mainClass) => {
            if (!mainClass) return
            let classpath = dependencyService.getClasspath()
            classpath.then((cp) => {
                let configuration = vscode.workspace.getConfiguration('jvmcode')
                let command : string = configuration.get('javaCommand')
                let terminal = vscode.window.createTerminal({name: mainClass, env: {}})
                terminal.sendText(`${command} -cp ${cp} ${mainClass}`, true)
                terminal.show()
            })
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