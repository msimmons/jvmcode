'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server'
import { JarEntryNode, dependencyLabel, CompilationContext } from './models';
import { ProjectService } from './project_service';
import { ProjectController } from './project_controller';
import { StatsController } from './stats_controller';
import { LanguageService } from './language_service';
import { LanguageController } from './language_controller';

export let server: JvmServer
export let projectService: ProjectService
export let projectController: ProjectController
export let languageService: LanguageService
export let languageController: LanguageController
let statsController: StatsController
export let extensionContext: vscode.ExtensionContext

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context

    // Start and manage the JVM vertx server -- one server per workspace
    if (!server) {
        server = new JvmServer(context)
        server.start()
        projectService = new ProjectService(context, server)
        projectController = new ProjectController(context, projectService)
        languageService = new LanguageService(server)
        languageController = new LanguageController(projectService, languageService)
        languageController.start()
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
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.find-class', async () => {
        await projectController.start() // TODO This won't work correctly first time -- async timing
        projectController.findClass()
    }))

    /**
     * Command to get the content of a jar entry and show it in an editor
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.jar-entry', (entryNode: JarEntryNode) => {
        projectController.openJarEntry(entryNode)
    }))

    /**
     * Allows the user to manually enter a jar dependency
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-dependency', () => {
        projectController.start()
        projectController.addDependency()
    }))

    /**
     * Allows the user to manually enter a class directory
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-classdir', () => {
        projectController.start()
        projectController.addClassDir()
    }))

    /**
     * Allows the user to manually enter a source directory
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-sourcedir', () => {
        projectController.start()
        projectController.addSourceDir()
    }))

    /**
     * Return the classpath as a string (mostly for use in tasks)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.classpath', () : string => {
        projectController.start()
        return projectService.getClasspath()
    }))

    /**
     * Return the fqcn of the current file (for use in tasks)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.fqcn', () : string => {
        projectController.start()
        return projectController.getFQCN()
    }))

    /**
     * Allow the user to execute the given main application class
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.exec-class', () => {
        projectController.start()
        let classes = projectService.getClasses().map((c) => {return c.pkg + '.' + c.name})
        vscode.window.showQuickPick(classes).then((mainClass) => {
            if (!mainClass) return
            let cp = projectService.getClasspath()
            let def = {type: 'jvmcode'} as vscode.TaskDefinition
            let args = cp ? ['-cp', cp] : []
            args = args.concat([mainClass])
            let exec = new vscode.ProcessExecution('/usr/bin/java', args, {})
            let task = new vscode.Task(def, vscode.workspace.workspaceFolders[0], mainClass, 'jvmcode', exec, [])
            vscode.tasks.executeTask(task)
        })
    }))

    /* Export an api for use by other extensions */
    let api = {
        // Send message to the given address (one consumer with result callback)
        send(address: string, message: object): Promise<any> {
            return server.send(address, message)
        },
        // Publish a message to the given address (multiple consumers, no callback)
        publish(address: string, message: object) {
            server.publish(address, message)
        },
        // Install the given verticle
        install(jarFiles: string[], verticleName: string): Promise<any> {
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