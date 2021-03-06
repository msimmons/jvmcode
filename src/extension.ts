'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server'
import { JarEntryNode, TreeNode, LanguageNode, ClassDataNode } from './models'
import { ProjectService } from './project_service'
import { ProjectController } from './project_controller'
import { StatsController } from './stats_controller'
import { LanguageService } from './language_service'
import { LanguageController } from './language_controller'
import { JUnitController } from './junit_controller'
import { ConfigService } from './config_service'
import { IconService } from './icon_service';

export let server: JvmServer
export let projectService: ProjectService
export let projectController: ProjectController
export let languageService: LanguageService
export let languageController: LanguageController
let junitController: JUnitController
let statsController: StatsController
export let extensionContext: vscode.ExtensionContext // Allows test to access the context?
export let iconService: IconService

export function activate(context: vscode.ExtensionContext) {
    extensionContext = context
    iconService = new IconService(context)

    // Start and manage the JVM vertx server -- one server per workspace
    if (!server) {
        server = new JvmServer(context)
        server.start()
        projectService = new ProjectService(server)
        projectController = new ProjectController(context, projectService)
        junitController = new JUnitController(projectController)
        context.subscriptions.push(junitController)
        // We don't start the project controller or junit controller unless we get a request or there are user items
        languageService = new LanguageService(server)
        languageController = new LanguageController(languageService, projectController)
        context.subscriptions.push(languageController)
        languageController.start()
        statsController = new StatsController(server)
        statsController.start()
    }

    //
    // Register all the commands below
    //

    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.start', () => {
        server = new JvmServer(context)
        server.start()
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
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.find-class', async () => {
        projectController.findClass()
    }))

    /**
     * Command to get the content of a jar entry and show it in an editor
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.open-source', (entryNode: JarEntryNode) => {
        if (!entryNode) return
        projectController.openJarEntry(entryNode)
    }))

    /**
     * Command to get the ClassData of a jar entry and show it in an editor
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.open-class', (entryNode: JarEntryNode) => {
        if (!entryNode) return
        projectController.openJarEntry(entryNode, true)
    }))

    /**
     * Command to open ClassData of a local class and show it in an editor
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.open-local-class', (classNode: ClassDataNode) => {
        if (!classNode) return
        projectController.openClassNode(classNode)
    }))

    /**
     * Allows the user to manually enter a jar dependency
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-dependency', () => {
        projectController.addDependency()
    }))

    /**
     * Allows the user to manually enter path infor (source -> class directories)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-user-path', () => {
        projectController.addUserPath()
    }))

    /**
     * Allows removal of a user specified path or dependency (from the project view)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.remove-user-item', (event) => {
        if (!event) return
        projectController.removeUserItem(event as TreeNode)
    }))

    /**
     * Return the classpath as a string (mostly for use in tasks)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.classpath', () : string => {
        return projectController.getClasspath()
    }))

    /**
     * Return the fqcn of the current file (for use in tasks)
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.fqcn', () : string => {
        return projectController.getCurrentFqcn()
    }))

    /**
     * Clear diagnostics for the given languageId
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.clear-problems', (event) => {
        if (!event) return
        languageController.clearProblems((event as LanguageNode).request.name)
    }))

    /**
     * Allow the user to execute the given main application class
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.exec-class', async () => {
        let classData = await projectController.getClassData()
        let classes = classData.filter(cd => cd.methods.find(m => m.isMain)).map(c => c.name)
        vscode.window.showQuickPick(classes).then((mainClass) => {
            if (!mainClass) return
            let cp = projectController.getClasspath()
            let cmd = ConfigService.getJavaCommand()
            let def = {type: 'jvmcode'} as vscode.TaskDefinition
            let args = cp ? ['-cp', cp] : []
            args = args.concat([mainClass])
            let exec = new vscode.ProcessExecution(cmd, args, {})
            let task = new vscode.Task(def, vscode.workspace.workspaceFolders[0], mainClass, 'jvmcode', exec, [])
            vscode.tasks.executeTask(task)
        })
    }))

    /**
     * Test a customexecution task
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.exec-custom', () => {
        vscode.window.showQuickPick(['foo', 'bar']).then((choice) => {
            if (!choice) return
            let def = {type: 'jvmcode'} as vscode.TaskDefinition
            const writeEmitter = new vscode.EventEmitter<string>();
            const closeEmitter = new vscode.EventEmitter<any>();
            const pty: vscode.Pseudoterminal = {
              onDidWrite: writeEmitter.event,
              onDidClose: closeEmitter.event,
              open: () => {
                  writeEmitter.fire(choice)
                  writeEmitter.fire('\nDoing stuff\n')
                  setTimeout(() => { closeEmitter.fire() }, 1000)
              },
              close: () => { console.log('Closed')}
            };
            let exec = new vscode.CustomExecution(async () => {
                return pty
            })
            let task = new vscode.Task(def, vscode.workspace.workspaceFolders[0], choice, 'jvmcode', exec, [])
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
export async function deactivate() {
    languageController.dispose()
    junitController.dispose()
    await server.shutdown()
}