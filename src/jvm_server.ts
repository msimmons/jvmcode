'use strict';

import * as vscode from 'vscode'
import { ChildProcess, spawn } from 'child_process'
import { OutputChannel } from 'vscode'
import { setTimeout } from 'timers'
import * as EventBus from 'vertx3-eventbus-client'
import { ConfigService } from './config_service';

let makeUUID = require('node-uuid').v4;


enum Status {
    STOPPED,
    STARTING,
    STARTED,
    STOP_REQUESTED
}

export class JvmServer {

    private context: vscode.ExtensionContext
    private port: number
    private child : ChildProcess
    private bus
    private startupToken : string
    private status: Status = Status.STOPPED
    private channel: OutputChannel
    // An array of registered consumers that should be re-registred on reconnect
    private registeredConsumers: {address: string, callback: any}[] = []

    public constructor(context: vscode.ExtensionContext) {
        this.context = context
        this.startupToken = makeUUID()
        this.channel = vscode.window.createOutputChannel('JVMCode')
    }

    public start() {
        this.startServer()
    }

    private startServer() {
        if ( this.status != Status.STOPPED ) return;
        vscode.window.setStatusBarMessage('Starting JVM server', 1000);
        this.status = Status.STARTING;
        // Setup command line and arguments for starting the server
        let configuration = vscode.workspace.getConfiguration('jvmcode')
        let command : string = configuration.get('javaCommand')
        let options : string[] = configuration.get('javaOptions')
        let logLevel : string = configuration.get('logLevel')
        let jarFile = this.context.asAbsolutePath('out/jvmcode.jar')
        let cacheDirOpt = '-Dvertx.cacheDirBase=' + this.context.extensionPath + '.vertx'
        let args = options.concat([cacheDirOpt, '-jar', jarFile, logLevel, this.startupToken])
        this.child = spawn(command, args)

        // Write blob of configuration to stdin
        let config = ConfigService.getConfig()
        this.child.stdin.write(JSON.stringify(config) + '\n')
    
        // Setup event handlers
        this.child.on('error', this.handleServerErrorCallback);
        this.child.on('exit', this.handleServerExitCallback);
        this.child.on('close', this.handleServerExitCallback);
        this.child.stderr.on('data', this.checkServerStartedCallback)
        this.child.stdout.on('data', this.checkServerStartedCallback)
    }

    /**
     * Send given message to given address returning a Promise of the reply object
     * @param address 
     * @param message 
     */
    public send(address: string, message: object) : Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.sendInternal(address, message, resolve, reject)
        })
    }

    public publish(address: string, message: object) {
        this.publishInternal(address, message)
    }

    private busNotReady() : boolean {
        return (!this.bus || this.bus.state != EventBus.OPEN)
    }

    /**
     * Wait for the bus to be up to send
     */
    private sendInternal = (address: string, message: object, resolve, reject) => {
        if (this.busNotReady()) {
            setTimeout(this.sendInternal, 100, address, message, resolve, reject)
            return
        }
        this.bus.send(address, message, (error, result) => {
            if ( error ) {
                reject(error)
            }
            else {
                resolve(result)
            }
        })
    }

    /**
     * Wait for the bus to be up to publish
     */
    private publishInternal = (address: string, message: object) => {
        if (this.busNotReady()) {
            setTimeout(this.publishInternal, 100, address, message)
            return
        }
        this.bus.publish(address, message)
    }

    /**
     * Register a consumer at the given address
     * The supplied callback should handle (error?, result?) where the error object has the following structure:
     *    { failureCode: failureCode, failureType: failureType, message: message }
     * 
     * @param address The address to consume from
     * @param callback The function(error?, result?) to call when a message arrives
     */
    public registerConsumer = (address: string, callback) => {
        if (this.busNotReady()) {
            setTimeout(this.registerConsumer, 100, address, callback)
            return
        }
        this.bus.registerHandler(address, {}, callback)
        this.registeredConsumers.push({address: address, callback: callback})
        console.log(`Consumer registered at ${address} by ${this.context.extensionPath}`)
    }

    private reRegisterConsumers = () => {
        this.registeredConsumers.forEach(rc => {
            this.bus.registerHandler(rc.address, rc.callback)
            console.log(`Consumer re-registered at ${rc.address} by ${this.context.extensionPath}`)
        })
    }

    /**
     * Unregister the consumer at the given address
     * @param address The address to stop consuming from
     * @param callback The callback that was initially registered (there can be more than one per address)
     */
    public unregisterConsumer = (address: string, callback) => {
        this.bus.unregisterHandler(address, callback)
        this.registeredConsumers = this.registeredConsumers.filter(rc => !(rc.address===address && rc.callback===callback))
        console.log(`Consumer unregistered from ${address} by ${this.context.extensionPath}`)
    }

    public sendCommand() {
        vscode.window.showInputBox().then((address) => {
            if ( address ) {
                vscode.window.showInputBox().then((message) => {
                    if ( message ) this.send(address, {message: message}).then((reply) => {
                        this.channel.appendLine(JSON.stringify(reply))
                    }).catch((error) => {
                        this.channel.appendLine(JSON.stringify(error))
                    })
                })
            }
        })
    }

    /**
     * Install the given verticle
     * @param jarFiles List of jars needed to install the verticle
     * @param verticleName The full classname of the verticle to deploy
     */
    public install(jarFiles: string[], verticleName: string) : Promise<any> {
        let reply = this.send('jvmcode.install', {jarFiles: jarFiles, verticleName: verticleName})
        reply.then((message) => {
            this.channel.appendLine(JSON.stringify(message))
        }).catch((error) => {
            vscode.window.showErrorMessage('Error installing: ' + error['message'])
        })
        return reply
    }

    public installCommand() {
        vscode.window.showInputBox().then((jarAnswer) => {
            if ( jarAnswer ) {
                vscode.window.showInputBox().then((classAnswer) => {
                    if ( classAnswer ) this.install([jarAnswer], classAnswer)
                })
            }
        })
    }

    /**
     * Serve static content
     * @param path The http path to serve
     * @param webRoot The absolute path to the static content
     * @returns {port: <httpPort>} or error
     */
    public serve(path: string, webRoot: string) : Promise<any> {
        return this.send('jvmcode.serve', {path: path, webRoot: webRoot})
    }

    public shutdown() {
        this.status = Status.STOP_REQUESTED
        let reply = this.send('jvmcode.shutdown', {value: this.startupToken})
        this.child.kill('SIGHUP')
        this.channel.clear()
        this.channel.hide()
        this.channel.dispose()
        reply.then((message) => {
            console.log(JSON.stringify(message))
        })
    }

    private restart() {
        if ( this.status != Status.STOPPED ) return;
        this.child = null;
        this.bus = null;
        this.channel.appendLine('Restarting JVM server...');
        this.startServer();
    }

    private handleServerErrorCallback = (err, signal) => {
        this.channel.appendLine(err);
    }

    private handleServerExitCallback = (err, signal) => {
        this.channel.appendLine('Server exited with ' + err + ' ' + signal);
        this.child = null
        this.bus = null
        this.status = Status.STOPPED
    }

    private checkServerStartedCallback = (data) => {
        let line = data.toString()
        if ( line.includes(this.startupToken) ) {
            this.channel.appendLine(line)
            this.status = Status.STARTED;
            let parts = line.split(':')
            this.port = Number(parts[parts.length-1].trim())
            this.startEventBus()
        }
        else if ( this.channel ) {
            this.channel.appendLine(line)
        }
        else { 
            console.log(line)
        }
    }

    /**
     * Registers a handler for any unhandled exception messages returned from the server
     * Display them in an error notification
     */
    private listenForUnhandledException() {
        this.registerConsumer('jvmcode.exception', (error, result) => {
            if (result) {
                vscode.window.showErrorMessage('JVMCode: ' + result.body.message)
            } else if (error) {
                vscode.window.showErrorMessage('JVMCode: ' + error.message)
            }
        })
    }

    private startEventBus() {
        if ( this.bus ) return;
        let url = 'http://localhost:'+this.port+'/jvmcode/ws/'
        this.channel.appendLine('Starting event bus at '+url)
        this.bus = new EventBus(url)
        this.bus.enableReconnect(true)
        this.bus.onopen = () => {
            this.channel.appendLine('Started event bus on ' + this.port)
            this.listenForUnhandledException()
        }
        this.bus.onerror = (err) => {
            this.channel.appendLine('Error starting event bus: ' + err)
        }
        this.bus.onreconnect = () => {
            this.channel.appendLine('Reconnecting to ' + this.port)
            this.reRegisterConsumers()
        }
    }

}