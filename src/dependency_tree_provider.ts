import * as vscode from 'vscode'
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter } from 'vscode'
import { DependencyData, DependencyNode, JarPackageNode, TreeNode } from './models'
import { JvmServer } from './jvm_server';

export class DependencyTreeProvider implements TreeDataProvider<object> {

    public viewId = 'jvmcode.dependency-tree';
    
    private server: JvmServer
    private dependencies: DependencyNode[]
    private onDidChangeEmitter = new EventEmitter<object>()

    constructor(server: JvmServer) {
        this.server = server
    }

    public clearDependencies() {
        this.dependencies = []
        this.onDidChangeEmitter.fire(null)
    }

    public setDependencies(dependencies: DependencyData[]) {
        if (!dependencies) {
            return
        }
        this.dependencies = dependencies.map((d) => {
            return new DependencyNode(d)
        })
        this.onDidChangeEmitter.fire(null)
    }

	get onDidChangeTreeData() {
		return this.onDidChangeEmitter.event
	}

    public getTreeItem(element: TreeNode) : TreeItem {
        let item = new TreeItem(element.treeLabel(), TreeItemCollapsibleState.Collapsed)
        if ( element.type === 'CLASS' || element.type === 'RESOURCE') {
            item.collapsibleState = TreeItemCollapsibleState.None
            item.command = {title: 'JAR Open Entry', command: 'jvmcode.jar-entry', arguments: [element]}
        }
        return item
    }

    public getChildren(element: TreeNode) : object[] | Thenable<object[]> {
        if ( !element ) return this.dependencies
        else if ( element.type === 'dependency' ) return this.getJarEntries(element as DependencyNode)
        else if ( element.type === 'package' ) return (element as JarPackageNode).entries
    }

    private async getJarEntries(dependency: DependencyNode) : Promise<JarPackageNode[]> {
        try {
            let reply = await this.server.send('jvmcode.jar-entries', {dependency: dependency.data})
            return reply.body.packages.map((jarEntry)=>{ return new JarPackageNode(dependency, jarEntry)})
        }
        catch(error) {
            vscode.window.showErrorMessage(error.message)
            return []
        }
    }

}