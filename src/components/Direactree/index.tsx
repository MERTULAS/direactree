import React from 'react';
import './styles.css';

type IndentSize = number & { __brand: '8 and above' };

function validateIndent(n: number): IndentSize {
  if (n < 8) {
    console.warn('indent is must be 8 and above. 8 will be used automatically.');
    return 8 as IndentSize;
  } else if (n > 50) {
    console.warn('indent is must be 50 and below. 50 will be used automatically.');
    return 50 as IndentSize;
  }
  return n as IndentSize;
}

export interface SaveProps {
  newName: string;
  selectedNode: NodePath | null;
  actionType: 'create' | 'edit';
  createType?: 'folder' | 'file';
}

const SetNode = ({
  selectedNode,
  actionType,
  onCancel,
  onSave,
  indent,
  createType
}: {
  selectedNode?: NodePath | null;
  actionType: 'create' | 'edit';
  onCancel: () => void;
  onSave: (props: SaveProps) => void;
  indent: number;
  createType?: 'folder' | 'file';
}) => {
  const [name, setName] = React.useState(actionType === 'edit' ? selectedNode?.name || '' : '');

  return (
    <div className="direactree-edit-node" style={{ paddingLeft: `${actionType === 'create' ? indent : 0}px`, marginLeft: actionType === 'create' ? '8px' : '0px' }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <button onClick={() => onSave({ newName: name, selectedNode: selectedNode || null, actionType, createType })} disabled={name.length === 0 || (actionType === 'edit' && name === selectedNode?.name)}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

export type NodePath = {
  name: string;
  id: string;
  type: 'file' | 'folder';
  parent: NodePath | null;
}

interface DireactreeNodeProps {
  node: TreeNode[];
  depth: number;
  indent: number;
  selectedNode: NodePath | null;
  setSelectedNode: (nodeId: NodePath) => void;
  nodePath?: NodePath;
  selectedAction?: SelectedAction | null;
  onSave: (props: SaveProps) => void;
  onCancel: () => void;
  setSelectedAction: (action: SelectedAction | null) => void;
  onNodeMove?: (node: TreeNode, target: TreeNode) => void;
  allowDragAndDrop?: boolean;
  isAllExpanded?: boolean;
}

const DireactreeNode: React.FC<DireactreeNodeProps> = ({
  node,
  depth,
  indent,
  selectedNode,
  setSelectedNode,
  nodePath = { name: '', id: '', type: 'folder', parent: null },
  selectedAction,
  onSave,
  onCancel,
  setSelectedAction,
  onNodeMove,
  allowDragAndDrop = true,
  isAllExpanded = false
}) => {

  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>(isAllExpanded ? Object.fromEntries(node.map(n => [n.id, true])) : {});
  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOverNodeId, setDragOverNodeId] = React.useState<string | null>(null);
  const safeIndent = indent < 8 ? 8 : indent;

  React.useEffect(() => {
    if (isAllExpanded) {
      setExpandedNodes(Object.fromEntries(node.map(n => [n.id, true])));
    } else {
      setExpandedNodes({});
    }
  }, [isAllExpanded, node]);

  const isCreating = selectedAction?.action === 'createFolder' || selectedAction?.action === 'createFile';
  const createType = selectedAction?.action === 'createFolder' ? 'folder' : 'file';

  const isChildNode = (sourceNode: TreeNode, targetNode: TreeNode): boolean => {

    for (const child of sourceNode.children || []) {
      if (child.id === targetNode.id) {
        return true;
      } else if (child.children && child.children.length > 0) {
        if (isChildNode(child, targetNode)) return true;
      }
    }
    return false;
  };

  const isMoveable = (sourceNode: TreeNode, targetNode: TreeNode): boolean => {
    if (targetNode.type === "file") return false;

    if (targetNode.children && targetNode.children.some(child => child.id === sourceNode.id)) return false;

    if (sourceNode.type === "file" || sourceNode.children === undefined || sourceNode.children.length === 0) return true;


    if (isChildNode(sourceNode, targetNode)) return false;

    return true;
  }

  return (
    <>
      <ul className='direactree-list' style={{ paddingLeft: `${depth === 0 ? 0 : safeIndent}px` }}>
        {node.map((nodeChild) => {

          const isSelected = selectedNode && selectedNode.id === nodeChild.id;
          const isRenaming = selectedAction?.action === 'rename' && selectedAction?.node?.id === nodeChild.id;

          return (
            <li
              draggable={allowDragAndDrop}
              className={`direactree-item ${isSelected ? 'direactree-item-selected' : ''} ${dragOverNodeId === nodeChild.id ? 'direactree-item-dragover' : ''}`}
              key={nodeChild.id}
              onDragStart={(e) => {
                e.stopPropagation();
                setIsDragging(true);
                e.dataTransfer.setData('node', JSON.stringify(nodeChild));
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setIsDragging(false);
              }}
              onDragOver={(e) => {
                if (nodeChild.type === 'folder') {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverNodeId(nodeChild.id);
                }
              }}
              onDragLeave={() => {
                setDragOverNodeId(null);
              }}
              onDrop={(e) => {
                setDragOverNodeId(null);
                if (nodeChild.type === 'folder') {
                  e.preventDefault();
                  e.stopPropagation();

                  try {
                    const sourceNode = JSON.parse(e.dataTransfer.getData('node'));
                    if (sourceNode.id !== nodeChild.id && isMoveable(sourceNode, nodeChild) && onNodeMove) {
                      if (nodeChild.children && !expandedNodes[nodeChild.id]) {
                        setExpandedNodes({
                          ...expandedNodes,
                          [nodeChild.id]: true
                        });
                      }

                      onNodeMove(sourceNode, nodeChild);
                    }
                  } catch (error) {
                    console.error('Drop işlemi sırasında hata oluştu:', error);
                  }
                }
              }}
            >
              {isRenaming ?
                <SetNode selectedNode={selectedAction?.node} actionType='edit' onCancel={onCancel} onSave={onSave} indent={indent} /> :
                <div className={`direactree-item-container ${selectedNode?.id === nodeChild.id ? 'selected' : ''}`}>
                  <span className='direactree-item-button' onClick={() => nodeChild.type === 'folder' && setExpandedNodes({ ...expandedNodes, [nodeChild.id]: !expandedNodes[nodeChild.id] })}>
                    {nodeChild.type === 'folder' && (expandedNodes[nodeChild.id] ? '▼' : '►')}
                  </span>
                  <span className='direactree-item-name' onClick={() => setSelectedNode({ name: nodeChild.name, id: nodeChild.id, type: nodeChild.type, parent: nodePath.id === "" ? null : nodePath })}>{nodeChild.name}</span>
                </div>
              }
              <div className='direactree-item-children'>
                {nodeChild.children && nodeChild.type === 'folder' && (
                  <div className={`direactree-item-children ${expandedNodes[nodeChild.id] ? 'expanded' : 'collapsed'}`}>
                    {expandedNodes[nodeChild.id] && nodeChild.children.length > 0 && (
                      <DireactreeNode
                        node={nodeChild.children}
                        depth={depth + 1}
                        indent={indent}
                        selectedNode={selectedNode}
                        setSelectedNode={setSelectedNode}
                        nodePath={{ name: nodeChild.name, id: nodeChild.id, type: nodeChild.type, parent: nodePath.id === "" ? null : nodePath }}
                        selectedAction={selectedAction}
                        onSave={onSave}
                        onCancel={onCancel}
                        setSelectedAction={setSelectedAction}
                        onNodeMove={onNodeMove}
                        allowDragAndDrop={allowDragAndDrop}
                        isAllExpanded={isAllExpanded}
                      />
                    )}
                  </div>
                )}
                {isCreating && selectedAction?.node?.id === nodeChild.id && (
                  <SetNode selectedNode={selectedAction?.node} actionType='create' onCancel={onCancel} onSave={onSave} indent={indent} createType={createType} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {isCreating && selectedNode === null && depth === 0 && (
        <SetNode selectedNode={selectedAction?.node} actionType='create' onCancel={onCancel} onSave={onSave} indent={0} createType={createType} />
      )}
    </>
  );
};

export interface ToolboxIcons {
  createFolder?: React.ReactNode;
  createFile?: React.ReactNode;
  rename?: React.ReactNode;
  delete?: React.ReactNode;
}

interface ToolboxProps {
  selectedNode: NodePath | null;
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  onCreateFolder: ((parentNode: NodePath | null) => void) | undefined;
  onCreateFile: ((parentNode: NodePath | null) => void) | undefined;
  onRename: ((node: NodePath) => void) | undefined;
  onDelete: ((node: NodePath) => void) | undefined;
}

const Toolbox: React.FC<ToolboxProps> = ({
  selectedNode,
  toolboxIcons,
  toolboxSticky = false,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete
}) => {
  return (
    <div className={`direactree-toolbox ${toolboxSticky ? 'direactree-toolbox-sticky' : ''}`}>
      <button
        className="direactree-toolbox-button"
        onClick={() => onCreateFolder && onCreateFolder(selectedNode)}
        title="Create Folder"
        disabled={selectedNode?.type === 'file'}
      >
        {toolboxIcons?.createFolder || <span className="direactree-toolbox-icon">📂</span>}
      </button>
      <button
        className="direactree-toolbox-button"
        onClick={() => onCreateFile && onCreateFile(selectedNode)}
        title="Create File"
        disabled={selectedNode?.type === 'file'}
      >
        {toolboxIcons?.createFile || <span className="direactree-toolbox-icon">📄</span>}
      </button>
      <button
        className="direactree-toolbox-button"
        onClick={() => selectedNode && onRename && onRename(selectedNode)}
        disabled={!selectedNode}
        title="Rename"
      >
        {toolboxIcons?.rename || <span className="direactree-toolbox-icon">✏️</span>}
      </button>
      <button
        className="direactree-toolbox-button"
        onClick={() => selectedNode && onDelete && onDelete(selectedNode)}
        disabled={!selectedNode}
        title="Delete"
      >
        {toolboxIcons?.delete || <span className="direactree-toolbox-icon">🗑️</span>}
      </button>
    </div>
  );
};

export interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  isExpanded?: boolean;
};

export interface DireactreeProps {
  className?: string;
  structure: TreeNode[];
  indent?: number;
  showToolbox?: boolean;
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  allowDragAndDrop?: boolean;
  isAllExpanded?: boolean;
  action?: Action | null;
  onCreateFolder?: (parentNode: NodePath | null) => void;
  onCreateFile?: (parentNode: NodePath | null) => void;
  onRename?: (node: NodePath) => void;
  onDelete?: (node: NodePath) => void;
  onSave?: (props: SaveProps) => void;
  onSelectedNodeChange?: (node: NodePath) => void;
  onNodeMove?: (node: TreeNode, target: TreeNode) => void;
};

export type Action = 'createFolder' | 'createFile' | 'rename' | 'delete';

interface SelectedAction {
  action: Action;
  node: NodePath | null;
};


const Direactree = ({
  className = '',
  structure,
  indent = 20,
  showToolbox = true,
  toolboxIcons,
  toolboxSticky = false,
  allowDragAndDrop = true,
  isAllExpanded = false,
  action,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete,
  onSave,
  onSelectedNodeChange,
  onNodeMove,
}: DireactreeProps): React.ReactElement => {
  const validatedIndent = React.useMemo(() => validateIndent(indent), [indent]);
  const [selectedNode, setSelectedNode] = React.useState<NodePath | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<SelectedAction | null>(null);
  const direactreeRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (action) {
      setSelectedAction({ action, node: selectedNode });
    }
  }, [action]);

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (direactreeRef.current && !event.defaultPrevented) {
        const target = event.target as HTMLElement;
        let isInsideList = false;
        let currentElement: HTMLElement | null = target;

        while (currentElement) {
          if (currentElement.classList.contains('direactree-list') ||
            currentElement.classList.contains('direactree-item-container') ||
            currentElement.classList.contains('direactree-toolbox')) {
            isInsideList = true;
            break;
          }
          currentElement = currentElement.parentElement;
        }

        if (!isInsideList && !selectedAction) {
          setSelectedNode(null);
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedAction]);

  React.useEffect(() => {
    onSelectedNodeChange && selectedNode && onSelectedNodeChange(selectedNode);
  }, [selectedNode]);

  const handleCreateFolder = (node: NodePath | null) => {
    setSelectedAction({ action: 'createFolder', node });
    onCreateFolder && onCreateFolder(node);
  };

  const handleCreateFile = (node: NodePath | null) => {
    setSelectedAction({ action: 'createFile', node });
    onCreateFile && onCreateFile(node);
  };

  const handleRename = (node: NodePath) => {
    setSelectedAction({ action: 'rename', node });
    onRename && onRename(node);
  };

  const handleDelete = (node: NodePath) => {
    setSelectedAction({ action: 'delete', node });
    onDelete && onDelete(node);
  };

  const handleSave = (props: SaveProps) => {
    setSelectedAction(null);
    onSave && onSave(props);
  };

  const handleCancel = () => {
    setSelectedAction(null);
  };

  const handleNodeMove = (sourceNode: TreeNode, targetNode: TreeNode) => {
    onNodeMove && onNodeMove(sourceNode, targetNode);
  };

  return (
    <div className={`direactree ${className}`} ref={direactreeRef}>
      {showToolbox && (
        <Toolbox
          selectedNode={selectedNode}
          toolboxIcons={toolboxIcons}
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onRename={handleRename}
          onDelete={handleDelete}
          toolboxSticky={toolboxSticky}
        />
      )}
      <DireactreeNode
        node={structure}
        depth={0}
        indent={validatedIndent}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
        selectedAction={selectedAction}
        onSave={handleSave}
        onCancel={handleCancel}
        setSelectedAction={setSelectedAction}
        onNodeMove={handleNodeMove}
        allowDragAndDrop={allowDragAndDrop}
        isAllExpanded={isAllExpanded}
      />
    </div>
  );
};

export default Direactree;

const styles = document.createElement('style');
styles.innerHTML = `
  .direactree-item-dragover {
    background-color: rgba(0, 120, 215, 0.1);
    border: 1px dashed #0078d7;
    border-radius: 4px;
  }
  
  .direactree-item[draggable=true] {
    cursor: grab;
  }
  
  .direactree-item[draggable=true]:active {
    cursor: grabbing;
  }
`;
document.head.appendChild(styles); 