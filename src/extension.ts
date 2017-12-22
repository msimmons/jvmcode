'use strict';

import * as vscode from 'vscode';
import { JvmServer } from './jvm_server'
import { connect } from 'tls';
import { OutputChannel } from 'vscode';

let server: JvmServer

export function activate(context: vscode.ExtensionContext) {

    /** - Start and manage the JVM vertx server -- one server per workspace */
    if ( !server ) {
        server = new JvmServer(context)
        server.start()
    }
    
    // - Use the JS event bus bridge to publish/subscribe to event bus
    // - Be able to install verticles as JVM extensions
    //   - Gradle integration
    //   - JDBC integration
    //   - Classpath and class info
    // - Used by other extensions to access JVM resources (via exposed API?)
    //   - Language extensions
    //   - DB extension
    let startCommand = vscode.commands.registerCommand("jvmcode.start", () => {
        server = new JvmServer(context)
        server.start()
    });

    let sendTo = vscode.commands.registerCommand("jvmcode.sendTo", () => {
        server.sendCommand()
    });

    let installCommand = vscode.commands.registerCommand("jvmcode.install", () => {
        server.installCommand()
    });
    context.subscriptions.push(startCommand, installCommand, sendTo);

    /* Export an api for use by other extensions */
    let api = {
        // Send message to the given address
        send(address: string, message: object) : Promise<object> {
            return server.send(address, message);
        },
        // Install the given verticle
        install(jarFiles: string[], verticleName: string) : Promise<object> {
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