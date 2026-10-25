import React from 'react';
import type { ComponentMeta } from '@storybook/react';

import Direactree, { useDireactree, type NodePath, type TreeNode } from './index';

export default {
  title: 'Components/Direactree/0.4',
  component: Direactree,
} as ComponentMeta<typeof Direactree>;

const project: TreeNode[] = [
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
        isExpanded: true,
        children: [
          { id: 'button', name: 'Button.tsx', type: 'file' },
          { id: 'modal', name: 'Modal.tsx', type: 'file' },
          { id: 'tooltip', name: 'Tooltip.tsx', type: 'file' },
        ],
      },
      { id: 'index', name: 'index.ts', type: 'file' },
    ],
  },
  { id: 'docs', name: 'docs', type: 'folder', children: [{ id: 'guide', name: 'guide.md', type: 'file' }] },
  { id: 'pkg', name: 'package.json', type: 'file' },
];

const grid: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 24 };

export const AppearanceAndDensity = () => {
  const tree = useDireactree(project);
  const shared = { structure: tree.structure, onSave: tree.save, onDelete: tree.remove, onNodeMove: tree.move };
  return (
    <div style={grid}>
      <Direactree {...shared} />
      <Direactree {...shared} density="compact" theme="dark" style={{ background: '#0f172a', padding: 8 }} />
      <Direactree {...shared} appearance="card" />
      <div dir="rtl"><Direactree {...shared} /></div>
    </div>
  );
};

export const Reorder = () => {
  const tree = useDireactree(project);
  return <Direactree structure={tree.structure} onNodeMove={tree.move} onSave={tree.save} allowReorder />;
};
Reorder.storyName = 'Drag to reorder';

export const MultipleSelectionAndOpen = () => {
  const tree = useDireactree(project);
  const [selected, setSelected] = React.useState<string[]>([]);
  const [opened, setOpened] = React.useState<NodePath | null>(null);
  return (
    <div style={grid}>
      <Direactree
        structure={tree.structure}
        selectionMode="multiple"
        onSelectionChange={(ids) => setSelected(ids)}
        onNodeActivate={(_node, path) => setOpened(path)}
        onDelete={tree.remove}
        toolboxActions={[{
          id: 'delete-selected',
          label: 'Delete selected',
          icon: '✕',
          disabled: (_node, ids) => ids.length < 2,
          onClick: (_node, ids) => ids.forEach(id => tree.remove({ id })),
        }]}
      />
      <div style={{ fontFamily: 'system-ui', fontSize: 13 }}>
        <p>Ctrl/Cmd+click, Shift+click, Shift+arrows, Ctrl/Cmd+A. Double click or Enter opens.</p>
        <p>Selected: {selected.join(', ') || 'none'}</p>
        <p>Opened: {opened ? opened.name : 'none'}</p>
      </div>
    </div>
  );
};

export const RememberOpenFolders = () => {
  const tree = useDireactree(project);
  const [expanded, setExpanded] = React.useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('direactree-story-open') ?? '["src"]');
    } catch {
      return ['src'];
    }
  });
  return (
    <Direactree
      structure={tree.structure}
      expandedIds={expanded}
      onExpandedChange={(ids) => {
        setExpanded(ids);
        try {
          localStorage.setItem('direactree-story-open', JSON.stringify(ids));
        } catch {
          // Storage can be blocked; the tree still works.
        }
      }}
    />
  );
};

export const TailwindClassNames = () => (
  <Direactree
    structure={project}
    classNames={{
      root: 'my-tree',
      row: 'my-row',
      label: 'my-label',
    }}
    style={{ '--direactree-selected': '#fef3c7', '--direactree-selected-fg': '#78350f' }}
  />
);
TailwindClassNames.storyName = 'classNames and tokens';

const brandColors = {
  '--direactree-selected': 'light-dark(#ede9fe, #4c1d95)',
  '--direactree-selected-fg': 'light-dark(#4c1d95, #ede9fe)',
  '--direactree-hover': 'light-dark(#f5f3ff, #2e1065)',
  '--direactree-focus': 'light-dark(#7c3aed, #a78bfa)',
  '--direactree-match': 'light-dark(#ddd6fe, #6d28d9)',
};

/** One `style` with light-dark() values, shown on the light, dark, and system themes. */
export const ColorsPerTheme = () => (
  <div style={grid}>
    {(['light', 'dark', 'system'] as const).map(theme => (
      <div key={theme}>
        <p style={{ fontFamily: 'system-ui', fontSize: 12, margin: '0 0 6px' }}>{theme}</p>
        <Direactree structure={project} theme={theme} selectedId="modal" searchTerm="o" searchMode="highlight" style={brandColors} />
      </div>
    ))}
  </div>
);
ColorsPerTheme.storyName = 'Colors per theme (light-dark)';
