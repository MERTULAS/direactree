import React from 'react';
import type { NodePath, SaveProps, TreeNode } from './types';
import {
  applySave,
  compareFoldersFirst,
  createNodeId,
  findNode,
  insertNode,
  locateNode,
  moveNode,
  removeNode,
  resolveCreateParentId,
  setChildren as setNodeChildren,
  sortChildren,
  updateNode,
  type NodeCompare,
} from './treeUtils';

export interface UseDireactreeOptions<T = unknown> {
  /** Id for nodes created from `save`. Default: `crypto.randomUUID()` with a fallback. */
  createId?: (props: SaveProps) => string;
  /** Keeps each folder sorted after a change. Default `'none'` keeps insertion order. */
  sort?: 'none' | 'foldersFirst' | NodeCompare<T>;
}

export interface SaveOverrides<T = unknown> {
  /** Id for a created node, such as the one your backend returned. */
  id?: string;
  data?: T;
}

type NodeRef = { id: string } | NodePath;

export interface UseDireactreeResult<T = unknown> {
  structure: TreeNode<T>[];
  setStructure: React.Dispatch<React.SetStateAction<TreeNode<T>[]>>;
  /** Applies an `onSave` payload. Pass it straight to `onSave`, or call it after your request succeeds. */
  save: (props: SaveProps, overrides?: SaveOverrides<T>) => void;
  /** Removes a node and its children. Matches `onDelete`. */
  remove: (node: NodeRef) => void;
  /** Moves a node into a folder, or to the root with `null`. Matches `onNodeMove`. */
  move: (node: NodeRef, target: NodeRef | null, index?: number) => void;
  insert: (parentId: string | null, node: TreeNode<T>, index?: number) => void;
  update: (id: string, patch: Partial<TreeNode<T>> | ((node: TreeNode<T>) => TreeNode<T>)) => void;
  setChildren: (id: string, children: TreeNode<T>[]) => void;
  /** Runs `loader` and stores the result as the folder's children. Use it in `onLoadChildren`. */
  loadChildren: (node: TreeNode<T>, loader: (node: TreeNode<T>) => Promise<TreeNode<T>[]>) => Promise<TreeNode<T>[]>;
  find: (id: string) => TreeNode<T> | null;
  /** Restores the first structure, or sets a new one. */
  reset: (next?: TreeNode<T>[]) => void;
}

function resolveCompare<T>(sort: UseDireactreeOptions<T>['sort']): NodeCompare<T> | null {
  if (!sort || sort === 'none') {
    return null;
  }
  return sort === 'foldersFirst' ? compareFoldersFirst : sort;
}

/**
 * Keeps a tree in React state and returns ready-made updaters that match the
 * Direactree callbacks.
 *
 * ```tsx
 * const tree = useDireactree(initialStructure);
 * <Direactree structure={tree.structure} onSave={tree.save} onDelete={tree.remove} onNodeMove={tree.move} />
 * ```
 */
export function useDireactree<T = unknown>(
  initialStructure: TreeNode<T>[] | (() => TreeNode<T>[]),
  options: UseDireactreeOptions<T> = {}
): UseDireactreeResult<T> {
  const [structure, setStructure] = React.useState<TreeNode<T>[]>(initialStructure);
  const initialRef = React.useRef<TreeNode<T>[] | null>(null);
  if (initialRef.current === null) {
    initialRef.current = structure;
  }
  const structureRef = React.useRef(structure);
  structureRef.current = structure;
  const optionsRef = React.useRef(options);
  optionsRef.current = options;

  const save = React.useCallback((props: SaveProps, overrides: SaveOverrides<T> = {}) => {
    const { createId = createNodeId, sort } = optionsRef.current;
    // The id is made here, not in the updater, so Strict Mode's second updater call reuses it.
    const id = props.actionType === 'create' ? overrides.id ?? createId(props) : undefined;
    setStructure(prev => {
      let next = applySave(prev, props, { id, data: overrides.data });
      const compare = resolveCompare(sort);
      if (compare && next !== prev) {
        const parentId = props.actionType === 'create'
          ? resolveCreateParentId(prev, props)
          : (props.selectedNode ? locateNode(prev, props.selectedNode.id)?.parent?.id ?? null : null);
        next = sortChildren(next, parentId, compare);
      }
      return next;
    });
  }, []);

  const remove = React.useCallback((node: NodeRef) => {
    setStructure(prev => removeNode(prev, node.id));
  }, []);

  const move = React.useCallback((node: NodeRef, target: NodeRef | null, index?: number) => {
    setStructure(prev => {
      const targetId = target ? target.id : null;
      let next = moveNode(prev, node.id, targetId, index);
      const compare = resolveCompare(optionsRef.current.sort);
      if (compare && next !== prev && index === undefined) {
        next = sortChildren(next, targetId, compare);
      }
      return next;
    });
  }, []);

  const insert = React.useCallback((parentId: string | null, node: TreeNode<T>, index?: number) => {
    setStructure(prev => {
      let next = insertNode(prev, parentId, node, index);
      const compare = resolveCompare(optionsRef.current.sort);
      if (compare && next !== prev && index === undefined) {
        next = sortChildren(next, parentId, compare);
      }
      return next;
    });
  }, []);

  const update = React.useCallback((id: string, patch: Partial<TreeNode<T>> | ((node: TreeNode<T>) => TreeNode<T>)) => {
    setStructure(prev => updateNode(prev, id, patch));
  }, []);

  const setChildren = React.useCallback((id: string, children: TreeNode<T>[]) => {
    setStructure(prev => {
      const compare = resolveCompare(optionsRef.current.sort);
      return setNodeChildren(prev, id, compare ? children.slice().sort(compare) : children);
    });
  }, []);

  const loadChildren = React.useCallback((
    node: TreeNode<T>,
    loader: (node: TreeNode<T>) => Promise<TreeNode<T>[]>
  ) => loader(node).then((children) => {
    setChildren(node.id, children);
    return children;
  }), [setChildren]);

  const find = React.useCallback((id: string) => findNode(structureRef.current, id), []);

  const reset = React.useCallback((next?: TreeNode<T>[]) => {
    setStructure(next ?? initialRef.current ?? []);
  }, []);

  return React.useMemo(() => ({
    structure,
    setStructure,
    save,
    remove,
    move,
    insert,
    update,
    setChildren,
    loadChildren,
    find,
    reset,
  }), [structure, save, remove, move, insert, update, setChildren, loadChildren, find, reset]);
}
