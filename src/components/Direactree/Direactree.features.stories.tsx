import React from 'react';
import type { ComponentMeta } from '@storybook/react';

import Direactree, { useDireactree, type DireactreeHandle, type TreeNode } from './index';

export default {
  title: 'Components/Direactree/Features',
  component: Direactree,
} as ComponentMeta<typeof Direactree>;

type FileData = { git?: 'M' | 'A' | 'D'; errors?: number };

const project: TreeNode<FileData>[] = [
  {
    id: 'root',
    name: 'my-app',
    type: 'folder',
    isExpanded: true,
    permissions: { delete: false, rename: false, move: false },
    children: [
      {
        id: 'src',
        name: 'src',
        type: 'folder',
        isExpanded: true,
        children: [
          {
            id: 'components',
            name: 'components',
            type: 'folder',
            children: [
              { id: 'button', name: 'Button.tsx', type: 'file', data: { git: 'M', errors: 2 } },
              { id: 'modal', name: 'Modal.tsx', type: 'file', data: { git: 'A' } },
            ],
          },
          { id: 'index', name: 'index.ts', type: 'file' },
        ],
      },
      { id: 'node_modules', name: 'node_modules', type: 'folder', locked: true, children: [] },
      { id: 'pkg', name: 'package.json', type: 'file', data: { git: 'M' } },
    ],
  },
];

const fileIcon = (node: TreeNode<FileData>) => {
  if (node.type === 'folder') {
    return '📁';
  }
  if (/\.tsx?$/.test(node.name)) {
    return '🟦';
  }
  if (node.name.endsWith('.json')) {
    return '🟨';
  }
  return '📄';
};

const gitColor = { M: '#b45309', A: '#15803d', D: '#b91c1c' };

export const UseDireactree = () => {
  const tree = useDireactree(project, { sort: 'foldersFirst' });
  return (
    <Direactree
      structure={tree.structure}
      onSave={tree.save}
      onDelete={tree.remove}
      onNodeMove={tree.move}
      confirmDelete
    />
  );
};
UseDireactree.storyName = 'useDireactree (no extra code)';

export const Permissions = () => {
  const tree = useDireactree(project);
  return (
    <Direactree
      structure={tree.structure}
      onSave={tree.save}
      onDelete={tree.remove}
      onNodeMove={tree.move}
      getNodePermissions={(node) => (node.name.endsWith('.json') ? { move: false, delete: false } : {})}
    />
  );
};

export const SearchAndReveal = () => {
  const tree = useDireactree(project);
  const ref = React.useRef<DireactreeHandle>(null);
  return (
    <div>
      <button type="button" onClick={() => ref.current?.revealNode('button', { focus: true })}>
        Reveal Button.tsx
      </button>
      <Direactree ref={ref} structure={tree.structure} showSearch onSave={tree.save} />
    </div>
  );
};

export const CustomRows = () => {
  const tree = useDireactree(project);
  return (
    <Direactree
      structure={tree.structure}
      onSave={tree.save}
      onDelete={tree.remove}
      onNodeMove={tree.move}
      renderIcon={(node) => fileIcon(node)}
      renderBadge={(node) => (
        <>
          {node.data?.errors ? (
            <span style={{ color: '#fff', background: '#b91c1c', borderRadius: 8, padding: '0 6px' }}>{node.data.errors}</span>
          ) : null}
          {node.data?.git ? <strong style={{ color: gitColor[node.data.git] }}>{node.data.git}</strong> : null}
        </>
      )}
      contextMenu={(node, defaults) => [
        ...defaults,
        'separator',
        { id: 'copy', label: 'Copy name', onSelect: (target) => navigator.clipboard?.writeText(target.name) },
      ]}
      toolboxActions={[
        { id: 'collapse', label: 'Reset tree', icon: '↺', onClick: () => tree.reset() },
      ]}
    />
  );
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const LazyLoading = () => {
  const tree = useDireactree<unknown>([
    { id: 'remote', name: 'remote', type: 'folder', hasChildren: true },
  ]);
  return (
    <Direactree
      structure={tree.structure}
      onLoadChildren={(node) => tree.loadChildren(node, async (folder) => {
        await wait(700);
        return Array.from({ length: 5 }, (_, i) => (
          i < 2
            ? { id: `${folder.id}/${i}`, name: `folder-${i}`, type: 'folder' as const, hasChildren: true }
            : { id: `${folder.id}/${i}`, name: `file-${i}.txt`, type: 'file' as const }
        ));
      })}
    />
  );
};

const largeTree: TreeNode[] = Array.from({ length: 100 }, (_, i) => ({
  id: `folder-${i}`,
  name: `folder-${i}`,
  type: 'folder' as const,
  isExpanded: i < 3,
  children: Array.from({ length: 100 }, (_, j) => ({ id: `file-${i}-${j}`, name: `file-${i}-${j}.txt`, type: 'file' as const })),
}));

export const Virtualized = () => {
  const tree = useDireactree(largeTree);
  return (
    <Direactree
      structure={tree.structure}
      virtualized={{ height: 420 }}
      showSearch
      onSave={tree.save}
      onDelete={tree.remove}
      onNodeMove={tree.move}
    />
  );
};
Virtualized.storyName = 'Virtualized (10,100 nodes)';
