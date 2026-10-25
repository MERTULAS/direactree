import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, createEvent, fireEvent, render, screen } from '@testing-library/react';
import Direactree, {
  moveNode,
  resolveDrop,
  useDireactree,
  type DireactreeHandle,
  type TreeNode,
} from './index';

const tree: TreeNode[] = [
  {
    id: 'src',
    name: 'src',
    type: 'folder',
    children: [
      { id: 'a', name: 'a.ts', type: 'file' },
      { id: 'b', name: 'b.ts', type: 'file' },
      { id: 'c', name: 'c.ts', type: 'file' },
    ],
  },
  { id: 'docs', name: 'docs', type: 'folder', children: [] },
  { id: 'readme', name: 'README.md', type: 'file' },
];

function row(name: string) {
  const li = screen.getByRole('treeitem', { name }).closest('li');
  if (!li) {
    throw new Error(`Missing row for ${name}`);
  }
  return li;
}

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

/** jsdom has no DragEvent, so clientY is set on the event by hand. */
function dragAt(kind: 'dragOver' | 'drop', element: HTMLElement, dataTransfer: unknown, clientY: number) {
  const event = createEvent[kind](element, { dataTransfer });
  Object.defineProperty(event, 'clientY', { value: clientY });
  fireEvent(element, event);
}

/** Every row is 20px tall and starts at y = 0, so clientY picks the drop zone. */
function mockRowRects() {
  return jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0, bottom: 20, left: 0, right: 200, width: 200, height: 20, x: 0, y: 0, toJSON: () => ({}),
  } as DOMRect);
}

describe('appearance and styling hooks', () => {
  it('is plain and comfortable by default and exposes state as data attributes', () => {
    render(<Direactree structure={tree} isAllExpanded indent={16} />);
    const root = document.querySelector('.direactree') as HTMLElement;
    expect(root).toHaveAttribute('data-appearance', 'plain');
    expect(root).toHaveAttribute('data-density', 'comfortable');
    expect(root.style.getPropertyValue('--direactree-indent')).toBe('16px');

    fireEvent.click(screen.getByRole('treeitem', { name: 'b.ts' }));
    const b = row('b.ts');
    expect(b).toHaveAttribute('data-type', 'file');
    expect(b).toHaveAttribute('data-depth', '1');
    expect(b).toHaveAttribute('data-selected', '');
    expect(b).toHaveAttribute('data-active', '');
    expect(b.style.getPropertyValue('--direactree-depth')).toBe('1');
    expect(row('src')).toHaveAttribute('data-state', 'open');
    expect(row('src')).not.toHaveAttribute('data-selected');
  });

  it('switches to the card look, compact rows, and slot classes', () => {
    render(
      <Direactree
        structure={tree}
        appearance="card"
        density="compact"
        classNames={{ root: 'tw-root', row: 'tw-row', item: 'tw-item', label: 'tw-label', toolbox: 'tw-toolbox', toolboxButton: 'tw-btn', viewport: 'tw-view', list: 'tw-list', toggle: 'tw-toggle' }}
      />
    );
    const root = document.querySelector('.direactree');
    expect(root).toHaveAttribute('data-appearance', 'card');
    expect(root).toHaveAttribute('data-density', 'compact');
    expect(root).toHaveClass('tw-root');
    expect(row('src')).toHaveClass('tw-row');
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveClass('tw-item');
    expect(screen.getByTitle('src')).toHaveClass('tw-label');
    expect(document.querySelector('.direactree-toolbox')).toHaveClass('tw-toolbox');
    expect(screen.getByRole('button', { name: 'Rename' })).toHaveClass('tw-btn');
    expect(document.querySelector('.direactree-viewport')).toHaveClass('tw-view');
    expect(screen.getByRole('tree')).toHaveClass('tw-list');
  });

  it('uses SVG icons that follow currentColor instead of emoji', () => {
    render(<Direactree structure={tree} />);
    const icon = screen.getByRole('button', { name: 'Create Folder' }).querySelector('svg');
    expect(icon).toHaveAttribute('stroke', 'currentColor');
    expect(screen.getByRole('treeitem', { name: 'src' }).querySelector('svg.direactree-chevron')).not.toBeNull();
    expect(document.querySelector('.direactree')?.textContent).not.toMatch(/[📂📄✏🗑►▼]/u);
  });

  it('does not inject CSS from JavaScript', () => {
    const files = fs.readdirSync(__dirname).filter(file => /\.tsx?$/.test(file) && !/\.(test|stories)\.tsx?$/.test(file));
    files.forEach(file => {
      expect(fs.readFileSync(path.join(__dirname, file), 'utf8')).not.toMatch(/import\s+['"][^'"]+\.css['"]/);
    });
  });
});

describe('onNodeActivate', () => {
  it('fires on double click and Enter, and Enter toggles a folder', () => {
    const onNodeActivate = jest.fn();
    render(<Direactree structure={tree} onNodeActivate={onNodeActivate} />);
    fireEvent.doubleClick(screen.getByRole('treeitem', { name: 'README.md' }));
    expect(onNodeActivate).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'readme' }),
      expect.objectContaining({ id: 'readme', parent: null })
    );

    const src = screen.getByRole('treeitem', { name: 'src' });
    fireEvent.keyDown(src, { key: 'Enter' });
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'true');
    expect(onNodeActivate).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'src' }), expect.anything());

    fireEvent.doubleClick(screen.getByRole('treeitem', { name: 'src' }));
    expect(screen.getByRole('treeitem', { name: 'src' })).toHaveAttribute('aria-expanded', 'false');
    expect(onNodeActivate).toHaveBeenCalledTimes(3);
  });
});

describe('reordering', () => {
  it('moves within a folder and to the root through MoveInfo', () => {
    expect(moveNode(tree, 'c', 'src', 0)[0].children?.map(n => n.id)).toEqual(['c', 'a', 'b']);
    expect(moveNode(tree, 'a', 'src', 0)).toBe(tree);
    expect(moveNode(tree, 'b', null, 0).map(n => n.id)).toEqual(['b', 'src', 'docs', 'readme']);

    const a = tree[0].children![0];
    const c = tree[0].children![2];
    expect(resolveDrop(tree, a, c, 'after')).toMatchObject({ parentId: 'src', index: 2 });
    expect(resolveDrop(tree, a, c, 'before')).toMatchObject({ parentId: 'src', index: 1 });
    expect(resolveDrop(tree, a, tree[0].children![1], 'before')).toBeNull();
    expect(resolveDrop(tree, a, tree[0], 'inside')).toBeNull();
    expect(resolveDrop(tree, tree[0], a, 'after')).toBeNull();
    expect(resolveDrop(tree, a, tree[2], 'before')).toMatchObject({ parentId: null, index: 2 });
  });

  it('drops before and after rows when allowReorder is on', () => {
    const rects = mockRowRects();
    try {
      function Reorder() {
        const state = useDireactree(tree);
        return (
          <Direactree
            structure={state.structure}
            onNodeMove={state.move}
            allowReorder
            isAllExpanded
          />
        );
      }
      render(<Reorder />);
      const order = () => screen.getAllByRole('treeitem').map(item => item.getAttribute('aria-label'));

      let dataTransfer = createDataTransfer();
      fireEvent.dragStart(row('c.ts'), { dataTransfer });
      dragAt('dragOver', row('a.ts'), dataTransfer, 2);
      expect(row('a.ts')).toHaveAttribute('data-drop-position', 'before');
      dragAt('drop', row('a.ts'), dataTransfer, 2);
      expect(order()).toEqual(['src', 'c.ts', 'a.ts', 'b.ts', 'docs', 'README.md']);

      dataTransfer = createDataTransfer();
      fireEvent.dragStart(row('c.ts'), { dataTransfer });
      dragAt('drop', row('README.md'), dataTransfer, 18);
      expect(order()).toEqual(['src', 'a.ts', 'b.ts', 'docs', 'README.md', 'c.ts']);
      expect(screen.getByRole('treeitem', { name: 'c.ts' })).toHaveAttribute('aria-level', '1');

      dataTransfer = createDataTransfer();
      fireEvent.dragStart(row('README.md'), { dataTransfer });
      dragAt('dragOver', row('docs'), dataTransfer, 10);
      expect(row('docs')).toHaveAttribute('data-drop-position', 'inside');
      expect(row('docs')).toHaveClass('direactree-item-dragover');
      dragAt('drop', row('docs'), dataTransfer, 10);
      expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveAttribute('aria-level', '2');
    } finally {
      rects.mockRestore();
    }
  });

  it('passes the drop position to onNodeMove and refuses a no-op', () => {
    const rects = mockRowRects();
    try {
      const onNodeMove = jest.fn();
      render(<Direactree structure={tree} onNodeMove={onNodeMove} allowReorder isAllExpanded />);
      const dataTransfer = createDataTransfer();
      fireEvent.dragStart(row('a.ts'), { dataTransfer });
      dragAt('drop', row('b.ts'), dataTransfer, 2);
      expect(onNodeMove).not.toHaveBeenCalled();

      fireEvent.dragStart(row('a.ts'), { dataTransfer });
      dragAt('drop', row('b.ts'), dataTransfer, 18);
      expect(onNodeMove).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'a' }),
        expect.objectContaining({ id: 'b' }),
        { position: 'after', parentId: 'src', index: 1 }
      );
    } finally {
      rects.mockRestore();
    }
  });
});

describe('controlled expansion', () => {
  it('follows expandedIds and reports changes', () => {
    const onExpandedChange = jest.fn();
    const { rerender } = render(<Direactree structure={tree} expandedIds={[]} onExpandedChange={onExpandedChange} />);
    fireEvent.click(screen.getByRole('treeitem', { name: 'src' }).querySelector('button') as HTMLElement);
    expect(onExpandedChange).toHaveBeenLastCalledWith(['src']);
    expect(screen.queryByRole('treeitem', { name: 'a.ts' })).not.toBeInTheDocument();

    rerender(<Direactree structure={tree} expandedIds={['src']} onExpandedChange={onExpandedChange} />);
    expect(screen.getByRole('treeitem', { name: 'a.ts' })).toBeInTheDocument();
  });

  it('starts from defaultExpandedIds and exposes getExpandedIds', () => {
    const ref = React.createRef<DireactreeHandle>();
    const onExpandedChange = jest.fn();
    render(<Direactree ref={ref} structure={tree} defaultExpandedIds={['src']} onExpandedChange={onExpandedChange} />);
    expect(screen.getByRole('treeitem', { name: 'a.ts' })).toBeInTheDocument();
    expect(ref.current?.getExpandedIds()).toEqual(['src']);
    act(() => ref.current?.expand('docs'));
    expect(onExpandedChange).toHaveBeenLastCalledWith(['src', 'docs']);
    expect(ref.current?.getExpandedIds()).toEqual(['src', 'docs']);
  });
});

describe('multiple selection', () => {
  it('toggles with Ctrl, extends with Shift, and selects all with Ctrl+A', () => {
    const onSelectionChange = jest.fn();
    const ref = React.createRef<DireactreeHandle>();
    render(<Direactree ref={ref} structure={tree} isAllExpanded selectionMode="multiple" onSelectionChange={onSelectionChange} />);
    expect(screen.getByRole('tree')).toHaveAttribute('aria-multiselectable', 'true');

    fireEvent.click(screen.getByRole('treeitem', { name: 'a.ts' }));
    fireEvent.click(screen.getByRole('treeitem', { name: 'c.ts' }), { ctrlKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['a', 'c'], [
      expect.objectContaining({ id: 'a' }),
      expect.objectContaining({ id: 'c' }),
    ]);
    expect(screen.getByRole('treeitem', { name: 'b.ts' })).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('treeitem', { name: 'docs' }), { shiftKey: true });
    expect(onSelectionChange).toHaveBeenLastCalledWith(['c', 'docs'], expect.any(Array));

    fireEvent.click(screen.getByRole('treeitem', { name: 'a.ts' }));
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'a.ts' }), { key: 'ArrowDown', shiftKey: true });
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'b.ts' }), { key: 'ArrowDown', shiftKey: true });
    expect(ref.current?.getSelectedIds()).toEqual(['a', 'b', 'c']);
    expect(screen.getByRole('treeitem', { name: 'c.ts' })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'c.ts' }), { key: 'a', ctrlKey: true });
    expect(ref.current?.getSelectedIds()).toEqual(['src', 'a', 'b', 'c', 'docs', 'readme']);

    fireEvent.mouseDown(document.body);
    expect(ref.current?.getSelectedIds()).toEqual([]);
  });

  it('follows controlled selectedIds', () => {
    render(<Direactree structure={tree} isAllExpanded selectionMode="multiple" selectedIds={['b', 'readme']} />);
    expect(screen.getByRole('treeitem', { name: 'b.ts' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('treeitem', { name: 'a.ts' }), { ctrlKey: true });
    expect(screen.getByRole('treeitem', { name: 'a.ts' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('type-ahead', () => {
  it('jumps to the next row that starts with the typed letters', () => {
    let now = 0;
    const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
    render(<Direactree structure={tree} isAllExpanded />);
    const src = screen.getByRole('treeitem', { name: 'src' });
    src.focus();
    fireEvent.keyDown(src, { key: 'd' });
    expect(screen.getByRole('treeitem', { name: 'docs' })).toHaveFocus();
    now += 1000;
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'docs' }), { key: 'r' });
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveFocus();
    expect(screen.getByRole('treeitem', { name: 'README.md' })).toHaveAttribute('aria-selected', 'true');

    // Letters typed quickly build one prefix.
    now += 1000;
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'README.md' }), { key: 'b' });
    now += 100;
    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'b.ts' }), { key: '.' });
    expect(screen.getByRole('treeitem', { name: 'b.ts' })).toHaveFocus();
    clock.mockRestore();
  });
});

describe('background and tokens', () => {
  it('paints a theme-colored background by default so dark text never sits on the page color', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    expect(css).toMatch(/\.direactree\s*\{[^}]*--direactree-bg:\s*var\(--direactree-surface\)/);
    expect(css).toMatch(/--direactree-surface:\s*light-dark\(#ffffff, #0f172a\)/);
    expect(css).not.toMatch(/\[data-appearance="card"\]\s*\{[^}]*--direactree-bg/);
  });

  it('takes --direactree-* tokens through style without a cast', () => {
    render(<Direactree structure={tree} style={{ '--direactree-bg': 'transparent', '--direactree-row-height': '24px' }} />);
    const root = document.querySelector('.direactree') as HTMLElement;
    expect(root.style.getPropertyValue('--direactree-bg')).toBe('transparent');
    expect(root.style.getPropertyValue('--direactree-row-height')).toBe('24px');
  });
});

describe('per-theme token values', () => {
  it('passes light-dark() values through style untouched', () => {
    render(<Direactree structure={tree} theme="dark" style={{ '--direactree-selected': 'light-dark(#ede9fe, #4c1d95)' }} />);
    const root = document.querySelector('.direactree') as HTMLElement;
    expect(root.style.getPropertyValue('--direactree-selected')).toBe('light-dark(#ede9fe, #4c1d95)');
    expect(root.style.colorScheme).toBe('dark');
  });
});
