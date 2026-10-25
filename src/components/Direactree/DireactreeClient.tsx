import React from 'react';
import type {
  ContextMenuEntry,
  DireactreeHandle,
  DireactreeMutation,
  DireactreeProps,
  DireactreeTheme,
  DropPosition,
  MoveInfo,
  NodePath,
  NodePermissions,
  NodeType,
  RevealOptions,
  RowRenderState,
  SaveProps,
  TreeNode,
} from './types';
import { applyMessage, defaultDireactreeMessages } from './messages';
import {
  collectAllFolderIds,
  collectInitialExpanded,
  findNode,
  findNodePath,
  flattenVisible,
  getAncestorIds,
  locateNode,
  resolveDrop,
  searchTree,
  type VisibleItem,
} from './treeUtils';
import { defaultNameRules, hasNameConflict, validateName as checkName } from './validation';
import { ChevronIcon } from './icons';
import { NameEditor, type DraftCheck } from './NameEditor';
import { DeleteConfirm } from './DeleteConfirm';
import { ContextMenu } from './ContextMenu';
import { Toolbox } from './Toolbox';
import {
  DireactreeClassNamesContext,
  DireactreeOverlayContext,
  cx,
  escapeNodeId,
  isPromise,
  toErrorMessage,
} from './shared';
import { useVirtualWindow, type ScrollBlock } from './useVirtualWindow';
import { useLazyChildren, type LoadEntry } from './useLazyChildren';

export type {
  ContextMenuEntry,
  ContextMenuItem,
  DireactreeAppearance,
  DireactreeDensity,
  DireactreeHandle,
  DireactreeMessages,
  DireactreeMutation,
  DireactreeProps,
  DireactreeSlot,
  DireactreeStyle,
  DireactreeTheme,
  DropPosition,
  LabelRenderState,
  MoveInfo,
  NameRules,
  NameValidationContext,
  NodePath,
  NodePermissions,
  NodeType,
  RevealOptions,
  RowRenderState,
  SaveProps,
  ToolboxAction,
  ToolboxIcons,
  TreeNode,
  VirtualizedOptions,
} from './types';
export { defaultDireactreeMessages } from './messages';
export { defaultNameRules, hasNameConflict, validateName } from './validation';
export type { NameErrorCode, NameValidationResult, ValidateNameOptions } from './validation';
export {
  applySave,
  compareFoldersFirst,
  createNodeId,
  findNode,
  findNodePath,
  getAncestorIds,
  insertNode,
  isMoveable,
  locateNode,
  moveNode,
  removeNode,
  renameNode,
  resolveDrop,
  setChildren,
  sortChildren,
  updateNode,
} from './treeUtils';
export type { ApplySaveOptions, NodeCompare, NodeLocation } from './treeUtils';
export { useDireactree } from './useDireactree';
export type { SaveOverrides, UseDireactreeOptions, UseDireactreeResult } from './useDireactree';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = TreeNode<any>;

type Action = 'createFolder' | 'createFile' | 'rename' | 'delete';
type SelectedAction = { action: Action; nodeId: string | null };
type SelectMode = 'replace' | 'toggle' | 'range';

type Row =
  | { kind: 'node'; key: string; item: VisibleItem<unknown> }
  | { kind: 'editor'; key: string; depth: number }
  | { kind: 'status'; key: string; depth: number; nodeId: string; state: LoadEntry };

type PendingScroll = { id: string; block: ScrollBlock; attempts: number };
type DropIndicator = { id: string; position: DropPosition };
type MoveCheck = { status: 'ok'; info: MoveInfo } | { status: 'blocked' } | { status: 'conflict'; parentName: string };

const DRAG_PAYLOAD_MIME = 'application/json';
const DEFAULT_OVERSCAN = 8;
const ROW_HEIGHTS = { comfortable: 28, compact: 22 };
const TYPEAHEAD_RESET_MS = 700;
const EMPTY_FLAGS: Record<string, boolean> = {};

const ALL_ALLOWED: NodePermissions = { rename: true, delete: true, move: true, drop: true, createChild: true };
const NONE_ALLOWED: NodePermissions = { rename: false, delete: false, move: false, drop: false, createChild: false };
const PERMISSION_KEYS: (keyof NodePermissions)[] = ['rename', 'delete', 'move', 'drop', 'createChild'];

function validateIndent(n: number): number {
  if (n < 8) {
    console.warn('indent must be 8 or greater. 8 will be used.');
    return 8;
  }
  if (n > 50) {
    console.warn('indent must be 50 or less. 50 will be used.');
    return 50;
  }
  return n;
}

function toFlags(ids: string[]): Record<string, boolean> {
  const flags: Record<string, boolean> = {};
  ids.forEach(id => { flags[id] = true; });
  return flags;
}

function flagIds(flags: Record<string, boolean>): string[] {
  return Object.keys(flags).filter(id => flags[id]);
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

function mergePermissions(base: NodePermissions, patch?: Partial<NodePermissions>): NodePermissions {
  if (!patch) {
    return base;
  }
  let next = base;
  for (const key of PERMISSION_KEYS) {
    const value = patch[key];
    if (typeof value === 'boolean' && value !== next[key]) {
      next = next === base ? { ...base } : next;
      next[key] = value;
    }
  }
  return next;
}

function readDraggedId(dataTransfer: DataTransfer): string | null {
  const raw = dataTransfer.getData('text/plain') || dataTransfer.getData(DRAG_PAYLOAD_MIME);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as { id?: unknown };
    return typeof parsed.id === 'string' ? parsed.id : null;
  } catch {
    return null;
  }
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function highlightName(name: string, term: string): React.ReactNode {
  if (!term) {
    return name;
  }
  const match = new RegExp(escapeRegExp(term), 'i').exec(name);
  if (!match) {
    return name;
  }
  const end = match.index + match[0].length;
  return (
    <>
      {name.slice(0, match.index)}
      <mark className="direactree-match">{match[0]}</mark>
      {name.slice(end)}
    </>
  );
}

const themeColorScheme = (theme: DireactreeTheme): React.CSSProperties['colorScheme'] => (
  theme === 'system' ? 'light dark' : theme
);

function DireactreeInner(
  props: DireactreeProps<unknown>,
  ref: React.ForwardedRef<DireactreeHandle>
): React.ReactElement {
  const {
    className = '',
    classNames,
    theme = 'system',
    appearance = 'plain',
    density = 'comfortable',
    style,
    structure,
    indent = 20,
    showToolbox = true,
    toolboxIcons,
    toolboxSticky = false,
    toolboxActions,
    allowDragAndDrop = true,
    allowReorder = false,
    isAllExpanded = false,
    expandedIds: expandedIdsProp,
    defaultExpandedIds,
    onExpandedChange,
    confirmDelete = false,
    messages: messagesProp,
    nameRules: nameRulesProp,
    validateName: validateNameProp,
    getNodePermissions,
    selectionMode = 'single',
    selectedId: selectedIdProp,
    selectedIds: selectedIdsProp,
    onSelectionChange,
    searchTerm: searchTermProp,
    searchMode = 'filter',
    filterNode,
    showSearch = false,
    onSearchChange,
    renderIcon,
    renderLabel,
    renderBadge,
    getRowClassName,
    contextMenu = false,
    virtualized = false,
    onLoadChildren,
    onNodeActivate,
    onCreateFolder,
    onCreateFile,
    onRename,
    onDelete,
    onSave,
    onSelectedNodeChange,
    onNodeMove,
    onActionError,
  } = props;

  const validatedIndent = React.useMemo(() => validateIndent(indent), [indent]);
  const multiple = selectionMode === 'multiple';

  /* State */

  const selectionControlled = selectedIdProp !== undefined;
  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(null);
  const selectedNodeId = selectionControlled ? (selectedIdProp ?? null) : internalSelectedId;
  const selectedIdsControlled = selectedIdsProp !== undefined;
  const [internalSelectedIds, setInternalSelectedIds] = React.useState<string[]>([]);
  const multiIds = selectedIdsControlled ? selectedIdsProp ?? [] : internalSelectedIds;
  const selectedIdList = React.useMemo(
    () => (multiple ? multiIds : (selectedNodeId ? [selectedNodeId] : [])),
    [multiple, multiIds, selectedNodeId]
  );
  const selectedFlags = React.useMemo(() => toFlags(selectedIdList), [selectedIdList]);

  const expandedControlled = expandedIdsProp !== undefined;
  const [internalExpanded, setInternalExpanded] = React.useState<Record<string, boolean>>(() => {
    if (defaultExpandedIds) {
      return toFlags(defaultExpandedIds);
    }
    return isAllExpanded ? collectAllFolderIds(structure) : collectInitialExpanded(structure);
  });
  const controlledExpanded = React.useMemo(
    () => (expandedIdsProp ? toFlags(expandedIdsProp) : null),
    [expandedIdsProp]
  );
  const expandedNodes = controlledExpanded ?? internalExpanded;

  const [selectedAction, setSelectedAction] = React.useState<SelectedAction | null>(null);
  const [searchToggleState, setSearchToggleState] = React.useState<{ term: string; open: Record<string, boolean> }>({ term: '', open: {} });
  const [internalSearch, setInternalSearch] = React.useState('');
  const [dropIndicator, setDropIndicator] = React.useState<DropIndicator | null>(null);
  const [pendingAction, setPendingAction] = React.useState<DireactreeMutation | null>(null);
  const [actionError, setActionError] = React.useState<{ kind: DireactreeMutation; message: string } | null>(null);
  const [menu, setMenu] = React.useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const [, setRenderTick] = React.useState(0);
  const [overlayElement, setOverlayElement] = React.useState<HTMLDivElement | null>(null);

  /* Refs */

  const direactreeRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusId = React.useRef<string | null>(null);
  const pendingScrollRef = React.useRef<PendingScroll | null>(null);
  const pendingRevealRef = React.useRef<string | null>(null);
  const draggedIdRef = React.useRef<string | null>(null);
  const anchorIdRef = React.useRef<string | null>(null);
  const typeaheadRef = React.useRef({ text: '', time: 0 });
  const wasAllExpanded = React.useRef(isAllExpanded);
  const pendingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const confirmWasOpen = React.useRef(false);
  const deleteButtonRef = React.useRef<HTMLButtonElement>(null);

  const messages = React.useMemo(
    () => ({ ...defaultDireactreeMessages, ...messagesProp }),
    [messagesProp]
  );
  const nameRules = React.useMemo(() => ({ ...defaultNameRules, ...nameRulesProp }), [nameRulesProp]);

  // Latest values for callbacks that outlive a render.
  const structureRef = React.useRef(structure);
  structureRef.current = structure;
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;
  const loadFailedRef = React.useRef(messages.loadFailed);
  loadFailedRef.current = messages.loadFailed;
  const onSelectedNodeChangeRef = React.useRef(onSelectedNodeChange);
  onSelectedNodeChangeRef.current = onSelectedNodeChange;
  const onSelectionChangeRef = React.useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;
  const onExpandedChangeRef = React.useRef(onExpandedChange);
  onExpandedChangeRef.current = onExpandedChange;
  const onSaveRef = React.useRef(onSave);
  onSaveRef.current = onSave;
  const onDeleteRef = React.useRef(onDelete);
  onDeleteRef.current = onDelete;
  const onNodeMoveRef = React.useRef(onNodeMove);
  onNodeMoveRef.current = onNodeMove;
  const onActionErrorRef = React.useRef(onActionError);
  onActionErrorRef.current = onActionError;
  const onLoadChildrenRef = React.useRef(onLoadChildren);
  onLoadChildrenRef.current = onLoadChildren;
  const getNodePermissionsRef = React.useRef(getNodePermissions);
  getNodePermissionsRef.current = getNodePermissions;
  const selectedNodeIdRef = React.useRef(selectedNodeId);
  selectedNodeIdRef.current = selectedNodeId;
  const selectedIdListRef = React.useRef(selectedIdList);
  selectedIdListRef.current = selectedIdList;
  const selectionControlledRef = React.useRef(selectionControlled);
  selectionControlledRef.current = selectionControlled;
  const selectedIdsControlledRef = React.useRef(selectedIdsControlled);
  selectedIdsControlledRef.current = selectedIdsControlled;
  const expandedControlledRef = React.useRef(expandedControlled);
  expandedControlledRef.current = expandedControlled;
  const expandedLatestRef = React.useRef(expandedNodes);
  expandedLatestRef.current = expandedNodes;

  /* Derived view */

  const rawTerm = searchTermProp ?? internalSearch;
  const term = rawTerm.trim();
  const termRef = React.useRef(term);
  termRef.current = term;
  const searchResult = React.useMemo(
    () => (term ? searchTree(structure, term, filterNode) : null),
    [structure, term, filterNode]
  );
  const searchToggles = searchToggleState.term === term ? searchToggleState.open : EMPTY_FLAGS;

  const selectedNode = React.useMemo(
    () => (selectedNodeId ? findNodePath(structure, selectedNodeId) : null),
    [structure, selectedNodeId]
  );
  const selectedTreeNode = React.useMemo(
    () => (selectedNodeId ? findNode(structure, selectedNodeId) : null),
    [structure, selectedNodeId]
  );
  const selectedSignature = React.useMemo(() => {
    const parts: string[] = [];
    let current: NodePath | null = selectedNode;
    while (current) {
      parts.push(`${current.id}:${current.name}:${current.type}`);
      current = current.parent;
    }
    return parts.join('/');
  }, [selectedNode]);
  const selectedNodeRef = React.useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const actionNode = React.useMemo(
    () => (selectedAction?.nodeId ? findNodePath(structure, selectedAction.nodeId) : null),
    [structure, selectedAction]
  );
  const allFolderIds = React.useMemo(
    () => (isAllExpanded ? collectAllFolderIds(structure) : null),
    [isAllExpanded, structure]
  );
  const baseExpanded = allFolderIds ?? expandedNodes;
  const expandedNodesForView = React.useMemo(
    () => (searchResult ? { ...baseExpanded, ...searchResult.open, ...searchToggles } : baseExpanded),
    [baseExpanded, searchResult, searchToggles]
  );
  const filterInclude = searchResult && searchMode === 'filter' ? searchResult.include : undefined;
  const visibleItems = React.useMemo(
    () => flattenVisible(structure, expandedNodesForView, filterInclude) as VisibleItem<unknown>[],
    [structure, expandedNodesForView, filterInclude]
  );
  const visibleItemsRef = React.useRef(visibleItems);
  visibleItemsRef.current = visibleItems;
  const tabTargetId = selectedNodeId && visibleItems.some(item => item.id === selectedNodeId)
    ? selectedNodeId
    : visibleItems[0]?.id;
  const pendingDelete = selectedAction?.action === 'delete' ? actionNode : null;
  const deleteConfirmationOpen = Boolean(pendingDelete);
  const saveError = actionError?.kind === 'save' && selectedAction && selectedAction.action !== 'delete'
    ? actionError.message
    : null;
  const deleteError = actionError?.kind === 'delete' && selectedAction?.action === 'delete'
    ? actionError.message
    : null;
  const canSave = Boolean(onSave);
  const canDelete = Boolean(onDelete);
  const canDrag = allowDragAndDrop && Boolean(onNodeMove) && pendingAction === null;
  const contextMenuEnabled = Boolean(contextMenu);
  const isCreating = selectedAction?.action === 'createFolder' || selectedAction?.action === 'createFile';
  const createType = selectedAction?.action === 'createFolder' ? 'folder' : 'file';
  const renamingId = selectedAction?.action === 'rename' ? selectedAction.nodeId : null;

  const permissionsFor = (node: AnyNode, path?: NodePath | null): NodePermissions => {
    let perms = mergePermissions(node.locked ? NONE_ALLOWED : ALL_ALLOWED, node.permissions);
    const getter = getNodePermissionsRef.current;
    if (getter) {
      const resolvedPath = path ?? findNodePath(structureRef.current, node.id);
      if (resolvedPath) {
        perms = mergePermissions(perms, getter(node, resolvedPath));
      }
    }
    return perms;
  };

  const selectedPerms = selectedTreeNode ? permissionsFor(selectedTreeNode, selectedNode) : ALL_ALLOWED;
  const canCreateHere = canSave && (!selectedNode || (selectedNode.type === 'folder' && selectedPerms.createChild));

  const { loadState, retry: retryLoad } = useLazyChildren({
    enabled: Boolean(onLoadChildren),
    visibleItems,
    expanded: expandedNodesForView,
    structureRef,
    onLoadChildrenRef,
    onActionErrorRef,
    loadFailedRef,
  });

  const rows = React.useMemo(() => {
    const out: Row[] = [];
    const createParentId = isCreating ? selectedAction?.nodeId ?? null : null;
    let editorPlaced = !isCreating;
    let waiting = false;
    let editorAfterDepth = -1;
    const placeEditor = (depth: number) => {
      out.push({ kind: 'editor', key: '__direactree-editor__', depth });
      editorPlaced = true;
      waiting = false;
    };
    for (const item of visibleItems) {
      if (waiting && item.depth <= editorAfterDepth) {
        placeEditor(editorAfterDepth + 1);
      }
      out.push({ kind: 'node', key: item.id, item });
      const load = loadState[item.id];
      if (load && item.node.type === 'folder' && expandedNodesForView[item.id] && item.node.children === undefined) {
        out.push({ kind: 'status', key: `__direactree-status-${item.id}`, depth: item.depth + 1, nodeId: item.id, state: load });
      }
      if (!editorPlaced && createParentId !== null && item.id === createParentId) {
        waiting = true;
        editorAfterDepth = item.depth;
      }
    }
    if (!editorPlaced) {
      placeEditor(waiting ? editorAfterDepth + 1 : 0);
    }
    return out;
  }, [visibleItems, isCreating, selectedAction, loadState, expandedNodesForView]);

  const virtualOptions = typeof virtualized === 'object' ? virtualized : {};
  const isVirtual = Boolean(virtualized);
  const tallIndex = rows.findIndex(row => row.kind === 'editor' || (row.kind === 'node' && row.item.id === renamingId));
  const virtual = useVirtualWindow({
    enabled: isVirtual,
    rowCount: rows.length,
    rowHeight: virtualOptions.rowHeight,
    fallbackRowHeight: ROW_HEIGHTS[density],
    overscan: typeof virtualOptions.overscan === 'number' ? virtualOptions.overscan : DEFAULT_OVERSCAN,
    tallIndex,
    rootRef: direactreeRef,
    viewportRef,
  });

  /* Expansion */

  const setExpandedNodes = React.useCallback((
    update: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)
  ) => {
    const prev = expandedLatestRef.current;
    const next = typeof update === 'function' ? update(prev) : update;
    if (next === prev) {
      return;
    }
    expandedLatestRef.current = next;
    if (!expandedControlledRef.current) {
      setInternalExpanded(next);
    }
    onExpandedChangeRef.current?.(flagIds(next));
  }, []);

  const setExpanded = (id: string, open: boolean) => {
    setExpandedNodes(prev => (Boolean(prev[id]) === open ? prev : { ...prev, [id]: open }));
    const activeTerm = termRef.current;
    if (activeTerm) {
      setSearchToggleState(prev => {
        const base = prev.term === activeTerm ? prev.open : {};
        if (prev.term === activeTerm && base[id] === open) {
          return prev;
        }
        return { term: activeTerm, open: { ...base, [id]: open } };
      });
    }
  };

  const expandMany = (ids: string[]) => {
    if (!ids.length) {
      return;
    }
    setExpandedNodes(prev => {
      if (ids.every(id => prev[id])) {
        return prev;
      }
      const next = { ...prev };
      ids.forEach(id => { next[id] = true; });
      return next;
    });
    const activeTerm = termRef.current;
    if (activeTerm) {
      setSearchToggleState(prev => {
        const next = { ...(prev.term === activeTerm ? prev.open : {}) };
        ids.forEach(id => { next[id] = true; });
        return { term: activeTerm, open: next };
      });
    }
  };

  const toggleExpanded = (id: string) => {
    if (isAllExpanded) {
      return;
    }
    setExpanded(id, !expandedNodesForView[id]);
  };

  /* Selection */

  const setSelectedNodeId = React.useCallback((id: string | null) => {
    if (selectionControlledRef.current) {
      if (id !== selectedNodeIdRef.current) {
        onSelectedNodeChangeRef.current?.(id ? findNodePath(structureRef.current, id) : null);
      }
      return;
    }
    setInternalSelectedId(id);
  }, []);

  const commitSelection = React.useCallback((ids: string[]) => {
    if (sameIds(ids, selectedIdListRef.current)) {
      return;
    }
    selectedIdListRef.current = ids;
    if (!selectedIdsControlledRef.current) {
      setInternalSelectedIds(ids);
    }
    const paths = ids
      .map(id => findNodePath(structureRef.current, id))
      .filter((path): path is NodePath => path !== null);
    onSelectionChangeRef.current?.(ids, paths);
  }, []);

  const selectNode = (id: string | null, mode: SelectMode = 'replace') => {
    if (id === null) {
      anchorIdRef.current = null;
      setSelectedNodeId(null);
      if (multiple) {
        commitSelection([]);
      }
      return;
    }
    if (!multiple || mode === 'replace') {
      anchorIdRef.current = id;
      setSelectedNodeId(id);
      if (multiple) {
        commitSelection([id]);
      }
      return;
    }
    if (mode === 'toggle') {
      const current = selectedIdListRef.current;
      anchorIdRef.current = id;
      setSelectedNodeId(id);
      commitSelection(current.indexOf(id) === -1 ? current.concat(id) : current.filter(other => other !== id));
      return;
    }
    const items = visibleItemsRef.current;
    const target = items.findIndex(item => item.id === id);
    let anchor = items.findIndex(item => item.id === (anchorIdRef.current ?? selectedNodeIdRef.current));
    if (anchor === -1) {
      anchor = target;
      anchorIdRef.current = id;
    }
    const low = Math.min(anchor, target);
    const high = Math.max(anchor, target);
    setSelectedNodeId(id);
    commitSelection(items.slice(low, high + 1).map(item => item.id));
  };

  const modeFor = (event: React.MouseEvent | React.KeyboardEvent): SelectMode => {
    if (!multiple) {
      return 'replace';
    }
    if (event.shiftKey) {
      return 'range';
    }
    return event.ctrlKey || event.metaKey ? 'toggle' : 'replace';
  };

  /* Scrolling and reveal */

  const scrollToRow = (index: number, id: string, block: ScrollBlock) => {
    if (virtual.scrollToIndex(index, block)) {
      return;
    }
    const element = viewportRef.current?.querySelector(`[data-node-id="${escapeNodeId(id)}"]`);
    if (element instanceof HTMLElement && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block });
    }
  };

  const reveal = (id: string, options: RevealOptions = {}): boolean => {
    const ancestors = getAncestorIds(structureRef.current, id);
    if (!ancestors) {
      return false;
    }
    const { select = true, focus = false, block = 'nearest' } = options;
    expandMany(ancestors);
    pendingRevealRef.current = id;
    pendingScrollRef.current = { id, block, attempts: 0 };
    if (focus) {
      pendingFocusId.current = id;
    }
    if (select) {
      selectNode(id);
    }
    setRenderTick(tick => tick + 1);
    return true;
  };

  const selectVisibleItem = (item: VisibleItem<unknown>, mode: SelectMode = 'replace') => {
    pendingFocusId.current = item.id;
    if (isVirtual) {
      pendingScrollRef.current = { id: item.id, block: 'nearest', attempts: 0 };
    }
    selectNode(item.id, mode);
    setRenderTick(tick => tick + 1);
  };

  const latest = React.useRef({ reveal, setExpanded, selectNode });
  latest.current = { reveal, setExpanded, selectNode };

  React.useImperativeHandle(ref, () => ({
    revealNode: (id, options) => latest.current.reveal(id, options),
    expand: (id) => latest.current.setExpanded(id, true),
    collapse: (id) => latest.current.setExpanded(id, false),
    expandAll: () => setExpandedNodes(collectAllFolderIds(structureRef.current)),
    collapseAll: () => {
      setExpandedNodes({});
      setSearchToggleState({ term: termRef.current, open: {} });
    },
    select: (id) => {
      if (id === null) {
        latest.current.selectNode(null);
        return;
      }
      latest.current.reveal(id, { select: true });
    },
    focus: () => {
      const id = selectedNodeIdRef.current ?? visibleItemsRef.current[0]?.id;
      if (id) {
        latest.current.reveal(id, { select: false, focus: true });
      }
    },
    getSelectedIds: () => selectedIdListRef.current.slice(),
    getExpandedIds: () => flagIds(expandedLatestRef.current),
  }), [setExpandedNodes]);

  /* Effects */

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    if (wasAllExpanded.current === isAllExpanded) {
      return;
    }
    wasAllExpanded.current = isAllExpanded;
    setExpandedNodes(isAllExpanded ? collectAllFolderIds(structure) : {});
  }, [isAllExpanded, structure, setExpandedNodes]);

  React.useEffect(() => {
    if (selectedNodeId && !findNode(structure, selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [structure, selectedNodeId, setSelectedNodeId]);

  // Drop ids of removed nodes from a multiple selection.
  React.useEffect(() => {
    if (!multiple || !selectedIdList.length) {
      return;
    }
    const kept = selectedIdList.filter(id => findNode(structure, id));
    if (kept.length !== selectedIdList.length) {
      commitSelection(kept);
    }
  }, [multiple, structure, selectedIdList, commitSelection]);

  // A controlled `selectedId` that points into a closed folder opens the way to it.
  const previousSelectedProp = React.useRef(selectedIdProp);
  React.useEffect(() => {
    const previous = previousSelectedProp.current;
    previousSelectedProp.current = selectedIdProp;
    if (!selectionControlled || !selectedIdProp || previous === selectedIdProp) {
      return;
    }
    if (!visibleItemsRef.current.some(item => item.id === selectedIdProp)) {
      latest.current.reveal(selectedIdProp, { select: false });
    }
  }, [selectionControlled, selectedIdProp]);

  // When a folder closes over the selected node, select the nearest visible folder.
  React.useEffect(() => {
    if (
      !selectedNodeId
      || term
      || pendingRevealRef.current === selectedNodeId
      || visibleItems.some(item => item.id === selectedNodeId)
    ) {
      return;
    }
    const path = findNodePath(structure, selectedNodeId);
    if (!path) {
      return;
    }
    const ancestors: NodePath[] = [];
    let current = path.parent;
    while (current) {
      ancestors.push(current);
      current = current.parent;
    }
    let nearestVisibleId: string | null = null;
    let ancestorsOpen = true;
    ancestors.reverse().forEach(ancestor => {
      if (!ancestorsOpen) {
        return;
      }
      nearestVisibleId = ancestor.id;
      if (ancestor.type === 'folder' && !expandedNodesForView[ancestor.id]) {
        ancestorsOpen = false;
      }
    });
    setSelectedAction(null);
    setActionError(null);
    setSelectedNodeId(nearestVisibleId);
  }, [selectedNodeId, visibleItems, structure, expandedNodesForView, term, setSelectedNodeId]);

  React.useEffect(() => {
    if (selectedAction?.nodeId && !findNode(structure, selectedAction.nodeId)) {
      setSelectedAction(null);
      setActionError(null);
    }
  }, [structure, selectedAction]);

  React.useEffect(() => {
    if (menu && !findNode(structure, menu.nodeId)) {
      setMenu(null);
    }
  }, [structure, menu]);

  React.useEffect(() => {
    if (!selectionControlledRef.current) {
      onSelectedNodeChangeRef.current?.(selectedNodeRef.current);
    }
  }, [selectedSignature]);

  // Scroll a revealed row into view once its ancestors are open.
  React.useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) {
      return;
    }
    const index = rows.findIndex(row => row.kind === 'node' && row.item.id === pending.id);
    if (index === -1) {
      pending.attempts += 1;
      if (pending.attempts > 2 || !findNode(structureRef.current, pending.id)) {
        pendingScrollRef.current = null;
      }
      return;
    }
    pendingScrollRef.current = null;
    if (pendingRevealRef.current === pending.id) {
      pendingRevealRef.current = null;
    }
    scrollToRow(index, pending.id, pending.block);
  });

  React.useEffect(() => {
    const id = pendingFocusId.current;
    if (!id || !direactreeRef.current) {
      return;
    }
    const target = direactreeRef.current.querySelector<HTMLElement>(`[data-node-id="${escapeNodeId(id)}"]`);
    if (target) {
      target.focus();
      pendingFocusId.current = null;
    } else if (!visibleItems.some(item => item.id === id)) {
      pendingFocusId.current = null;
    }
  });

  React.useEffect(() => {
    if (!deleteConfirmationOpen) {
      if (confirmWasOpen.current) {
        confirmWasOpen.current = false;
        deleteButtonRef.current?.focus();
      }
      return;
    }
    confirmWasOpen.current = true;
  }, [deleteConfirmationOpen]);

  const selectNodeRef = React.useRef(selectNode);
  selectNodeRef.current = selectNode;
  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!direactreeRef.current || event.defaultPrevented) {
        return;
      }
      let isInside = false;
      let currentElement = event.target as HTMLElement | null;
      while (currentElement) {
        if (
          currentElement.classList.contains('direactree-list') ||
          currentElement.classList.contains('direactree-item-container') ||
          currentElement.classList.contains('direactree-toolbox') ||
          currentElement.classList.contains('direactree-edit-node') ||
          currentElement.classList.contains('direactree-confirm') ||
          currentElement.classList.contains('direactree-menu') ||
          currentElement.classList.contains('direactree-search')
        ) {
          isInside = true;
          break;
        }
        currentElement = currentElement.parentElement;
      }
      if (!isInside && !selectedAction) {
        selectNodeRef.current(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedAction]);

  /* Mutations */

  const beginMutation = (
    kind: DireactreeMutation,
    run: () => void | Promise<void>,
    onSuccess: () => void
  ) => {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    setActionError(null);

    let result: void | Promise<void>;
    try {
      result = run();
    } catch (error) {
      pendingRef.current = false;
      if (mountedRef.current) {
        setActionError({ kind, message: toErrorMessage(error, messagesRef.current.actionFailed) });
      }
      onActionErrorRef.current?.(error, kind);
      return;
    }

    if (!isPromise(result)) {
      pendingRef.current = false;
      onSuccess();
      return;
    }

    setPendingAction(kind);
    result.then(
      () => {
        if (mountedRef.current) {
          onSuccess();
        }
      },
      (error: unknown) => {
        if (mountedRef.current) {
          setActionError({ kind, message: toErrorMessage(error, messagesRef.current.actionFailed) });
        }
        onActionErrorRef.current?.(error, kind);
      }
    ).finally(() => {
      pendingRef.current = false;
      if (mountedRef.current) {
        setPendingAction(null);
      }
    });
  };

  const permissionsById = (id: string): NodePermissions | null => {
    const node = findNode(structureRef.current, id);
    return node ? permissionsFor(node) : null;
  };

  const handleCreate = (action: 'createFolder' | 'createFile', node: NodePath | null) => {
    if (!onSaveRef.current || (node && !permissionsById(node.id)?.createChild)) {
      return;
    }
    setActionError(null);
    setSelectedAction({ action, nodeId: node?.id ?? null });
    if (node?.id) {
      setExpanded(node.id, true);
    }
    (action === 'createFolder' ? onCreateFolder : onCreateFile)?.(node);
  };
  const handleCreateFolder = (node: NodePath | null) => handleCreate('createFolder', node);
  const handleCreateFile = (node: NodePath | null) => handleCreate('createFile', node);

  const handleRename = (node: NodePath) => {
    if (!onSaveRef.current || !permissionsById(node.id)?.rename) {
      return;
    }
    setActionError(null);
    setSelectedAction({ action: 'rename', nodeId: node.id });
    onRename?.(node);
  };

  const performDelete = (nodeId: string) => {
    const node = findNodePath(structureRef.current, nodeId);
    if (!node) {
      return;
    }
    beginMutation(
      'delete',
      () => onDeleteRef.current?.(node),
      () => setSelectedAction(current => (current?.action === 'delete' ? null : current))
    );
  };

  const handleDelete = (node: NodePath) => {
    if (!onDeleteRef.current || !permissionsById(node.id)?.delete) {
      return;
    }
    if (confirmDelete) {
      setActionError(null);
      setSelectedAction({ action: 'delete', nodeId: node.id });
      return;
    }
    performDelete(node.id);
  };

  const handleSave = (saveProps: SaveProps) => {
    const liveNode = saveProps.selectedNode?.id
      ? findNodePath(structureRef.current, saveProps.selectedNode.id)
      : null;
    beginMutation(
      'save',
      () => onSaveRef.current?.({ ...saveProps, selectedNode: liveNode }),
      () => setSelectedAction(null)
    );
  };

  const handleCancel = () => {
    if (pendingRef.current) {
      return;
    }
    setActionError(null);
    setSelectedAction(null);
  };

  const activate = (node: AnyNode, path: NodePath) => {
    onNodeActivate?.(node, path);
  };

  const validateDraft = (
    raw: string,
    actionType: 'create' | 'edit',
    target: NodePath | null,
    draftType?: NodeType
  ): DraftCheck => {
    const tree = structureRef.current;
    let siblings: AnyNode[];
    let parent: NodePath | null;
    let node: NodePath | null = null;
    let type: NodeType;
    if (actionType === 'edit' && target) {
      siblings = locateNode(tree, target.id)?.siblings ?? [];
      parent = target.parent;
      node = target;
      type = target.type;
    } else {
      parent = target && target.type === 'file' ? target.parent : target;
      siblings = parent ? findNode(tree, parent.id)?.children ?? [] : tree;
      type = draftType ?? 'file';
    }
    if (validateNameProp === false) {
      const name = nameRules.trim ? raw.trim() : raw;
      return { name, error: name.trim() ? null : messages.nameEmpty };
    }
    const result = checkName(raw, { siblings, ignoreId: node?.id ?? null, rules: nameRules, messages });
    if (!result.ok) {
      return { name: result.name, error: result.message };
    }
    const custom = validateNameProp?.(result.name, { actionType, type, parent, node, siblings });
    return { name: result.name, error: custom || null };
  };

  /* Drag and drop */

  const moveCheck = (source: AnyNode, target: AnyNode, position: DropPosition): MoveCheck => {
    const tree = structureRef.current;
    const drop = resolveDrop(tree, source, target, position);
    if (!drop || !permissionsFor(source).move || (drop.parent && !permissionsFor(drop.parent).drop)) {
      return { status: 'blocked' };
    }
    const currentParentId = locateNode(tree, source.id)?.parent?.id ?? null;
    if (currentParentId !== drop.parentId && hasNameConflict(drop.siblings, source.name, source.id, nameRules.caseSensitive)) {
      return { status: 'conflict', parentName: drop.parent ? drop.parent.name : messagesRef.current.directoryTree };
    }
    return { status: 'ok', info: { position, parentId: drop.parentId, index: drop.index } };
  };

  const dropPositionFor = (event: React.DragEvent<HTMLLIElement>, node: AnyNode): DropPosition | null => {
    if (!allowReorder) {
      return node.type === 'folder' ? 'inside' : null;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const height = rect.height;
    if (node.type === 'folder') {
      if (height > 0 && y < height * 0.25) {
        return 'before';
      }
      const openWithChildren = expandedNodesForView[node.id] && Boolean(node.children?.length);
      if (height > 0 && y > height * 0.75 && !openWithChildren) {
        return 'after';
      }
      return 'inside';
    }
    return height > 0 && y < height / 2 ? 'before' : 'after';
  };

  const clearIndicator = () => setDropIndicator(current => (current === null ? current : null));

  const handleDragStart = (event: React.DragEvent<HTMLLIElement>, id: string) => {
    const node = findNode(structureRef.current, id);
    if (!allowDragAndDrop || !onNodeMoveRef.current || pendingRef.current || !node || !permissionsFor(node).move) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    draggedIdRef.current = id;
    setMenu(null);
    const payload = JSON.stringify({ id });
    event.dataTransfer.setData('text/plain', payload);
    try {
      event.dataTransfer.setData(DRAG_PAYLOAD_MIME, payload);
    } catch {
      // text/plain already holds the id payload.
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLLIElement>, node: AnyNode) => {
    event.stopPropagation();
    const position = dropPositionFor(event, node);
    if (!allowDragAndDrop || !onNodeMoveRef.current || pendingRef.current || !position) {
      if (!position) {
        event.dataTransfer.dropEffect = 'none';
        clearIndicator();
      }
      return;
    }
    const sourceId = draggedIdRef.current;
    const source = sourceId ? findNode(structureRef.current, sourceId) : null;
    if (source && moveCheck(source, node, position).status !== 'ok') {
      event.dataTransfer.dropEffect = 'none';
      clearIndicator();
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropIndicator(current => (
      current && current.id === node.id && current.position === position ? current : { id: node.id, position }
    ));
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLIElement>, id: string) => {
    if (!allowDragAndDrop || !onNodeMoveRef.current) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setDropIndicator(current => (current && current.id === id ? null : current));
  };

  const handleDragEnd = () => {
    draggedIdRef.current = null;
    clearIndicator();
  };

  const handleDrop = (event: React.DragEvent<HTMLLIElement>, targetNode: AnyNode) => {
    event.stopPropagation();
    clearIndicator();
    const draggedId = draggedIdRef.current;
    draggedIdRef.current = null;
    const position = dropPositionFor(event, targetNode);
    if (!allowDragAndDrop || !onNodeMoveRef.current || !position || pendingRef.current) {
      return;
    }
    event.preventDefault();

    const sourceId = readDraggedId(event.dataTransfer) ?? draggedId;
    const sourceNode = sourceId ? findNode(structureRef.current, sourceId) : null;
    const liveTarget = findNode(structureRef.current, targetNode.id);
    if (!sourceNode || !liveTarget) {
      return;
    }
    const check = moveCheck(sourceNode, liveTarget, position);
    if (check.status === 'conflict') {
      setAnnouncement(applyMessage(messagesRef.current.moveConflict, { name: sourceNode.name, target: check.parentName }));
      return;
    }
    if (check.status !== 'ok') {
      return;
    }
    setAnnouncement('');
    if (check.info.parentId) {
      setExpanded(check.info.parentId, true);
    }
    beginMutation(
      'move',
      () => onNodeMoveRef.current?.(sourceNode, liveTarget, check.info),
      () => undefined
    );
  };

  /* Context menu */

  const openMenu = (nodeId: string, point: { x: number; y: number } | null) => {
    if (!contextMenuEnabled || !overlayElement || !direactreeRef.current) {
      return;
    }
    const overlayRect = overlayElement.getBoundingClientRect();
    let x: number;
    let y: number;
    if (point) {
      x = point.x - overlayRect.left;
      y = point.y - overlayRect.top;
    } else {
      const row = direactreeRef.current.querySelector(`[data-node-id="${escapeNodeId(nodeId)}"]`);
      const rect = row instanceof HTMLElement ? row.getBoundingClientRect() : overlayRect;
      x = rect.left - overlayRect.left + 16;
      y = rect.bottom - overlayRect.top + 2;
    }
    if (!selectedFlags[nodeId]) {
      selectNode(nodeId);
    }
    setMenu({ nodeId, x, y });
  };

  const closeMenu = (restoreFocus: boolean) => {
    const nodeId = menu?.nodeId;
    setMenu(null);
    if (restoreFocus && nodeId) {
      pendingFocusId.current = nodeId;
      setRenderTick(tick => tick + 1);
    }
  };

  const buildMenuEntries = (node: AnyNode, path: NodePath): ContextMenuEntry<unknown>[] => {
    const perms = permissionsFor(node, path);
    const busy = pendingAction !== null;
    const defaults: ContextMenuEntry<unknown>[] = [];
    if (node.type === 'folder') {
      defaults.push(
        { id: 'createFolder', label: messages.createFolder, disabled: busy || !canSave || !perms.createChild, onSelect: () => handleCreateFolder(path) },
        { id: 'createFile', label: messages.createFile, disabled: busy || !canSave || !perms.createChild, onSelect: () => handleCreateFile(path) },
        'separator'
      );
    }
    defaults.push(
      { id: 'rename', label: messages.rename, disabled: busy || !canSave || !perms.rename, onSelect: () => handleRename(path) },
      { id: 'delete', label: messages.delete, danger: true, disabled: busy || !canDelete || !perms.delete, onSelect: () => handleDelete(path) }
    );
    return typeof contextMenu === 'function' ? contextMenu(node, defaults, path) : defaults;
  };

  /* Keyboard */

  const typeahead = (key: string, fromIndex: number): VisibleItem<unknown> | null => {
    const state = typeaheadRef.current;
    const now = Date.now();
    const char = key.toLocaleLowerCase();
    state.text = now - state.time > TYPEAHEAD_RESET_MS ? char : state.text + char;
    state.time = now;
    const repeated = state.text.split('').every(c => c === char);
    const query = repeated ? char : state.text;
    const startAt = repeated ? fromIndex + 1 : fromIndex;
    for (let step = 0; step < visibleItems.length; step += 1) {
      const candidate = visibleItems[(startAt + step) % visibleItems.length];
      if (candidate.node.name.toLocaleLowerCase().indexOf(query) === 0) {
        return candidate;
      }
    }
    return null;
  };

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }
    const index = visibleItems.findIndex(item => item.id === id);
    const item = visibleItems[index];
    if (!item) {
      return;
    }
    const stop = () => {
      event.preventDefault();
      event.stopPropagation();
    };
    const extend: SelectMode = multiple && event.shiftKey ? 'range' : 'replace';

    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      if (contextMenuEnabled) {
        stop();
        openMenu(item.id, null);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        const next = visibleItems[index + 1];
        if (next) {
          stop();
          selectVisibleItem(next, extend);
        }
        return;
      }
      case 'ArrowUp': {
        const previous = visibleItems[index - 1];
        if (previous) {
          stop();
          selectVisibleItem(previous, extend);
        }
        return;
      }
      case 'ArrowRight': {
        if (item.node.type !== 'folder') {
          return;
        }
        stop();
        if (!expandedNodesForView[item.id]) {
          setExpanded(item.id, true);
          return;
        }
        const child = visibleItems[index + 1];
        if (child && child.parentId === item.id) {
          selectVisibleItem(child);
        }
        return;
      }
      case 'ArrowLeft': {
        stop();
        if (!isAllExpanded && item.node.type === 'folder' && expandedNodesForView[item.id]) {
          setExpanded(item.id, false);
          return;
        }
        if (item.parentId) {
          const parent = visibleItems.find(visible => visible.id === item.parentId);
          if (parent) {
            selectVisibleItem(parent);
          }
        }
        return;
      }
      case 'Home':
      case 'End': {
        const edge = event.key === 'Home' ? visibleItems[0] : visibleItems[visibleItems.length - 1];
        if (edge) {
          stop();
          selectVisibleItem(edge, extend);
        }
        return;
      }
      case 'Enter': {
        stop();
        selectVisibleItem(item);
        if (item.node.type === 'folder') {
          toggleExpanded(item.id);
        }
        activate(item.node, item.path);
        return;
      }
      case ' ': {
        stop();
        selectVisibleItem(item, multiple && (event.ctrlKey || event.metaKey) ? 'toggle' : extend);
        return;
      }
      case 'F2': {
        if (canSave && pendingAction === null) {
          stop();
          selectNode(item.id);
          handleRename(item.path);
        }
        return;
      }
      case 'Delete': {
        if (canDelete && pendingAction === null) {
          stop();
          selectNode(item.id);
          handleDelete(item.path);
        }
        return;
      }
      default:
        break;
    }

    if (multiple && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
      stop();
      commitSelection(visibleItems.map(visible => visible.id));
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const found = typeahead(event.key, index);
      if (found) {
        stop();
        selectVisibleItem(found);
      }
    }
  };

  /* Search */

  const changeSearch = (value: string) => {
    if (searchTermProp === undefined) {
      setInternalSearch(value);
    }
    onSearchChange?.(value);
  };

  /* Rendering */

  const renderGuides = (depth: number) => {
    const guides: React.ReactNode[] = [];
    for (let level = 1; level <= depth; level += 1) {
      guides.push(
        <span
          key={level}
          className="direactree-guide"
          aria-hidden="true"
          style={{ '--direactree-guide-level': level } as React.CSSProperties}
        />
      );
    }
    return guides;
  };

  const depthStyle = (depth: number, height?: number): React.CSSProperties => ({
    '--direactree-depth': depth,
    height: height ? `${height}px` : undefined,
  } as React.CSSProperties);

  const renderEditor = (actionType: 'create' | 'edit', target: NodePath | null) => (
    <NameEditor
      selectedNode={target}
      actionType={actionType}
      onCancel={handleCancel}
      onSave={handleSave}
      createType={actionType === 'create' ? createType : undefined}
      validate={(name) => validateDraft(name, actionType, target, actionType === 'create' ? createType : undefined)}
      pending={pendingAction !== null}
      error={saveError}
      messages={messages}
    />
  );

  const renderNodeRow = (item: VisibleItem<unknown>) => {
    const node = item.node;
    const isActive = selectedNodeId === node.id;
    const isSelected = multiple ? Boolean(selectedFlags[node.id]) : isActive;
    const isRenaming = renamingId === node.id;
    const isFolder = node.type === 'folder';
    const isExpanded = isFolder && Boolean(expandedNodesForView[node.id]);
    const perms = permissionsFor(node, item.path);
    const rowState: RowRenderState = { expanded: isExpanded, selected: isSelected, depth: item.depth };
    const isMatch = Boolean(searchResult?.matches[node.id]);
    const highlighted = isMatch ? highlightName(node.name, term) : node.name;
    const badge = renderBadge ? renderBadge(node, rowState) : null;
    const drop = dropIndicator && dropIndicator.id === node.id ? dropIndicator.position : undefined;

    return (
      <li
        key={node.id}
        role="none"
        draggable={canDrag && perms.move && !isRenaming}
        className={cx(
          'direactree-item',
          'direactree-row',
          isSelected && 'direactree-item-selected',
          drop === 'inside' && 'direactree-item-dragover',
          isMatch && 'direactree-item-match',
          isRenaming && 'direactree-row-renaming',
          getRowClassName?.(node, rowState),
          classNames?.row
        )}
        data-kind="node"
        data-type={node.type}
        data-depth={item.depth}
        data-state={isFolder ? (isExpanded ? 'open' : 'closed') : undefined}
        data-selected={isSelected ? '' : undefined}
        data-active={isActive ? '' : undefined}
        data-match={isMatch ? '' : undefined}
        data-locked={node.locked ? 'true' : undefined}
        data-drop-position={drop}
        style={depthStyle(item.depth, isVirtual && !isRenaming ? virtual.rowHeight : undefined)}
        onDragStart={(event) => handleDragStart(event, node.id)}
        onDragOver={(event) => handleDragOver(event, node)}
        onDragLeave={(event) => handleDragLeave(event, node.id)}
        onDragEnd={handleDragEnd}
        onDrop={(event) => handleDrop(event, node)}
      >
        {renderGuides(item.depth)}
        <div className="direactree-item-anchor">
          {isRenaming ? renderEditor('edit', actionNode) : (
            <div
              role="treeitem"
              data-node-id={node.id}
              aria-label={node.name}
              aria-selected={isSelected}
              aria-level={item.depth + 1}
              aria-expanded={isFolder ? isExpanded : undefined}
              aria-posinset={item.posinset}
              aria-setsize={item.setsize}
              aria-busy={loadState[node.id]?.status === 'loading' ? true : undefined}
              tabIndex={tabTargetId === node.id ? 0 : -1}
              className={cx('direactree-item-container', isSelected && 'selected', classNames?.item)}
              onClick={(event) => {
                event.stopPropagation();
                selectNode(node.id, modeFor(event));
              }}
              onDoubleClick={(event) => {
                if ((event.target as HTMLElement).closest('.direactree-item-button')) {
                  return;
                }
                if (isFolder) {
                  toggleExpanded(node.id);
                }
                activate(node, item.path);
              }}
              onContextMenu={contextMenuEnabled ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                openMenu(node.id, { x: event.clientX, y: event.clientY });
              } : undefined}
              onKeyDown={(event) => handleItemKeyDown(event, node.id)}
            >
              {isFolder ? (
                <button
                  type="button"
                  className={cx('direactree-item-button', classNames?.toggle)}
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpanded(node.id);
                  }}
                >
                  <ChevronIcon className="direactree-chevron" />
                </button>
              ) : (
                <span className={cx('direactree-item-button', classNames?.toggle)} aria-hidden="true" />
              )}
              {renderIcon ? (
                <span className={cx('direactree-item-icon', classNames?.icon)} aria-hidden="true">{renderIcon(node, rowState)}</span>
              ) : null}
              <span className={cx('direactree-item-name', classNames?.label)} title={node.name}>
                {renderLabel ? renderLabel(node, { ...rowState, term, highlighted }) : highlighted}
              </span>
              {badge !== null && badge !== undefined && badge !== false ? (
                <span className={cx('direactree-item-badge', classNames?.badge)}>{badge}</span>
              ) : null}
            </div>
          )}
          {selectedAction?.action === 'delete' && selectedAction.nodeId === node.id && (
            <DeleteConfirm
              nodeId={node.id}
              name={node.name}
              nodeType={node.type}
              pending={pendingAction === 'delete'}
              disabled={pendingAction !== null}
              error={deleteError ?? null}
              messages={messages}
              onConfirm={() => performDelete(node.id)}
              onCancel={handleCancel}
            />
          )}
        </div>
      </li>
    );
  };

  const renderRow = (row: Row) => {
    if (row.kind === 'node') {
      return renderNodeRow(row.item);
    }
    if (row.kind === 'editor') {
      return (
        <li key={row.key} role="none" className="direactree-row direactree-row-editor" data-kind="editor" style={depthStyle(row.depth)}>
          {renderGuides(row.depth)}
          {renderEditor('create', actionNode)}
        </li>
      );
    }
    return (
      <li
        key={row.key}
        role="none"
        className="direactree-row direactree-status-row"
        data-kind="status"
        style={depthStyle(row.depth, isVirtual ? virtual.rowHeight : undefined)}
      >
        {renderGuides(row.depth)}
        {row.state.status === 'loading' ? (
          <span className="direactree-status" role="status">
            <span className="direactree-spinner" aria-hidden="true" />
            {messages.loading}
          </span>
        ) : (
          <span className="direactree-status direactree-status-error">
            <span role="alert">{row.state.message}</span>
            <button type="button" className="direactree-retry-button" onClick={() => retryLoad(row.nodeId)}>
              {messages.retry}
            </button>
          </span>
        )}
      </li>
    );
  };

  const shownRows = isVirtual ? rows.slice(virtual.start, virtual.end) : rows;
  const rootStyle = {
    colorScheme: themeColorScheme(theme),
    '--direactree-indent': `${validatedIndent}px`,
    ...(virtualOptions.rowHeight ? { '--direactree-row-height': `${virtualOptions.rowHeight}px` } : {}),
    ...style,
  } as React.CSSProperties;
  const viewportStyle: React.CSSProperties | undefined = virtualOptions.height !== undefined
    ? { height: typeof virtualOptions.height === 'number' ? `${virtualOptions.height}px` : virtualOptions.height }
    : undefined;

  const menuNode = menu ? findNode(structure, menu.nodeId) : null;
  const menuPath = menu ? findNodePath(structure, menu.nodeId) : null;

  return (
    <DireactreeClassNamesContext.Provider value={classNames}>
    <DireactreeOverlayContext.Provider value={overlayElement}>
    <div
      className={cx(
        'direactree',
        deleteConfirmationOpen && 'direactree-confirm-open',
        isVirtual && 'direactree-virtualized',
        className,
        classNames?.root
      )}
      data-direactree-theme={theme}
      data-appearance={appearance}
      data-density={density}
      style={rootStyle}
      ref={direactreeRef}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && pendingDelete && pendingAction !== 'delete') {
          event.preventDefault();
          handleCancel();
        }
      }}
    >
      {showToolbox && (
        <Toolbox
          selectedNode={selectedNode}
          selectedIds={selectedIdList}
          toolboxIcons={toolboxIcons}
          toolboxActions={toolboxActions}
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onRename={handleRename}
          onDelete={handleDelete}
          toolboxSticky={toolboxSticky}
          pending={pendingAction !== null}
          canCreate={canCreateHere}
          canRename={canSave && selectedPerms.rename}
          canDelete={canDelete && selectedPerms.delete}
          deleteButtonRef={deleteButtonRef}
          messages={messages}
        />
      )}
      {showSearch && (
        <div className={cx('direactree-search', classNames?.search)}>
          <input
            type="search"
            className="direactree-search-input"
            aria-label={messages.search}
            placeholder={messages.searchPlaceholder}
            value={rawTerm}
            onChange={(event) => changeSearch(event.target.value)}
            onKeyDown={(event) => {
              if ((event.key === 'ArrowDown' || event.key === 'Enter') && visibleItems.length) {
                event.preventDefault();
                const first = (searchResult && visibleItems.find(item => searchResult.matches[item.id])) || visibleItems[0];
                selectVisibleItem(first);
              } else if (event.key === 'Escape' && rawTerm) {
                event.preventDefault();
                event.stopPropagation();
                changeSearch('');
              }
            }}
          />
        </div>
      )}
      <div
        className={cx('direactree-viewport', classNames?.viewport)}
        ref={viewportRef}
        style={viewportStyle}
        onScroll={(event) => {
          if (menu) {
            setMenu(null);
          }
          virtual.onScroll(event.currentTarget.scrollTop);
        }}
      >
        <ul
          className={cx('direactree-list', classNames?.list)}
          role="tree"
          aria-label={messages.directoryTree}
          aria-multiselectable={multiple ? true : undefined}
          style={virtual.listStyle}
        >
          {shownRows.map(renderRow)}
        </ul>
        {searchResult && visibleItems.length === 0 ? (
          <p className="direactree-empty">{messages.noResults}</p>
        ) : null}
      </div>
      <div className="direactree-overlay" ref={setOverlayElement} />
      <div className="direactree-sr-only" aria-live="polite">{announcement}</div>
      {menu && menuNode && menuPath ? (
        <ContextMenu
          label={applyMessage(messages.contextMenu, { name: menuNode.name })}
          entries={buildMenuEntries(menuNode, menuPath)}
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          onSelect={(item) => {
            setMenu(null);
            item.onSelect(menuNode, menuPath);
          }}
        />
      ) : null}
    </div>
    </DireactreeOverlayContext.Provider>
    </DireactreeClassNamesContext.Provider>
  );
}

const Direactree = React.forwardRef<DireactreeHandle, DireactreeProps<unknown>>(DireactreeInner);
Direactree.displayName = 'Direactree';

/** Directory tree. Pass a `ref` to get the `DireactreeHandle` methods. */
export default Direactree as <T = unknown>(
  props: DireactreeProps<T> & React.RefAttributes<DireactreeHandle>
) => React.ReactElement | null;
