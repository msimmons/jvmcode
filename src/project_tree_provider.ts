import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, ThemeIcon } from 'vscode'
import { TreeNode } from './models'
import { ProjectController } from './project_controller';
import { utimesSync } from 'fs';

export class ProjectTreeProvider implements TreeDataProvider<TreeNode> {

    public viewId = 'jvmcode.project-tree-v2';
    
    private controller: ProjectController
    private onDidChangeEmitter = new EventEmitter<TreeNode>()

    constructor(controller: ProjectController) {
        this.controller = controller
    }

    public update() {
        this.onDidChangeEmitter.fire(null)
    }

	get onDidChangeTreeData() {
		return this.onDidChangeEmitter.event
	}

    public getTreeItem(element: TreeNode) : TreeItem {
        let item = new TreeItem(element.treeLabel(), TreeItemCollapsibleState.Collapsed)
        item.contextValue = element.context
        item.tooltip = element.tooltip
        item.description = element.tooltip
        item.iconPath = ThemeIcon.Folder
        if ( element.isTerminal ) {
            item.iconPath = ThemeIcon.File
            item.collapsibleState = TreeItemCollapsibleState.None
        }
        return item
    }

    public getChildren(element: TreeNode) : TreeNode[] | Thenable<TreeNode[]> {
        if ( !element ) return this.controller.getRootNodes()
        else return this.controller.getChildren(element)
    }

}