import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, EventEmitter } from 'vscode'
import { DependencyNode, JarPackageNode, TreeNode, NodeType, DependencySourceNode } from './models'
import { ProjectService } from './project_service';

export class DependencyTreeProvider implements TreeDataProvider<TreeNode> {

    public viewId = 'jvmcode.dependency-tree';
    
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
        if ( element.type === NodeType.CLASS || element.type === NodeType.RESOURCE) {
            item.collapsibleState = TreeItemCollapsibleState.None
            item.command = {title: 'Open Entry', command: 'jvmcode.jar-entry', arguments: [element]}
        }
        return item
    }

    public getChildren(element: TreeNode) : TreeNode[] | Thenable<TreeNode[]> {
        if ( !element ) return this.service.getSourceNodes()
        else if ( element.type === NodeType.SOURCE ) return (element as DependencySourceNode).dependencies
        else if ( element.type === NodeType.DEPENDENCY ) return this.service.getPackageNodes(element as DependencyNode)
        else if ( element.type === NodeType.PACKAGE ) return (element as JarPackageNode).entries
    }

}