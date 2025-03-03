import React from 'react';
import './styles.css';

interface TreeNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  isExpanded?: boolean;
};

type IndentSize = number & { __brand: '8 and above' };

function validateIndent(n: number): IndentSize {
  if (n < 8) {
    console.warn('indent is must be 8 and above. 8 will be used automatically.');
    return 8 as IndentSize;
  }
  return n as IndentSize;
}

export interface DireactreeProps {
  className?: string;
  structure: TreeNode[];
  indent?: number;
};

type NodePath = {
  name: string;
  id: string;
  parent: NodePath | null;
}

interface DireactreeNodeProps {
  node: TreeNode[];
  depth: number;
  indent: number;
  selectedNode: NodePath | null;
  setSelectedNode: (nodeId: NodePath) => void;
  nodePath?: NodePath;
}

const DireactreeNode: React.FC<DireactreeNodeProps> = ({
  node,
  depth,
  indent,
  selectedNode,
  setSelectedNode,
  nodePath = {name: '', id: '', parent: null}
}) => {

  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>({});
  const safeIndent = indent < 8 ? 8 : indent;
  return (
    <ul className='direactree-list' style={{ paddingLeft: `${depth === 0 ? 0 : safeIndent}px` }}>
      {node.map((node) => (
        <li className='direactree-item' key={node.id}>
          <div className={`direactree-item-container ${selectedNode?.id === node.id ? 'selected' : ''}`}>
            <span className='direactree-item-button' onClick={() => node.type === 'folder' && setExpandedNodes({ ...expandedNodes, [node.id]: !expandedNodes[node.id] })}>
              {node.type === 'folder' && (expandedNodes[node.id] ? '▼' : '►')}
            </span>
            <span className='direactree-item-name' onClick={() => setSelectedNode({name: node.name, id: node.id, parent: nodePath.id === "" ? null : nodePath })}>{node.name}</span>
          </div>
          <div className='direactree-item-children'>
            {node.children && node.type === 'folder' && expandedNodes[node.id] && node.children.length > 0 && (
              <DireactreeNode
                node={node.children}
                depth={depth + 1}
                indent={indent}
                selectedNode={selectedNode}
                setSelectedNode={setSelectedNode}
                nodePath={{name: node.name, id: node.id, parent: nodePath.id === "" ? null : nodePath}}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
};

const Direactree: React.FC<DireactreeProps> = ({ className = '', structure, indent = 20 }) => {
  const validatedIndent = React.useMemo(() => validateIndent(indent), [indent]);
  const [selectedNode, setSelectedNode] = React.useState<NodePath | null>(null);

  return (
    <div className={`direactree ${className}`}>
      <DireactreeNode
        node={structure}
        depth={0}
        indent={validatedIndent}
        selectedNode={selectedNode}
        setSelectedNode={setSelectedNode}
      />
    </div>
  );
};

export default Direactree; 