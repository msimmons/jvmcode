import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter, ThemeIcon } from 'vscode'
import { TreeNode } from './models'
import { LanguageController } from './language_controller';

export class LanguageTreeProvider implements TreeDataProvider<TreeNode> {

    public viewId = 'jvmcode.language-tree';
    
    private controller: LanguageController
    private onDidChangeEmitter = new EventEmitter<TreeNode>()

    constructor(controller: LanguageController) {
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