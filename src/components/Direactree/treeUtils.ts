import type { NodePath, SaveProps, TreeNode } from './types';

/*
 * Pure tree helpers. None of them mutate their input: an update returns a new
 * array that shares every untouched branch, and returns the input itself when
 * nothing changed.
 */

export type NodeCompare<T = unknown> = (a: TreeNode<T>, b: TreeNode<T>) => number;

export interface NodeLocation<T = unknown> {
  node: TreeNode<T>;
  /** `null` when the node sits at the root. */
  parent: TreeNode<T> | null;
  siblings: TreeNode<T>[];
  index: number;
}

export function findNode<T>(nodes: TreeNode<T>[], id: string): TreeNode<T> | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children?.length) {
      const found = findNode(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function locateNode<T>(nodes: TreeNode<T>[], id: string, parent: TreeNode<T> | null = null): NodeLocation<T> | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === id) {
      return { node, parent, siblings: nodes, index };
    }
    if (node.children?.length) {
      const found = locateNode(node.children, id, node);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

export function findNodePath<T>(nodes: TreeNode<T>[], id: string, parent: NodePath | null = null): NodePath | null {
  for (const node of nodes) {
    const path: NodePath = {
      name: node.name,
      id: node.id,
      type: node.type,
      parent
    };
    if (node.id === id) {
      return path;
    }
    if (node.children?.length) {
      const found = findNodePath(node.children, id, path);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

/** Ids of every ancestor from the root down to the parent. `null` when the id is not in the tree. */
export function getAncestorIds<T>(nodes: TreeNode<T>[], id: string): string[] | null {
  const path = findNodePath(nodes, id);
  if (!path) {
    return null;
  }
  const ids: string[] = [];
  let current = path.parent;
  while (current) {
    ids.unshift(current.id);
    current = current.parent;
  }
  return ids;
}

export function isDescendant<T>(source: TreeNode<T>, targetId: string): boolean {
  for (const child of source.children ?? []) {
    if (child.id === targetId || isDescendant(child, targetId)) {
      return true;
    }
  }
  return false;
}

/** True when `source` can go into the folder `target`: not itself, not its own descendant, not already there. */
export function isMoveable<T>(source: TreeNode<T>, target: TreeNode<T>): boolean {
  if (source.id === target.id || target.type !== 'folder') {
    return false;
  }
  if (target.children?.some(child => child.id === source.id)) {
    return false;
  }
  if (source.type === 'folder' && isDescendant(source, target.id)) {
    return false;
  }
  return true;
}

function updateIn<T>(
  nodes: TreeNode<T>[],
  id: string,
  update: (node: TreeNode<T>) => TreeNode<T> | null
): TreeNode<T>[] {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.id === id) {
      const next = update(node);
      if (next === node) {
        return nodes;
      }
      const copy = nodes.slice();
      if (next) {
        copy[index] = next;
      } else {
        copy.splice(index, 1);
      }
      return copy;
    }
    if (node.children?.length) {
      const children = updateIn(node.children, id, update);
      if (children !== node.children) {
        const copy = nodes.slice();
        copy[index] = { ...node, children };
        return copy;
      }
    }
  }
  return nodes;
}

function insertAt<T>(list: TreeNode<T>[], node: TreeNode<T>, index?: number): TreeNode<T>[] {
  const copy = list.slice();
  const at = index === undefined ? copy.length : Math.max(0, Math.min(index, copy.length));
  copy.splice(at, 0, node);
  return copy;
}

/** Replaces a node with `patch` merged in, or with what `patch` returns. */
export function updateNode<T>(
  nodes: TreeNode<T>[],
  id: string,
  patch: Partial<TreeNode<T>> | ((node: TreeNode<T>) => TreeNode<T>)
): TreeNode<T>[] {
  return updateIn(nodes, id, node => (typeof patch === 'function' ? patch(node) : { ...node, ...patch }));
}

export function renameNode<T>(nodes: TreeNode<T>[], id: string, name: string): TreeNode<T>[] {
  return updateIn(nodes, id, node => (node.name === name ? node : { ...node, name }));
}

export function removeNode<T>(nodes: TreeNode<T>[], id: string): TreeNode<T>[] {
  return updateIn(nodes, id, () => null);
}

/** Adds `node` to the folder `parentId`, or to the root when `parentId` is `null`. */
export function insertNode<T>(
  nodes: TreeNode<T>[],
  parentId: string | null,
  node: TreeNode<T>,
  index?: number
): TreeNode<T>[] {
  if (parentId === null) {
    return insertAt(nodes, node, index);
  }
  return updateIn(nodes, parentId, parent => (
    parent.type === 'folder' ? { ...parent, children: insertAt(parent.children ?? [], node, index) } : parent
  ));
}

/** Replaces the children of a folder, for example after a lazy load. */
export function setChildren<T>(nodes: TreeNode<T>[], id: string, children: TreeNode<T>[]): TreeNode<T>[] {
  return updateIn(nodes, id, node => (node.type === 'folder' ? { ...node, children } : node));
}

/**
 * Moves a node into the folder `targetId`, or to the root when `targetId` is `null`.
 * `index` places it among the folder's children counted without the moved node,
 * which also reorders a node inside its own folder.
 * Returns the input unchanged when the move is not possible.
 */
export function moveNode<T>(
  nodes: TreeNode<T>[],
  sourceId: string,
  targetId: string | null,
  index?: number
): TreeNode<T>[] {
  const location = locateNode(nodes, sourceId);
  if (!location) {
    return nodes;
  }
  const source = location.node;
  const currentParentId = location.parent?.id ?? null;
  if (targetId !== null) {
    const target = findNode(nodes, targetId);
    if (
      !target
      || target.type !== 'folder'
      || target.id === sourceId
      || (source.type === 'folder' && isDescendant(source, target.id))
    ) {
      return nodes;
    }
  }
  if (currentParentId === targetId) {
    if (index === undefined) {
      return nodes;
    }
    const without = location.siblings.length - 1;
    if (Math.max(0, Math.min(index, without)) === location.index) {
      return nodes;
    }
  }
  return insertNode(removeNode(nodes, sourceId), targetId, source, index);
}

/**
 * Where `source` lands when dropped at `position` relative to `target`.
 * `null` when the drop would not change anything or is not possible.
 */
export function resolveDrop<T>(
  nodes: TreeNode<T>[],
  source: TreeNode<T>,
  target: TreeNode<T>,
  position: 'inside' | 'before' | 'after'
): { parent: TreeNode<T> | null; parentId: string | null; index: number; siblings: TreeNode<T>[] } | null {
  if (source.id === target.id) {
    return null;
  }
  let parent: TreeNode<T> | null;
  let siblings: TreeNode<T>[];
  let index: number;
  if (position === 'inside') {
    if (target.type !== 'folder') {
      return null;
    }
    parent = target;
    siblings = (target.children ?? []).filter(child => child.id !== source.id);
    index = siblings.length;
  } else {
    const location = locateNode(nodes, target.id);
    if (!location) {
      return null;
    }
    parent = location.parent;
    siblings = location.siblings.filter(child => child.id !== source.id);
    index = siblings.findIndex(child => child.id === target.id) + (position === 'after' ? 1 : 0);
  }
  if (parent && (parent.id === source.id || (source.type === 'folder' && isDescendant(source, parent.id)))) {
    return null;
  }
  const parentId = parent ? parent.id : null;
  const current = locateNode(nodes, source.id);
  if (!current) {
    return null;
  }
  const currentParentId = current.parent?.id ?? null;
  // Dropping a node into the folder it already sits in does nothing.
  if (currentParentId === parentId && (position === 'inside' || current.index === index)) {
    return null;
  }
  return { parent, parentId, index, siblings };
}

/** Sorts the children of `parentId`, or the root list when `parentId` is `null`. */
export function sortChildren<T>(nodes: TreeNode<T>[], parentId: string | null, compare: NodeCompare<T>): TreeNode<T>[] {
  const sorted = (list: TreeNode<T>[]) => {
    const copy = list.slice().sort(compare);
    return copy.every((node, i) => node === list[i]) ? list : copy;
  };
  if (parentId === null) {
    return sorted(nodes);
  }
  return updateIn(nodes, parentId, parent => {
    if (!parent.children) {
      return parent;
    }
    const children = sorted(parent.children);
    return children === parent.children ? parent : { ...parent, children };
  });
}

/** Folders first, then names in natural order (`file2` before `file10`). */
export function compareFoldersFirst<T>(a: TreeNode<T>, b: TreeNode<T>): number {
  if (a.type !== b.type) {
    return a.type === 'folder' ? -1 : 1;
  }
  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

let idCounter = 0;

export function createNodeId(): string {
  const cryptoApi = typeof globalThis !== 'undefined'
    ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
    : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }
  idCounter += 1;
  return `node-${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

/** The folder a create request goes into. A selected file means its own folder. */
export function resolveCreateParentId<T>(nodes: TreeNode<T>[], props: SaveProps): string | null {
  const selected = props.selectedNode;
  if (!selected) {
    return null;
  }
  const live = findNode(nodes, selected.id);
  if (live && live.type === 'folder') {
    return live.id;
  }
  const location = locateNode(nodes, selected.id);
  if (location) {
    return location.parent?.id ?? null;
  }
  return selected.parent?.id ?? null;
}

export interface ApplySaveOptions<T = unknown> {
  /** Id for a created node. Use the id your backend returned. */
  id?: string;
  /** `data` for a created node. */
  data?: T;
  createId?: (props: SaveProps) => string;
}

/** Applies an `onSave` payload: a rename, or a new file or folder. */
export function applySave<T>(nodes: TreeNode<T>[], props: SaveProps, options: ApplySaveOptions<T> = {}): TreeNode<T>[] {
  if (props.actionType === 'edit') {
    return props.selectedNode ? renameNode(nodes, props.selectedNode.id, props.newName) : nodes;
  }
  const type = props.createType ?? 'file';
  const node: TreeNode<T> = {
    id: options.id ?? (options.createId ?? createNodeId)(props),
    name: props.newName,
    type,
  };
  if (type === 'folder') {
    node.children = [];
  }
  if (options.data !== undefined) {
    node.data = options.data;
  }
  return insertNode(nodes, resolveCreateParentId(nodes, props), node);
}

/* Internal helpers used by the component. */

export type VisibleItem<T = unknown> = {
  id: string;
  node: TreeNode<T>;
  depth: number;
  path: NodePath;
  parentId: string | null;
  posinset: number;
  setsize: number;
};

export function collectInitialExpanded<T>(nodes: TreeNode<T>[], into: Record<string, boolean> = {}): Record<string, boolean> {
  for (const node of nodes) {
    if (node.type === 'folder' && node.isExpanded) {
      into[node.id] = true;
    }
    if (node.children?.length) {
      collectInitialExpanded(node.children, into);
    }
  }
  return into;
}

export function collectAllFolderIds<T>(nodes: TreeNode<T>[], into: Record<string, boolean> = {}): Record<string, boolean> {
  for (const node of nodes) {
    if (node.type === 'folder') {
      into[node.id] = true;
    }
    if (node.children?.length) {
      collectAllFolderIds(node.children, into);
    }
  }
  return into;
}

/** Rows in display order. `include`, when given, keeps only the listed ids. */
export function flattenVisible<T>(
  nodes: TreeNode<T>[],
  expanded: Record<string, boolean>,
  include?: Record<string, boolean>,
  depth = 0,
  parent: NodePath | null = null,
  into: VisibleItem<T>[] = []
): VisibleItem<T>[] {
  const list = include ? nodes.filter(node => include[node.id]) : nodes;
  list.forEach((node, index) => {
    const path: NodePath = {
      name: node.name,
      id: node.id,
      type: node.type,
      parent
    };
    into.push({
      id: node.id,
      node,
      depth,
      path,
      parentId: parent?.id ?? null,
      posinset: index + 1,
      setsize: list.length
    });

    if (node.type === 'folder' && expanded[node.id] && node.children?.length) {
      flattenVisible(node.children, expanded, include, depth + 1, path, into);
    }
  });
  return into;
}

export interface SearchResult {
  matches: Record<string, boolean>;
  /** Matches and every folder that holds one. */
  include: Record<string, boolean>;
  /** Folders that hold a match. */
  open: Record<string, boolean>;
  count: number;
}

export function searchTree<T>(
  nodes: TreeNode<T>[],
  term: string,
  filterNode?: (node: TreeNode<T>, term: string) => boolean
): SearchResult {
  const result: SearchResult = { matches: {}, include: {}, open: {}, count: 0 };
  const lower = term.toLocaleLowerCase();
  const visit = (list: TreeNode<T>[]): boolean => {
    let any = false;
    for (const node of list) {
      const self = filterNode ? filterNode(node, term) : node.name.toLocaleLowerCase().indexOf(lower) !== -1;
      const inside = node.children?.length ? visit(node.children) : false;
      if (self) {
        result.matches[node.id] = true;
        result.count += 1;
      }
      if (inside) {
        result.open[node.id] = true;
      }
      if (self || inside) {
        result.include[node.id] = true;
        any = true;
      }
    }
    return any;
  };
  visit(nodes);
  return result;
}
