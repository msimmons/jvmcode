import * as vscode from 'vscode'
import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter } from 'vscode'
import { DependencyData, DependencyNode, JarPackageNode, TreeNode } from './models'
import { ProjectService } from './project_service';

export class DependencyTreeProvider implements TreeDataProvider<TreeNode> {

    public viewId = 'jvmcode.dependency-tree';
    
    private service: ProjectService
    private dependencies: DependencyNode[]
    private onDidChangeEmitter = new EventEmitter<TreeNode>()

    constructor(service: ProjectService) {
        this.service = service
    }

    public clearDependencies() {
        this.dependencies = []
        this.onDidChangeEmitter.fire(null)
    }

    public setDependencies(dependencies: DependencyData[]) {
        if (!dependencies) {
            return
        }
        this.dependencies = dependencies.filter((d) => { return !d.transitive }).map((d) => {
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
            item.command = {title: 'Open Entry', command: 'jvmcode.jar-entry', arguments: [element]}
        }
        return item
    }

    public getChildren(element: TreeNode) : TreeNode[] | Thenable<TreeNode[]> {
        if ( !element ) return this.dependencies
        else if ( element.type === 'dependency' ) return this.getPackageNodes(element as DependencyNode)
        else if ( element.type === 'package' ) return (element as JarPackageNode).entries
    }

    private async getPackageNodes(dependency: DependencyNode) : Promise<JarPackageNode[]> {
        try {
            let packages = await this.service.getPackages(dependency.data)
            return packages.map((pkgData) => { return new JarPackageNode(dependency, pkgData) })
        }
        catch(error) {
            vscode.window.showErrorMessage(error.message)
            return []
        }
    }

}