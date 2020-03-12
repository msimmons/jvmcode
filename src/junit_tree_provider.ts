import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, ThemeIcon } from 'vscode'
import { TreeNode } from './models'
import { ProjectController } from './project_controller';
import { JUnitController } from './junit_controller';

export class JUnitTreeProvider implements TreeDataProvider<TreeNode> {

    public viewId = 'jvmcode.junit-tree';
    
    private controller: JUnitController
    private onDidChangeEmitter = new EventEmitter<TreeNode>()

    constructor(controller: JUnitController) {
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
        item.iconPath = element.icon ? element.icon : ThemeIcon.Folder
        if ( element.isTerminal ) {
            item.iconPath = element.icon ? element.icon : ThemeIcon.File
            item.collapsibleState = TreeItemCollapsibleState.None
        }
        if ( element.isOpenable ) {
            // Add a menu item to open the test .xml file
        }
        return item
    }

    public getChildren(element: TreeNode) : TreeNode[] | Thenable<TreeNode[]> {
        if ( !element ) return this.controller.getRootNodes()
        else return this.controller.getChildren(element)
    }

}