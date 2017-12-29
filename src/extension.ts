'use strict';

import * as vscode from 'vscode';
import { JvmServer } from './jvm_server'
import { connect } from 'tls';
import { OutputChannel } from 'vscode';

let server: JvmServer

export function activate(context: vscode.ExtensionContext) {

    /** - Start and manage the JVM vertx server -- one server per workspace */
    if (!server) {
        server = new JvmServer(context)
        server.start()
    }

    let startCommand = vscode.commands.registerCommand("jvmcode.start", () => {
        server = new JvmServer(context)
        server.start()
    });

    let echoCommand = vscode.commands.registerCommand("jvmcode.echo", () => {
        vscode.window.showInputBox().then((message) => {
            if (message) {
                server.send('jvmcode.echo', { message: message }).then((reply) => {
                    vscode.window.showInformationMessage('Got reply: ' + JSON.stringify(reply['body']))
                }).catch((error) => {
                    vscode.window.showErrorMessage('Got error: ' + error.message)
                })
            }
        })
    });

    let stopCommand = vscode.commands.registerCommand('jvmcode.stop', () => {
        server.shutdown()
        server = null
    })

    context.subscriptions.push(startCommand, echoCommand, stopCommand);

    /* Export an api for use by other extensions */
    let api = {
        // Send message to the given address
        send(address: string, message: object): Promise<object> {
            return server.send(address, message);
        },
        // Install the given verticle
        install(jarFiles: string[], verticleName: string): Promise<object> {
            return server.install(jarFiles, verticleName);
        },
        // Serve static content at the given path from the given webRoot (absolute)
        serve(path: string, webRoot: string) {
            return server.serve(path, webRoot);
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