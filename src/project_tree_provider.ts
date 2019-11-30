import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter } from 'vscode'
import { TreeNode } from './models'
import { ProjectService } from './project_service';

export class ProjectTreeProvider implements TreeDataProvider<TreeNode> {

    public viewId = 'jvmcode.project-tree';
    
    private service: ProjectService
    private onDidChangeEmitter = new EventEmitter<TreeNode>()

    constructor(service: ProjectService) {
        this.service = service
    }

    public update() {
        this.onDidChangeEmitter.fire(null)
    }

	get onDidChangeTreeData() {
		return this.onDidChangeEmitter.event
	}

    public getTreeItem(element: TreeNode) : TreeItem {
        let item = new TreeItem(element.treeLabel(), TreeItemCollapsibleState.Collapsed)
        if ( element.isTerminal ) {
            item.collapsibleState = TreeItemCollapsibleState.None
            item.command = {title: 'Open Entry', command: 'jvmcode.jar-entry', arguments: [element]}
        }
        return item
    }

    public getChildren(element: TreeNode) : TreeNode[] | Thenable<TreeNode[]> {
        if ( !element ) return this.service.getRootNodes()
        else return element.children()
    }

}