import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import Direactree from './index';
import type { TreeNode } from './DireactreeClient';

const structure: TreeNode[] = [
  {
    id: '1',
    name: 'Folder 1',
    type: 'folder',
    children: [
      {
        id: '1.1',
        name: 'Folder 1.1',
        type: 'folder',
        children: [
          { id: '1.1.1', name: 'File 1.1.1', type: 'file' },
        ],
      },
    ],
  },
  {
    id: '2',
    name: 'Folder 2',
    type: 'folder',
    children: [
      { id: '2.1', name: 'File 2.1', type: 'file' },
    ],
  },
];

function toggleFolder(name: string) {
  const item = screen.getByRole('treeitem', { name });
  const button = item.querySelector('button');
  if (!button) {
    throw new Error(`Missing expand button for ${name}`);
  }
  fireEvent.click(button);
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

describe('Direactree', () => {
  it('selects a node and clears the selection on an outside click', () => {
    const onSelectedNodeChange = jest.fn();
    render(<Direactree structure={structure} onSelectedNodeChange={onSelectedNodeChange} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: '1', name: 'Folder 1' }));
    expect(screen.getByTitle('Folder 1')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(null);
  });

  it('keeps nested expansion when the parent closes and the structure reference changes', () => {
    const { rerender } = render(<Direactree structure={structure} />);

    expect(screen.queryByRole('treeitem', { name: 'Folder 1.1' })).not.toBeInTheDocument();
    toggleFolder('Folder 1');
    toggleFolder('Folder 1.1');
    expect(screen.getByRole('treeitem', { name: 'File 1.1.1' })).toBeInTheDocument();

    toggleFolder('Folder 1');
    expect(screen.queryByRole('treeitem', { name: 'File 1.1.1' })).not.toBeInTheDocument();

    toggleFolder('Folder 1');
    expect(screen.getByRole('treeitem', { name: 'File 1.1.1' })).toBeInTheDocument();

    rerender(<Direactree structure={structure.map(node => ({ ...node }))} />);
    expect(screen.getByRole('treeitem', { name: 'File 1.1.1' })).toBeInTheDocument();
  });

  it('opens folders marked isExpanded and follows isAllExpanded', () => {
    const initiallyOpen: TreeNode[] = [
      {
        id: '1',
        name: 'Folder 1',
        type: 'folder',
        isExpanded: true,
        children: [{ id: '1.1', name: 'Nested file', type: 'file' }],
      },
    ];

    const { rerender } = render(<Direactree structure={initiallyOpen} />);
    expect(screen.getByRole('treeitem', { name: 'Nested file' })).toBeInTheDocument();

    rerender(<Direactree structure={structure} isAllExpanded />);
    expect(screen.getByRole('treeitem', { name: 'File 1.1.1' })).toBeInTheDocument();

    rerender(<Direactree structure={structure} isAllExpanded={false} />);
    expect(screen.queryByRole('treeitem', { name: 'File 1.1.1' })).not.toBeInTheDocument();
  });

  it('creates a node from the editor with Enter and cancels with Escape', () => {
    const onSave = jest.fn();
    render(<Direactree structure={structure} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    const input = screen.getByRole('textbox', { name: 'New folder name' });
    fireEvent.change(input, { target: { value: 'Notes' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSave).toHaveBeenCalledWith({
      newName: 'Notes',
      selectedNode: null,
      actionType: 'create',
      createType: 'folder',
    });
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create File' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New file name' }), { target: { value: 'draft.txt' } });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'New file name' }), { key: 'Escape' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('moves focus and selection with the arrow keys', () => {
    const onSelectedNodeChange = jest.fn();
    render(<Direactree structure={structure} onSelectedNodeChange={onSelectedNodeChange} />);

    const first = screen.getByRole('treeitem', { name: 'Folder 1' });
    expect(first).toHaveAttribute('aria-expanded', 'false');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('treeitem', { name: 'Folder 1' })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('treeitem', { name: 'Folder 1.1' })).toBeInTheDocument();

    fireEvent.keyDown(screen.getByRole('treeitem', { name: 'Folder 1' }), { key: 'ArrowDown' });
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: '1.1' }));
  });

  it('clears the delete action and the selection of the deleted node', () => {
    const onDelete = jest.fn();
    const onSelectedNodeChange = jest.fn();
    const { rerender } = render(
      <Direactree structure={structure} onDelete={onDelete} onSelectedNodeChange={onSelectedNodeChange} />
    );

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
    expect(screen.getByRole('treeitem', { name: 'Folder 1' })).toHaveAttribute('aria-selected', 'true');
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: '1' }));
    expect(screen.queryByRole('group', { name: 'Delete Folder 1?' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 2' }));
    fireEvent.mouseDown(document.body);
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 2' }));
    rerender(
      <Direactree
        structure={structure.filter(node => node.id !== '2')}
        onDelete={onDelete}
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(null);
  });

  it('asks for confirmation before deleting when confirmDelete is set', () => {
    const onDelete = jest.fn();
    const onSelectedNodeChange = jest.fn();
    render(
      <Direactree
        structure={structure}
        confirmDelete
        onDelete={onDelete}
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).not.toHaveBeenCalled();
    const panel = screen.getByRole('group', { name: 'Delete Folder 2?' });
    expect(panel).toHaveTextContent('This folder and its contents will be deleted.');
    expect(panel.closest('.direactree-overlay')).not.toBeNull();
    expect(panel).not.toHaveAttribute('aria-modal');

    fireEvent.mouseDown(document.body);
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: '2' }));

    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: '2' }));
    expect(screen.getByRole('treeitem', { name: 'Folder 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByRole('group', { name: 'Delete Folder 2?' })).not.toBeInTheDocument();
  });

  it('drops a node by id and resolves it from the current tree', () => {
    const onNodeMove = jest.fn();
    render(<Direactree structure={structure} onNodeMove={onNodeMove} />);

    const dataTransfer = createDataTransfer();
    const source = screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li');
    const target = screen.getByRole('treeitem', { name: 'Folder 2' }).closest('li');
    if (!source || !target) {
      throw new Error('Missing drag rows');
    }

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(dataTransfer.store['text/plain']).toBe(JSON.stringify({ id: '1' }));
    expect(onNodeMove).toHaveBeenCalledWith(
      expect.objectContaining({
        id: '1',
        children: [expect.objectContaining({ id: '1.1' })],
      }),
      expect.objectContaining({ id: '2' })
    );
  });

  it('does not move a node onto a file', () => {
    const onNodeMove = jest.fn();
    render(<Direactree structure={structure} onNodeMove={onNodeMove} />);
    toggleFolder('Folder 2');

    const dataTransfer = createDataTransfer();
    const source = screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li');
    const file = screen.getByRole('treeitem', { name: 'File 2.1' }).closest('li');
    if (!source || !file) {
      throw new Error('Missing drag rows');
    }

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(file, { dataTransfer });
    fireEvent.drop(file, { dataTransfer });

    expect(onNodeMove).not.toHaveBeenCalled();
  });

  it('moves the selection to a folder when that folder hides the selected child', () => {
    const onDelete = jest.fn();
    render(<Direactree structure={structure} confirmDelete onDelete={onDelete} />);

    toggleFolder('Folder 2');
    fireEvent.click(screen.getByRole('treeitem', { name: 'File 2.1' }));
    toggleFolder('Folder 2');

    expect(screen.queryByRole('treeitem', { name: 'File 2.1' })).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Folder 2' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.direactree')).not.toHaveClass('direactree-confirm-open');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('group', { name: 'Delete Folder 2?' })).toBeVisible();
  });

  it('keeps a rejected move out of the create form', async () => {
    const onSave = jest.fn();
    const onNodeMove = jest.fn(() => Promise.reject(new Error('move denied')));
    render(<Direactree structure={structure} onSave={onSave} onNodeMove={onNodeMove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    const dataTransfer = createDataTransfer();
    const source = screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li');
    const target = screen.getByRole('treeitem', { name: 'Folder 2' }).closest('li');
    if (!source || !target) {
      throw new Error('Missing drag rows');
    }
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    await act(async () => {
      await Promise.resolve();
    });
    expect(onNodeMove).toHaveBeenCalled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'New folder name' })).toBeInTheDocument();
  });

  it('disables actions that have no callback', () => {
    const { rerender } = render(<Direactree structure={structure} />);

    expect(screen.getByRole('button', { name: 'Create Folder' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create File' })).toBeDisabled();
    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    expect(screen.getByRole('button', { name: 'Rename' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li')).toHaveAttribute('draggable', 'false');

    rerender(<Direactree structure={structure} onSave={jest.fn()} onDelete={jest.fn()} onNodeMove={jest.fn()} />);
    expect(screen.getByRole('button', { name: 'Create Folder' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeEnabled();
    expect(screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li')).toHaveAttribute('draggable', 'true');
  });

  it('sends the current name after the parent renames the selected node', () => {
    const onRename = jest.fn();
    const { rerender } = render(<Direactree structure={structure} onSave={jest.fn()} onRename={onRename} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    rerender(<Direactree structure={structure.map(node => node.id === '1' ? { ...node, name: 'Renamed' } : node)} onSave={jest.fn()} onRename={onRename} />);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));

    expect(onRename).toHaveBeenCalledWith(expect.objectContaining({ id: '1', name: 'Renamed' }));
  });

  it('sends the current parent chain after the parent moves the selected node', () => {
    const onDelete = jest.fn();
    const initial: TreeNode[] = [
      { id: 'a', name: 'A', type: 'folder', children: [{ id: 'file', name: 'Notes', type: 'file' }] },
      { id: 'b', name: 'B', type: 'folder', children: [] },
    ];
    const moved: TreeNode[] = [
      { id: 'a', name: 'A', type: 'folder', children: [] },
      { id: 'b', name: 'B', type: 'folder', children: [{ id: 'file', name: 'Notes', type: 'file' }] },
    ];
    const { rerender } = render(<Direactree structure={initial} onDelete={onDelete} />);

    toggleFolder('A');
    toggleFolder('B');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Notes' }));
    rerender(<Direactree structure={moved} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({
      id: 'file',
      name: 'Notes',
      parent: expect.objectContaining({ id: 'b', name: 'B' }),
    }));
  });

  it('selects the visible parent when a selected file moves into a closed folder', () => {
    const onDelete = jest.fn();
    const initial: TreeNode[] = [
      { id: 'a', name: 'A', type: 'folder', children: [{ id: 'file', name: 'Notes', type: 'file' }] },
      { id: 'b', name: 'B', type: 'folder', children: [] },
    ];
    const moved: TreeNode[] = [
      { id: 'a', name: 'A', type: 'folder', children: [] },
      { id: 'b', name: 'B', type: 'folder', children: [{ id: 'file', name: 'Notes', type: 'file' }] },
    ];
    const { rerender } = render(<Direactree structure={initial} confirmDelete onDelete={onDelete} />);

    toggleFolder('A');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Notes' }));
    rerender(<Direactree structure={moved} confirmDelete onDelete={onDelete} />);

    expect(screen.queryByRole('treeitem', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
    expect(document.querySelector('.direactree')).not.toHaveClass('direactree-confirm-open');

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('group', { name: 'Delete B?' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('disables the editor and dragging while another mutation is pending', async () => {
    let resolveMove: (() => void) | undefined;
    const onNodeMove = jest.fn(() => new Promise<void>((resolve) => {
      resolveMove = resolve;
    }));
    const onSave = jest.fn();
    render(<Direactree structure={structure} onSave={onSave} onNodeMove={onNodeMove} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New folder name' }), { target: { value: 'Notes' } });

    const dataTransfer = createDataTransfer();
    const source = screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li');
    const target = screen.getByRole('treeitem', { name: 'Folder 2' }).closest('li');
    if (!source || !target) {
      throw new Error('Missing drag rows');
    }
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li')).toHaveAttribute('draggable', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();

    await act(async () => {
      resolveMove?.();
    });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled());
  });

  it('clears the folder highlight when the pointer moves onto a child file', () => {
    const onNodeMove = jest.fn();
    render(<Direactree structure={structure} onNodeMove={onNodeMove} />);
    toggleFolder('Folder 2');

    const dataTransfer = createDataTransfer();
    const source = screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li');
    const folder = screen.getByRole('treeitem', { name: 'Folder 2' }).closest('li');
    const file = screen.getByRole('treeitem', { name: 'File 2.1' }).closest('li');
    if (!source || !folder || !file) {
      throw new Error('Missing drag rows');
    }

    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(folder, { dataTransfer });
    expect(folder).toHaveClass('direactree-item-dragover');

    fireEvent.dragOver(file, { dataTransfer });
    expect(folder).not.toHaveClass('direactree-item-dragover');
    expect(dataTransfer.dropEffect).toBe('none');
  });

  it('closes a pending confirmation when that node leaves the structure', () => {
    const { rerender } = render(<Direactree structure={structure} confirmDelete onDelete={jest.fn()} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(screen.getByRole('group', { name: 'Delete Folder 2?' })).toBeInTheDocument();

    rerender(<Direactree structure={structure.filter(node => node.id !== '2')} confirmDelete />);
    expect(screen.queryByRole('group', { name: 'Delete Folder 2?' })).not.toBeInTheDocument();
  });

  it('opens folders added while isAllExpanded stays true', () => {
    const { rerender } = render(<Direactree structure={structure} isAllExpanded />);
    const next: TreeNode[] = [
      ...structure,
      { id: '3', name: 'Folder 3', type: 'folder', children: [{ id: '3.1', name: 'File 3.1', type: 'file' }] },
    ];

    rerender(<Direactree structure={next} isAllExpanded />);
    expect(screen.getByRole('treeitem', { name: 'File 3.1' })).toBeInTheDocument();
  });

  it('blocks a second submit while async save is pending', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = jest.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));
    render(<Direactree structure={structure} onSave={onSave} />);

    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New folder name' }), { target: { value: 'Notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave?.();
    });
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('keeps the typed name when async save fails', async () => {
    const onSave = jest.fn(() => Promise.reject(new Error('nope')));
    render(<Direactree structure={structure} onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New folder name' }), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('nope');
    expect(screen.getByRole('textbox', { name: 'New folder name' })).toHaveValue('Draft');
    expect(screen.getByRole('textbox', { name: 'New folder name' })).toBeEnabled();
  });

  it('keeps the list, selection, and confirmation when delete fails', async () => {
    const onDelete = jest.fn(() => Promise.reject(new Error('denied')));
    const onSelectedNodeChange = jest.fn();
    render(
      <Direactree
        structure={structure}
        confirmDelete
        onDelete={onDelete}
        onSelectedNodeChange={onSelectedNodeChange}
      />
    );

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    const panel = screen.getByRole('group', { name: 'Delete Folder 2?' });
    expect(await screen.findByRole('alert')).toHaveTextContent('denied');
    expect(panel).toContainElement(screen.getByRole('alert'));
    expect(screen.getByRole('button', { name: 'Confirm delete' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeEnabled();
    expect(screen.getByRole('treeitem', { name: 'Folder 2' })).toHaveAttribute('aria-selected', 'true');
    expect(onSelectedNodeChange).toHaveBeenLastCalledWith(expect.objectContaining({ id: '2' }));
  });

  it('does not remove a node from the tree when delete resolves', async () => {
    const onDelete = jest.fn(() => Promise.resolve());
    render(<Direactree structure={structure} confirmDelete onDelete={onDelete} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }));

    await waitFor(() => expect(screen.queryByRole('group', { name: 'Delete Folder 1?' })).not.toBeInTheDocument());
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('treeitem', { name: 'Folder 1' })).toHaveAttribute('aria-selected', 'true');
  });

  it('focuses cancel and closes the inline confirmation with Escape', async () => {
    render(<Direactree structure={structure} confirmDelete onDelete={jest.fn()} />);

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const panel = screen.getByRole('group', { name: 'Delete Folder 1?' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Delete Folder 1?' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveFocus();
  });

  it('applies a resolved save after Strict Mode remounts the effect', async () => {
    let resolveSave: (() => void) | undefined;
    const onSave = jest.fn(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));
    render(
      <React.StrictMode>
        <Direactree structure={structure} onSave={onSave} />
      </React.StrictMode>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'New folder name' }), { target: { value: 'Notes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => {
      resolveSave?.();
    });
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
  });

  it('does not warn about useLayoutEffect while rendering on the server', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const markup = renderToString(<Direactree structure={structure} />);
    const warned = errorSpy.mock.calls.some(call => call.some(part => String(part).includes('useLayoutEffect')));
    errorSpy.mockRestore();
    expect(markup).toContain('Folder 1');
    expect(warned).toBe(false);
  });

  it('does not start a move when drag and drop is disabled', () => {
    const onNodeMove = jest.fn();
    render(<Direactree structure={structure} allowDragAndDrop={false} onNodeMove={onNodeMove} />);
    const dataTransfer = createDataTransfer();
    const source = screen.getByRole('treeitem', { name: 'Folder 1' }).closest('li');
    const target = screen.getByRole('treeitem', { name: 'Folder 2' }).closest('li');
    if (!source || !target) {
      throw new Error('Missing drag rows');
    }

    expect(source).toHaveAttribute('draggable', 'false');
    fireEvent.dragStart(source, { dataTransfer });
    fireEvent.dragOver(target, { dataTransfer });
    fireEvent.drop(target, { dataTransfer });
    expect(dataTransfer.store['text/plain']).toBeUndefined();
    expect(onNodeMove).not.toHaveBeenCalled();
  });

  it('keeps the tree available and places confirmation before folder children', async () => {
    let resolveDelete: (() => void) | undefined;
    const onDelete = jest.fn(() => new Promise<void>((resolve) => {
      resolveDelete = resolve;
    }));
    render(<Direactree structure={structure} confirmDelete onDelete={onDelete} />);

    toggleFolder('Folder 1');
    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const row = screen.getByRole('treeitem', { name: 'Folder 1' });
    const panel = screen.getByRole('group', { name: 'Delete Folder 1?' });
    const confirm = screen.getByRole('button', { name: 'Confirm delete' });
    expect(confirm).toHaveClass('direactree-danger-button');
    expect(row.closest('.direactree')).toHaveClass('direactree-confirm-open');
    const anchor = row.parentElement;
    expect(anchor).toHaveClass('direactree-item-anchor');
    expect(panel.closest('.direactree-overlay')).not.toBeNull();
    expect(panel.closest('.direactree-viewport')).toBeNull();
    expect(row.closest('li')?.nextElementSibling).toContainElement(screen.getByRole('treeitem', { name: 'Folder 1.1' }));
    expect(screen.getByRole('treeitem', { name: 'Folder 1.1' })).toBeInTheDocument();
    expect(document.querySelector('[inert]')).not.toBeInTheDocument();
    expect(document.querySelector('.direactree-background-locked')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());

    fireEvent.keyDown(panel, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.click(confirm);
    expect(screen.getByRole('button', { name: 'Deleting…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Deleting…' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('treeitem', { name: 'Folder 1' })).toBeInTheDocument();

    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.getByRole('group', { name: 'Delete Folder 1?' })).toBeInTheDocument();

    await act(async () => {
      resolveDelete?.();
    });
    await waitFor(() => expect(screen.queryByRole('group', { name: 'Delete Folder 1?' })).not.toBeInTheDocument());
    expect(row.closest('.direactree')).not.toHaveClass('direactree-confirm-open');
    expect(screen.getByRole('treeitem', { name: 'Folder 1' })).toBeInTheDocument();
    expect(screen.getByRole('treeitem', { name: 'Folder 1.1' })).toBeInTheDocument();
  });

  it('uses a file description under the file row', () => {
    render(<Direactree structure={structure} confirmDelete onDelete={jest.fn()} />);
    toggleFolder('Folder 2');
    fireEvent.click(screen.getByRole('treeitem', { name: 'File 2.1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const panel = screen.getByRole('group', { name: 'Delete File 2.1?' });
    expect(panel).toHaveTextContent('This file will be deleted.');
    expect(panel.closest('.direactree-overlay')).not.toBeNull();
    expect(panel.closest('.direactree-viewport')).toBeNull();
  });

  it('scrolls the tree viewport and keeps the editor on one line', () => {
    render(<Direactree structure={structure} onSave={jest.fn()} />);
    const viewport = document.querySelector('.direactree-viewport');
    const toolbox = document.querySelector('.direactree-toolbox');
    expect(viewport).not.toBeNull();
    expect(toolbox?.closest('.direactree-viewport')).toBeNull();
    expect(viewport?.previousElementSibling).toBe(toolbox);

    fireEvent.click(screen.getByRole('button', { name: 'Create Folder' }));
    const editor = document.querySelector('.direactree-edit-node');
    expect(editor?.closest('.direactree-viewport')).toBe(viewport);
    expect(editor?.querySelector('input')?.nextElementSibling).toHaveTextContent('Save');
  });

  it('sets the theme attribute and color-scheme, and lets style override them', () => {
    const { rerender } = render(<Direactree structure={structure} />);
    const root = document.querySelector('.direactree') as HTMLElement;
    expect(root).toHaveAttribute('data-direactree-theme', 'system');
    expect(root.getAttribute('style')).toMatch(/color-scheme:\s*light dark/);

    rerender(<Direactree structure={structure} theme="dark" />);
    expect(root).toHaveAttribute('data-direactree-theme', 'dark');
    expect(root.getAttribute('style')).toMatch(/color-scheme:\s*dark/);

    rerender(<Direactree structure={structure} theme="light" style={{ colorScheme: 'dark', marginTop: '4px' }} />);
    expect(root).toHaveAttribute('data-direactree-theme', 'light');
    expect(root.getAttribute('style')).toMatch(/color-scheme:\s*dark/);
    expect(root.getAttribute('style')).toMatch(/margin-top:\s*4px/);
  });

  it('keeps dark mode behind the system theme and drops unused tokens', () => {
    const css = fs.readFileSync(path.join(__dirname, 'styles.css'), 'utf8');
    const darkMedia = css.match(/@media \(prefers-color-scheme: dark\)\s*\{([\s\S]*?)\n\}/);
    expect(darkMedia?.[1]).toContain('[data-direactree-theme="system"]');
    expect(darkMedia?.[1]).not.toMatch(/\.direactree\s*\{/);
    expect(css).toContain('[data-direactree-theme="dark"]');
    expect(css).toContain('[data-direactree-theme="light"]');
    expect(css).toContain('prefers-reduced-motion');
    expect(css).toContain('forced-colors');
    expect(css).toContain('--direactree-danger-bg');
    expect(css).toContain('--direactree-danger-border');
    expect(css).toContain('.direactree-item-anchor');
    expect(css).toMatch(/\.direactree-confirm\s*\{[^}]*position:\s*absolute/s);
    expect(css).toMatch(/\.direactree-confirm-actions\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(css).toMatch(/\.direactree-confirm button\s*\{[^}]*min-width:\s*0/s);
    expect(css).not.toContain('--direactree-selected-mark');
    expect(css).not.toContain('--direactree-selected-soft');
    expect(css).not.toContain('--direactree-loading-bg');
    expect(css).not.toContain('.direactree-loading');
    expect(css).not.toContain('--direactree-muted');
    expect(css).toContain('@keyframes direactree-fade-in');
    expect(css).not.toMatch(/@keyframes\s+fadeIn\b/);
    expect(css).toMatch(/\.direactree-toolbox\s*\{[^}]*box-sizing:\s*border-box/);
    expect(css).toMatch(/\.direactree-toolbox\s*\{[^}]*max-width:\s*100%/);
    expect(css).toMatch(/\.direactree-toolbox-button\s*\{[^}]*box-sizing:\s*border-box/);
    expect(css).toMatch(/\.direactree-toolbox-button\s*\{[^}]*min-width:\s*0/);
    expect(css).toMatch(/\.direactree-viewport\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/\.direactree-edit-node\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(css).toMatch(/\.direactree-edit-node\s*\{[^}]*width:\s*max-content/);
    expect(css).not.toMatch(/\.direactree\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toContain('.direactree-cancel-button:hover');
    expect(css).not.toContain('button:last-of-type:hover');
  });

  it('replaces built-in copy through the messages prop', () => {
    render(
      <Direactree
        structure={structure}
        confirmDelete
        onDelete={jest.fn()}
        messages={{
          delete: 'Sil',
          cancel: 'Vazgeç',
          deleteTitle: '{name} silinsin mi?',
          deleteFolderDescription: 'Klasör silinecek.',
          confirmDelete: 'Silmeyi onayla',
        }}
      />
    );

    fireEvent.click(screen.getByRole('treeitem', { name: 'Folder 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sil' }));
    expect(screen.getByRole('group', { name: 'Folder 2 silinsin mi?' })).toHaveTextContent('Klasör silinecek.');
    expect(screen.getByRole('button', { name: 'Silmeyi onayla' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Vazgeç' })).toBeInTheDocument();
  });
});
