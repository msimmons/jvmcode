'use strict';

import * as vscode from 'vscode'
import { JvmServer } from './jvm_server';

/**
 * Responsible for managing various views related to dependencies
 */
export class StatsController {

    private statusItem : vscode.StatusBarItem

    public constructor() {
    }

    /**
     * Listen to JVM stats messages and update the UI as appropriate
     */
    public registerStatsListener(server: JvmServer) {
        this.statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0)
        this.statusItem.text = '---'
        this.statusItem.show()
        server.registerConsumer('jvmcode.stats', (error, result) => {
            if (error) {
                console.error(error)
            }
            else {
                var freeKB = Math.round(result.body.free/1000)
                var totalKB = Math.round(result.body.total/1000)
                var maxKB = Math.round(result.body.max/1000)
                var pct = Math.round(result.body.total/result.body.max)
                this.statusItem.tooltip = `free: ${freeKB} total: ${totalKB} max: ${maxKB}`
                if (pct < 50) {
                    this.statusItem.color = 'white'
                    this.statusItem.text = `${freeKB}K`
                }
                else if (pct < 80) {
                    this.statusItem.color = 'orange'
                    this.statusItem.text = '$(alert)'
                }
                else {
                    this.statusItem.color = 'red'
                    this.statusItem.text = '$(stop)'
                }
            }
        })

    }
}