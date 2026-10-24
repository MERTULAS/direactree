import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Direactree, {
  applySave,
  compareFoldersFirst,
  getAncestorIds,
  insertNode,
  moveNode,
  removeNode,
  renameNode,
  setChildren,
  sortChildren,
  useDireactree,
  validateName,
  type DireactreeHandle,
  type DireactreeProps,
  type TreeNode,
  type UseDireactreeResult,
} from './index';

const structure: TreeNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    children: [
      {
        id: 'components',
        name: 'components',
        type: 'folder',
        children: [{ id: 'button', name: 'Button.tsx', type: 'file' }],
      },
      { id: 'index', name: 'index.ts', type: 'file' },
    ],
  },
  {
    id: 'docs',
    name: 'docs',
    type: 'folder',
    children: [{ id: 'readme', name: 'README.md', type: 'file' }],
  },
];

function createDataTransfer() {
  const store: Record<string, string> = {};
  return {
    effectAllowed: 'none',
    dropEffect: 'none',
    setData(type: string, value: string) {
      store[type] = value;
    },
    getData(type: string) {
      return store[type] || '';
    },
    store,
  };
}

function row(name: string) {
  const item = screen.getByRole('treeitem', { name });
  const li = item.closest('li');
  if (!li) {
    throw new Error(`Missing row for ${name}`);
  }
  return li;
}

function toggleFolder(name: string) {
  const button = screen.getByRole('treeitem', { name }).querySelector('button');
  if (!button) {
    throw new Error(`Missing expand button for ${name}`);
  }
  fireEvent.click(button);
}

function makeLargeTree(count: number): TreeNode[] {
  return [{
    id: 'root',
    name: 'root',
    type: 'folder',
    isExpanded: true,
    children: Array.from({ length: count }, (_, i) => ({ id: `f${i}`, name: `file-${i}.txt`, type: 'file' as const })),
  }];
}

describe('tree helpers', () => {
  it('updates without mutating and keeps untouched branches', () => {
    const renamed = renameNode(structure, 'button', 'Link.tsx');
    expect(renamed).not.toBe(structure);
    expect(renamed[1]).toBe(structure[1]);
    expect(structure[0].children?.[0].children?.[0].name).toBe('Button.tsx');
    expect(renamed[0].children?.[0].children?.[0].name).toBe('Link.tsx');
    expect(renameNode(structure, 'missing', 'x')).toBe(structure);
  });

  it('inserts, removes, and sets children', () => {
    const inserted = insertNode(structure, 'docs', { id: 'guide', name: 'guide.md', type: 'file' });
    expect(inserted[1].children?.map(n => n.id)).toEqual(['readme', 'guide']);
    const atRoot = insertNode(structure, null, { id: 'pkg', name: 'package.json', type: 'file' }, 0);
    expect(atRoot[0].id).toBe('pkg');
    expect(removeNode(structure, 'components')[0].children?.map(n => n.id)).toEqual(['index']);
    expect(setChildren(structure, 'docs', [])[1].children).toEqual([]);
  });

  it('moves nodes and refuses cycles and files as targets', () => {
    const moved = moveNode(structure, 'index', 'docs');
    expect(moved[0].children?.map(n => n.id)).toEqual(['components']);
    expect(moved[1].children?.map(n => n.id)).toEqual(['readme', 'index']);
    expect(moveNode(structure, 'src', 'components')).toBe(structure);
    expect(moveNode(structure, 'src', 'readme')).toBe(structure);
    expect(moveNode(structure, 'button', null).map(n => n.id)).toEqual(['src', 'docs', 'button']);
  });

  it('applies save payloads and sorts folders first', () => {
    const created = applySave(structure, {
      newName: 'api',
      actionType: 'create',
      createType: 'folder',
      selectedNode: { id: 'index', name: 'index.ts', type: 'file', parent: { id: 'src', name: 'src', type: 'folder', parent: null } },
    }, { id: 'api' });
    // A selected file means the file's folder.
    expect(created[0].children?.map(n => n.id)).toEqual(['components', 'index', 'api']);
    expect(created[0].children?.[2]).toEqual({ id: 'api', name: 'api', type: 'folder', children: [] });
    const sorted = sortChildren(created, 'src', compareFoldersFirst);
    expect(sorted[0].children?.map(n => n.id)).toEqual(['api', 'components', 'index']);
    expect(getAncestorIds(structure, 'button')).toEqual(['src', 'components']);
    expect(getAncestorIds(structure, 'nope')).toBeNull();
  });
});

describe('validateName', () => {
  const siblings: TreeNode[] = [{ id: 'a', name: 'Readme.md', type: 'file' }];

  it('rejects blank, invalid, reserved, long, and duplicate names', () => {
    expect(validateName('   ')).toMatchObject({ ok: false, code: 'empty' });
    expect(validateName('a/b')).toMatchObject({ ok: false, code: 'invalidChars', message: 'A name cannot contain “/”.' });
    expect(validateName('..')).toMatchObject({ ok: false, code: 'reserved' });
    expect(validateName('x'.repeat(256))).toMatchObject({ ok: false, code: 'tooLong' });
    expect(validateName('readme.MD', { siblings })).toMatchObject({ ok: false, code: 'duplicate' });
  });

  it('trims, ignores the renamed node, and follows rule overrides', () => {
    expect(validateName('  notes.txt  ')).toEqual({ ok: true, name: 'notes.txt' });
    expect(validateName('readme.MD', { siblings, ignoreId: 'a' })).toMatchObject({ ok: true });
    expect(validateName('readme.MD', { siblings, rules: { caseSensitive: true } })).toMatchObject({ ok: true });
    expect(validateName('a#b', { rules: { invalidChars: '#' } })).toMatchObject({ ok: false, code: 'invalidChars' });
    expect(validateName('a/b', { rules: { invalidChars: '#' } })).toMatchObject({ ok: true });
  });
});

describe('name checks in the editor', () => {
  it('blocks blank and duplicate names and sends the trimmed name', () => {
    const onSave = jest.fn();
    render(<Direactree structure={structure} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    const input = screen.getByRole('textbox', { name: 'New folder name' });

    fireEvent.change(input, { target: { value: '   ' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a name.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    fireEvent.change(input, { target: { value: 'DOCS' } });
    expect(screen.getByRole('alert')).toHaveTextContent('“DOCS” already exists in this folder.');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '  assets  ' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ newName: 'assets', actionType: 'create' }));
  });

  it('checks siblings of the renamed node and runs the custom rule', () => {
    const onSave = jest.fn();
    render(
      <Direactree
        structure={structure}
        onSave={onSave}
        validateName={(name) => (name.endsWith('.exe') ? 'No executables.' : null)}
      />
    );
    toggleFolder('src');
    fireEvent.click(screen.getByRole('treeitem', { name: 'index.ts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    const input = screen.getByRole('textbox', { name: 'Rename' });

    fireEvent.change(input, { target: { value: 'components' } });
    expect(screen.getByRole('alert')).toHaveTextContent('already exists');
    fireEvent.change(input, { target: { value: 'run.exe' } });
    expect(screen.getByRole('alert')).toHaveTextContent('No executables.');
    fireEvent.change(input, { target: { value: 'INDEX.ts' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ newName: 'INDEX.ts', actionType: 'edit' }));
  });

  it('turns the built-in checks off with validateName={false}', () => {
    const onSave = jest.fn();
    render(<Direactree structure={structure} onSave={onSave} validateName={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create File' }));
    const input = screen.getByRole('textbox', { name: 'New file name' });
    fireEvent.change(input, { target: { value: 'docs' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ newName: 'docs' }));
  });

  it('refuses a drop when the target folder already has that name', () => {
    const onNodeMove = jest.fn();
    const tree: TreeNode[] = [
      { id: 'a', name: 'a', type: 'folder', children: [{ id: 'a-notes', name: 'notes.txt', type: 'file' }] },
      { id: 'b', name: 'b', type: 'folder', children: [{ id: 'b-notes', name: 'Notes.txt', type: 'file' }] },
    ];
    render(<Direactree structure={tree} onNodeMove={onNodeMove} />);
    toggleFolder('a');
    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(row('notes.txt'), { dataTransfer });
    fireEvent.dragOver(row('b'), { dataTransfer });
    expect(row('b')).not.toHaveClass('direactree-item-dragover');
    expect(dataTransfer.dropEffect).toBe('none');
    fireEvent.drop(row('b'), { dataTransfer });
    expect(onNodeMove).not.toHaveBeenCalled();
    expect(document.querySelector('.direactree-sr-only')).toHaveTextContent('“notes.txt” already exists in b.');
  });
});

function HookTree({
  onReady,
  ...props
}: { onReady: (tree: UseDireactreeResult) => void } & Partial<DireactreeProps>) {
  const tree = useDireactree(structure, { createId: () => 'new-id' });
  onReady(tree);
  return (
    <Direactree
      structure={tree.structure}
      onSave={tree.save}
      onDelete={tree.remove}
      onNodeMove={tree.move}
      isAllExpanded
      {...props}
    />
  );
}

describe('useDireactree', () => {
  it('creates, renames, deletes, and moves without extra code', () => {
    let tree: UseDireactreeResult | undefined;
    render(<HookTree onReady={(t) => { tree = t; }} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'docs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create File' }));
    const input = screen.getByRole('textbox', { name: 'New file name' });
    fireEvent.change(input, { target: { value: 'guide.md' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByRole('treeitem', { name: 'guide.md' })).toHaveAttribute('aria-level', '2');
    expect(tree?.find('new-id')).toMatchObject({ name: 'guide.md', type: 'file' });

    fireEvent.click(screen.getByRole('treeitem', { name: 'guide.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Rename' }), { target: { value: 'manual.md' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('treeitem', { name: 'manual.md' })).toBeInTheDocument();

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(row('manual.md'), { dataTransfer });
    fireEvent.drop(row('components'), { dataTransfer });
    expect(screen.getByRole('treeitem', { name: 'manual.md' })).toHaveAttribute('aria-level', '3');

    fireEvent.click(screen.getByRole('treeitem', { name: 'manual.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.queryByRole('treeitem', { name: 'manual.md' })).not.toBeInTheDocument();
    expect(tree?.find('new-id')).toBeNull();
  });

  it('applies the change after an async backend call', async () => {
    let tree: UseDireactreeResult | undefined;
    const api = jest.fn(() => Promise.resolve());
    function Wrapper() {
      return (
        <HookTree
          onReady={(t) => { tree = t; }}
          onDelete={async (node) => {
            await api();
            tree?.remove(node);
          }}
        />
      );
    }
    render(<Wrapper />);
    fireEvent.click(screen.getByRole('treeitem', { name: 'README.md' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('treeitem', { name: 'README.md' })).not.toBeInTheDocument());
    expect(api).toHaveBeenCalledTimes(1);
  });
});

describe('permissions', () => {
  it('locks nodes and merges getNodePermissions', () => {
    const onNodeMove = jest.fn();
    const tree: TreeNode[] = [
      {
        id: 'root',
        name: 'root',
        type: 'folder',
        isExpanded: true,
        children: [
          { id: 'locked', name: 'locked', type: 'folder', locked: true, children: [] },
          { id: 'pinned', name: 'pinned.txt', type: 'file', permissions: { move: false } },
          { id: 'free', name: 'free.txt', type: 'file' },
        ],
      },
    ];
    render(
      <Direactree
        structure={tree}
        onSave={jest.fn()}
        onDelete={jest.fn()}
        onNodeMove={onNodeMove}
        getNodePermissions={(_node, path) => (path.parent === null ? { delete: false, rename: false } : {})}
      />
    );

    fireEvent.click(screen.getByRole('treeitem', { name: 'root' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create File' })).toBeEnabled();

    fireEvent.click(screen.getByRole('treeitem', { name: 'locked' }));
    expect(row('locked')).toHaveAttribute('data-locked', 'true');
    expect(row('locked')).toHaveAttribute('draggable', 'false');
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create Folder' })).toBeDisabled();
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'locked' }), { key: 'F2' });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    expect(row('pinned.txt')).toHaveAttribute('draggable', 'false');
    expect(row('free.txt')).toHaveAttribute('draggable', 'true');

    const dataTransfer = createDataTransfer();
    fireEvent.dragStart(row('free.txt'), { dataTransfer });
    fireEvent.dragOver(row('locked'), { dataTransfer });
    fireEvent.drop(row('locked'), { dataTransfer });
    expect(onNodeMove).not.toHaveBeenCalled();
  });

  it('renames with F2 and deletes with the Delete key', () => {
    const onDelete = jest.fn();
    render(<Direactree structure={structure} onSave={jest.fn()} onDelete={onDelete} />);
    const docs = screen.getByRole('treeitem', { name: 'docs' });
    fireEvent.keyDown(docs, { key: 'F2' });
    expect(screen.getByRole('textbox', { name: 'Rename' })).toHaveValue('docs');
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename' }), { key: 'Escape' });
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'docs' }), { key: 'Delete' });
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'docs' }));
  });
});

describe('search and reveal', () => {
  it('filters to matches, opens their folders, and marks the match', () => {
    const { rerender } = render(<Direactree structure={structure} searchTerm="butt" />);
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('treeitem', { name: 'components' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Button.tsx' }).querySelector('mark')).toHaveTextContent('Butt');
    expect(screen.queryByRole('treeitem', { name: 'docs' })).not.toBeInTheDocument();
    expect(screen.queryByRole('treeitem', { name: 'index.ts' })).not.toBeInTheDocument();

    rerender(<Direactree structure={structure} searchTerm="butt" searchMode="highlight" />);
    expect(screen.getByRole('treeitem', { name: 'docs' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'index.ts' })).toBeInTheDocument();

    rerender(<Direactree structure={structure} searchTerm="zzz" />);
    expect(screen.getByText('No matching items.')).toBeInTheDocument();

    rerender(<Direactree structure={structure} searchTerm="" />);
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('lets a folder close during a search without losing the user state', () => {
    render(<Direactree structure={structure} searchTerm="read" />);
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toBeInTheDocument();
    toggleFolder('docs');
    expect(screen.queryByRole('treeitem', { name: 'README.md' })).not.toBeInTheDocument();
  });

  it('uses the built-in search field and moves focus to the first match', () => {
    const onSearchChange = jest.fn();
    const onSelectedNodeChange = jest.fn();
    render(<Direactree structure={structure} showSearch onSearchChange={onSearchChange} onSelectedNodeChange={onSelectedNodeChange} />);
    const input = screen.getByRole('searchbox', { name: 'Search' });
    fireEvent.change(input, { target: { value: 'readme' } });
    expect(onSearchChange).toHaveBeenLastCalledWith('readme');
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'readme' }));
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveFocus();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(input).toHaveValue('');
  });

  it('reveals a nested node through the ref', () => {
    const scrollIntoView = jest.fn();
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    try {
      const ref = React.createRef<DireactreeHandle>();
      const onSelectedNodeChange = jest.fn();
      render(<Direactree ref={ref} structure={structure} onSelectedNodeChange={onSelectedNodeChange} />);
      expect(screen.queryByRole('treeitem', { name: 'Button.tsx' })).not.toBeInTheDocument();

      let found = false;
      act(() => {
        found = ref.current?.revealNode('button', { focus: true, block: 'center' }) ?? false;
      });
      expect(found).toBe(true);
      const button = screen.getByRole('treeitem', { name: 'Button.tsx' });
      expect(button).toHaveAttribute('aria-selected', 'true');
      expect(button).toHaveFocus();
      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'center' });
      expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'button' }));
      expect(ref.current?.revealNode('missing')).toBe(false);

      act(() => ref.current?.collapseAll());
      expect(screen.queryByRole('treeitem', { name: 'components' })).not.toBeInTheDocument();
      act(() => ref.current?.expandAll());
      expect(screen.getByRole('treeitem', { name: 'Button.tsx' })).toBeInTheDocument();
    } finally {
      HTMLElement.prototype.scrollIntoView = original;
    }
  });

  it('opens the way to a controlled selectedId', () => {
    const onSelectedNodeChange = jest.fn();
    const { rerender } = render(
      <Direactree structure={structure} selectedId={null} onSelectedNodeChange={onSelectedNodeChange} />
    );
    fireEvent.click(screen.getByRole('treeitem', { name: 'docs' }));
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'docs' }));
    expect(screen.getByRole('treeitem', { name: 'docs' })).toHaveAttribute('aria-selected', 'false');

    rerender(<Direactree structure={structure} selectedId="readme" onSelectedNodeChange={onSelectedNodeChange} />);
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveAttribute('aria-selected', 'true');
  });
});

describe('row and menu customization', () => {
  type Git = { git?: 'M' | 'A'; errors?: number };
  const gitTree: TreeNode<Git>[] = [
    { id: 'app', name: 'app.ts', type: 'file', data: { git: 'M', errors: 2 } },
    { id: 'lib', name: 'lib', type: 'folder', children: [] },
  ];

  it('renders icons, badges, labels, and row classes', () => {
    render(
      <Direactree
        structure={gitTree}
        renderIcon={(node) => <span data-testid={`icon-${node.id}`}>{node.type === 'folder' ? 'D' : 'F'}</span>}
        renderBadge={(node) => (node.data?.errors ? <span>{node.data.errors} errors</span> : null)}
        renderLabel={(node, { highlighted }) => <em>{highlighted}</em>}
        getRowClassName={(node) => (node.data?.git ? `git-${node.data.git}` : undefined)}
      />
    );
    expect(screen.getByTestId('icon-app')).toHaveTextContent('F');
    expect(screen.getByText('2 errors').closest('.direactree-item-badge')).not.toBeNull();
    expect(row('lib').querySelector('.direactree-item-badge')).toBeNull();
    expect(row('app.ts')).toHaveClass('git-M');
    expect(row('app.ts').querySelector('em')).toHaveTextContent('app.ts');
  });

  it('opens the context menu with built-in and custom items', () => {
    const onSave = jest.fn();
    const onDelete = jest.fn();
    const copyPath = jest.fn();
    render(
      <Direactree
        structure={gitTree}
        onSave={onSave}
        onDelete={onDelete}
        contextMenu={(node, defaults) => [
          ...defaults,
          'separator',
          { id: 'copy', label: 'Copy path', onSelect: copyPath },
        ]}
      />
    );

    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'lib' }), { clientX: 10, clientY: 10 });
    const menu = screen.getByRole('menu', { name: 'Actions for lib' });
    expect(menu.closest('.direactree-overlay')).not.toBeNull();
    expect(screen.getByRole('treeitem', { name: 'lib' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      'Create Folder', 'Create File', 'Rename', 'Delete', 'Copy path',
    ]);
    expect(screen.getByRole('menuitem', { name: 'Create Folder' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'End' });
    expect(screen.getByRole('menuitem', { name: 'Copy path' })).toHaveFocus();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: 'Create Folder' })).toHaveFocus();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Copy path' }));
    expect(copyPath).toHaveBeenCalledWith(expect.objectContaining({ id: 'lib' }), expect.objectContaining({ id: 'lib', parent: null }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    const file = screen.getByRole('treeitem', { name: 'app.ts' });
    fireEvent.keyDown(file, { key: 'F10', shiftKey: true });
    expect(screen.queryByRole('menuitem', { name: 'Create Folder' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'app' }));

    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'app.ts' }), { key: 'ContextMenu' });
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'app.ts' })).toHaveFocus();
  });

  it('keeps the browser menu when contextMenu is off', () => {
    render(<Direactree structure={gitTree} />);
    fireEvent.contextMenu(screen.getByRole('treeitem', { name: 'lib' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('adds custom toolbox actions', () => {
    const onClick = jest.fn();
    render(
      <Direactree
        structure={gitTree}
        toolboxActions={[{ id: 'refresh', label: 'Refresh', icon: '↻', onClick, disabled: (node) => node === null }]}
      />
    );
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
    fireEvent.click(screen.getByRole('treeitem', { name: 'lib' }));
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
    expect(onClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'lib' }));
  });
});

describe('large trees', () => {
  it('loads children the first time a folder opens and retries after a failure', async () => {
    let fail = true;
    const loader = jest.fn((node: TreeNode) => (fail
      ? Promise.reject(new Error('offline'))
      : Promise.resolve([{ id: `${node.id}/a`, name: 'a.txt', type: 'file' as const }])));
    const onActionError = jest.fn();
    function Lazy() {
      const tree = useDireactree<unknown>([{ id: 'remote', name: 'remote', type: 'folder', hasChildren: true }]);
      return (
        <Direactree
          structure={tree.structure}
          onLoadChildren={(node) => tree.loadChildren(node, loader)}
          onActionError={onActionError}
        />
      );
    }
    render(<Lazy />);
    expect(loader).not.toHaveBeenCalled();
    toggleFolder('remote');
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByRole('alert')).toHaveTextContent('offline');
    expect(onActionError).toHaveBeenCalledWith(expect.any(Error), 'load');

    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('treeitem', { name: 'a.txt' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(loader).toHaveBeenCalledTimes(2);

    toggleFolder('remote');
    toggleFolder('remote');
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('renders only the rows in view and scrolls them in with the keyboard', () => {
    render(<Direactree structure={makeLargeTree(5000)} virtualized={{ rowHeight: 30, overscan: 4, height: 300 }} />);
    const viewport = document.querySelector('.direactree-viewport') as HTMLElement;
    expect(viewport.style.height).toBe('300px');
    expect(document.querySelector('.direactree')).toHaveClass('direactree-virtualized');
    const rendered = screen.getAllByRole('treeitem');
    expect(rendered.length).toBeLessThan(30);
    const list = screen.getByRole('tree');
    expect(parseInt(list.style.paddingBottom, 10)).toBeGreaterThan(100000);
    expect(screen.getByRole('treeitem', { name: 'file-0.txt' })).toHaveAttribute('aria-setsize', '5000');

    const root = screen.getByRole('treeitem', { name: 'root' });
    root.focus();
    fireEvent.keyDown(root, { key: 'End' });
    const last = screen.getByRole('treeitem', { name: 'file-4999.txt' });
    expect(last).toHaveFocus();
    expect(last).toHaveAttribute('aria-posinset', '5000');
    expect(screen.queryByRole('treeitem', { name: 'file-0.txt' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('treeitem').length).toBeLessThan(30);

    fireEvent.keyDown(last, { key: 'Home' });
    expect(screen.getByRole('treeitem', { name: 'root' })).toHaveFocus();
  });

  it('reveals a row outside the rendered window', () => {
    const ref = React.createRef<DireactreeHandle>();
    render(<Direactree ref={ref} structure={makeLargeTree(2000)} virtualized />);
    expect(screen.queryByRole('treeitem', { name: 'file-1500.txt' })).not.toBeInTheDocument();
    act(() => {
      ref.current?.revealNode('f1500', { block: 'start' });
    });
    expect(screen.getByRole('treeitem', { name: 'file-1500.txt' })).toHaveAttribute('aria-selected', 'true');
  });
});
