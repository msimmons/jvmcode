'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server'
import { JarEntryNode, dependencyLabel, CompilationContext } from './models';
import { ProjectService } from './project_service';
import { ProjectController } from './project_controller';
import { StatsController } from './stats_controller';
import { ClasspathData } from 'server-models';
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
        projectController = new ProjectController(projectService)
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
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.find-class', () => {
        projectController.start() // TODO This won't work correctly first time -- async timing
        let jarEntries = projectService.getJarEntryNodes()
        let classes = projectService.getClasses()
        Promise.all([jarEntries]).then((results) => {
            let quickPick = vscode.window.createQuickPick()
            let classItems = classes.map((c) => {
                return { label: c.name, detail: c.pkg, entry: c } as vscode.QuickPickItem
            })
            let jarItems = results[0].map((r) => {
                let detail = r.data.pkg + ' (' + dependencyLabel(r.dependency) + ')'
                return { label: r.name, detail: detail, entry: r } as vscode.QuickPickItem
            })
            quickPick.items = classItems.concat(jarItems)
            quickPick.onDidAccept(selection => {
                quickPick.dispose()
                if (quickPick.selectedItems.length) {
                    projectController.openJarEntry(quickPick.selectedItems[0]['entry'])
                }
            })
            quickPick.onDidChangeSelection(selection => {
                //console.log(`change ${selection}`)
            })
            quickPick.onDidChangeActive(event => {
                //console.log(`active ${event} ${quickPick.activeItems}`)
            })
            quickPick.show()
        })
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
        vscode.window.showOpenDialog({filters: {'Dependency': ['jar']}, canSelectMany: false}).then((jarFile) => {
            if (!jarFile || jarFile.length === 0) return
            projectService.addDependency(jarFile[0]['path'])
        })
    }))

    /**
     * Allows the user to manually enter a class directory
     */
    context.subscriptions.push(vscode.commands.registerCommand('jvmcode.add-classdir', () => {
        projectController.start()
        vscode.window.showInputBox({placeHolder: 'Class directory'}).then((classDir) => {
            if (!classDir) return
            projectService.addClassDirectory(classDir)
        })
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