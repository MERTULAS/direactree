import React from 'react';
import './styles.css';

type IndentSize = number & { __brand: '8 and above' };

function validateIndent(n: number): IndentSize {
  if (n < 8) {
    console.warn('indent is must be 8 and above. 8 will be used automatically.');
    return 8 as IndentSize;
  }
  return n as IndentSize;
}

interface SaveProps {
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
      <button onClick={() => onSave({ newName: name, selectedNode: selectedNode || null, actionType, createType })} disabled={name.length === 0 || name === selectedNode?.name}>Save</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  );
}

type NodePath = {
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
  setSelectedAction
}) => {

  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});
  const safeIndent = indent < 8 ? 8 : indent;

  const isCreating = selectedAction?.action === 'createFolder' || selectedAction?.action === 'createFile';
  const createType = selectedAction?.action === 'createFolder' ? 'folder' : 'file';

  return (
    <>
      <ul className='direactree-list' style={{ paddingLeft: `${depth === 0 ? 0 : safeIndent}px` }}>
        {node.map((node) => {

          const isSelected = selectedNode && selectedNode.id === node.id;
          const isRenaming = selectedAction?.action === 'rename' && selectedAction?.node?.id === node.id;

          return (
            <li
              className={`direactree-item ${isSelected ? 'direactree-item-selected' : ''}`}
              key={node.id}
            >
              {isRenaming ?
                <SetNode selectedNode={selectedAction?.node} actionType='edit' onCancel={onCancel} onSave={onSave} indent={indent} /> :
                <div className={`direactree-item-container ${selectedNode?.id === node.id ? 'selected' : ''}`}>
                  <span className='direactree-item-button' onClick={() => node.type === 'folder' && setExpandedNodes({ ...expandedNodes, [node.id]: !expandedNodes[node.id] })}>
                    {node.type === 'folder' && (expandedNodes[node.id] ? '▼' : '►')}
                  </span>
                  <span className='direactree-item-name' onClick={() => setSelectedNode({ name: node.name, id: node.id, type: node.type, parent: nodePath.id === "" ? null : nodePath })}>{node.name}</span>
                </div>
              }
              <div className='direactree-item-children'>
                {node.children && node.type === 'folder' && (
                  <div className={`direactree-item-children ${expandedNodes[node.id] ? 'expanded' : 'collapsed'}`}>
                    {expandedNodes[node.id] && node.children.length > 0 && (
                      <DireactreeNode
                        node={node.children}
                        depth={depth + 1}
                        indent={indent}
                        selectedNode={selectedNode}
                        setSelectedNode={setSelectedNode}
                        nodePath={{ name: node.name, id: node.id, type: node.type, parent: nodePath.id === "" ? null : nodePath }}
                        selectedAction={selectedAction}
                        onSave={onSave}
                        onCancel={onCancel}
                        setSelectedAction={setSelectedAction}
                      />
                    )}
                  </div>
                )}
                {isCreating && selectedAction?.node?.id === node.id && (
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

interface ToolboxProps {
  selectedNode: NodePath | null;
  toolboxIcons?: {
    createFolder?: React.ReactNode;
    createFile?: React.ReactNode;
    rename?: React.ReactNode;
    delete?: React.ReactNode;
  };
  toolboxSticky?: boolean;
  onCreateFolder: ((parentNode: NodePath | null) => void) | undefined;
  onCreateFile: ((parentNode: NodePath | null) => void) | undefined;
  onRename: ((node: NodePath) => void) | undefined;
  onDelete: ((node: NodePath) => void) | undefined;
}

const Toolbox: React.FC<ToolboxProps> = ({
  selectedNode,
  toolboxIcons,
  toolboxSticky,
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

interface TreeNode {
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
  toolboxIcons?: {
    createFolder?: React.ReactNode;
    createFile?: React.ReactNode;
    rename?: React.ReactNode;
    delete?: React.ReactNode;
  };
  toolboxSticky?: boolean;
  onCreateFolder?: (parentNode: NodePath | null) => void;
  onCreateFile?: (parentNode: NodePath | null) => void;
  onRename?: (node: NodePath) => void;
  onDelete?: (node: NodePath) => void;
  onSave?: (props: SaveProps) => void;
};

interface SelectedAction {
  action: 'createFolder' | 'createFile' | 'rename' | 'delete';
  node: NodePath | null;
};

const Direactree = ({
  className = '',
  structure,
  indent = 20,
  showToolbox = true,
  toolboxIcons,
  toolboxSticky = false,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete,
  onSave
}: DireactreeProps): React.ReactElement => {
  const validatedIndent = React.useMemo(() => validateIndent(indent), [indent]);
  const [selectedNode, setSelectedNode] = React.useState<NodePath | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<SelectedAction | null>(null);
  const direactreeRef = React.useRef<HTMLDivElement>(null);

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
      />
    </div>
  );
};

export default Direactree; 