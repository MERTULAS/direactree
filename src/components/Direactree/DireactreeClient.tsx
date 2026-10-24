import React from 'react';
import ReactDOM from 'react-dom';
import './styles.css';
import type {
  ContextMenuEntry,
  ContextMenuItem,
  DireactreeHandle,
  DireactreeMessages,
  DireactreeMutation,
  DireactreeProps,
  DireactreeTheme,
  NodePath,
  NodePermissions,
  NodeType,
  RevealOptions,
  RowRenderState,
  SaveProps,
  ToolboxAction,
  ToolboxIcons,
  TreeNode,
} from './types';
import { applyMessage, defaultDireactreeMessages } from './messages';
import {
  collectAllFolderIds,
  collectInitialExpanded,
  findNode,
  findNodePath,
  getAncestorIds,
  isMoveable,
  locateNode,
  flattenVisible,
  searchTree,
  type VisibleItem,
} from './treeUtils';
import { defaultNameRules, hasNameConflict, validateName as checkName } from './validation';

export type {
  ContextMenuEntry,
  ContextMenuItem,
  DireactreeHandle,
  DireactreeMessages,
  DireactreeMutation,
  DireactreeProps,
  DireactreeTheme,
  LabelRenderState,
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
  setChildren,
  sortChildren,
  updateNode,
} from './treeUtils';
export type { ApplySaveOptions, NodeCompare, NodeLocation } from './treeUtils';
export { useDireactree } from './useDireactree';
export type { SaveOverrides, UseDireactreeOptions, UseDireactreeResult } from './useDireactree';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = TreeNode<any>;

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

type Action = 'createFolder' | 'createFile' | 'rename' | 'delete';

type SelectedAction = {
  action: Action;
  nodeId: string | null;
};

type LoadEntry = { status: 'loading' } | { status: 'error'; message: string };

type Row =
  | { kind: 'node'; key: string; item: VisibleItem<unknown> }
  | { kind: 'editor'; key: string; depth: number }
  | { kind: 'status'; key: string; depth: number; nodeId: string; state: LoadEntry };

type PendingScroll = { id: string; block: NonNullable<RevealOptions['block']>; attempts: number };

type DraftCheck = { name: string; error: string | null };

const DRAG_PAYLOAD_MIME = 'application/json';
const ROW_GAP = 8;
const DEFAULT_ROW_HEIGHT = 32;
const DEFAULT_OVERSCAN = 8;
const EMPTY_FLAGS: Record<string, boolean> = {};

const ALL_ALLOWED: NodePermissions = { rename: true, delete: true, move: true, drop: true, createChild: true };
const NONE_ALLOWED: NodePermissions = { rename: false, delete: false, move: false, drop: false, createChild: false };
const PERMISSION_KEYS: (keyof NodePermissions)[] = ['rename', 'delete', 'move', 'drop', 'createChild'];

// Only used by parts that never render on the server, such as the context menu.
const useIsoLayoutEffect = typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

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

function escapeNodeId(id: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(id);
  }
  return id.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isPromise(value: unknown): value is Promise<unknown> {
  return typeof value === 'object' && value !== null && typeof (value as Promise<unknown>).then === 'function';
}

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error) {
    return error;
  }
  return fallback;
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

/** Index of the row that contains the vertical position `y`. */
function rowIndexAt(offsets: number[], y: number): number {
  let low = 0;
  let high = offsets.length - 2;
  if (high < 0) {
    return 0;
  }
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (offsets[mid] <= y) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low;
}

const SetNode = ({
  selectedNode,
  actionType,
  onCancel,
  onSave,
  createType,
  validate,
  pending = false,
  error = null,
  messages,
}: {
  selectedNode?: NodePath | null;
  actionType: 'create' | 'edit';
  onCancel: () => void;
  onSave: (props: SaveProps) => void;
  createType?: 'folder' | 'file';
  validate: (name: string) => DraftCheck;
  pending?: boolean;
  error?: string | null;
  messages: DireactreeMessages;
}) => {
  const [name, setName] = React.useState(actionType === 'edit' ? selectedNode?.name || '' : '');
  const [dirty, setDirty] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const unchanged = actionType === 'edit' && name === selectedNode?.name;
  const check = unchanged ? { name, error: null } : validate(name);
  const canSave = !pending && name.length > 0 && !unchanged && !check.error;
  const shownError = (dirty && check.error) || error;

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    if (!canSave) {
      setDirty(true);
      return;
    }
    onSave({ newName: check.name, selectedNode: selectedNode || null, actionType, createType });
  };

  return (
    <div className="direactree-editor">
      <div className="direactree-edit-node">
        <input
          ref={inputRef}
          type="text"
          value={name}
          disabled={pending}
          aria-invalid={dirty && check.error ? true : undefined}
          aria-label={actionType === 'edit'
            ? messages.rename
            : createType === 'folder'
              ? messages.newFolderName
              : createType === 'file'
                ? messages.newFileName
                : messages.newItemName}
          onChange={(event) => {
            setName(event.target.value);
            setDirty(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              save();
            } else if (event.key === 'Escape' && !pending) {
              event.preventDefault();
              onCancel();
            }
          }}
        />
        <button type="button" onClick={save} disabled={!canSave}>{messages.save}</button>
        <button type="button" className="direactree-cancel-button" onClick={onCancel} disabled={pending}>{messages.cancel}</button>
      </div>
      {shownError ? <p className="direactree-error" role="alert">{shownError}</p> : null}
    </div>
  );
};

const DireactreeOverlayContext = React.createContext<HTMLElement | null>(null);

const DeleteConfirm = ({
  nodeId,
  name,
  nodeType,
  pending,
  disabled = false,
  error,
  messages,
  onConfirm,
  onCancel,
}: {
  nodeId: string;
  name: string;
  nodeType: NodeType;
  pending: boolean;
  disabled?: boolean;
  error: string | null;
  messages: DireactreeMessages;
  onConfirm: () => void;
  onCancel: () => void;
}) => {
  const controlsDisabled = pending || disabled;
  const overlay = React.useContext(DireactreeOverlayContext);
  const cancelRef = React.useRef<HTMLButtonElement>(null);
  const titleId = React.useRef(`direactree-delete-title-${Math.random().toString(36).slice(2, 8)}`).current;
  const descriptionId = React.useRef(`direactree-delete-description-${Math.random().toString(36).slice(2, 8)}`).current;
  const [place, setPlace] = React.useState<{ top: number; left: number; maxWidth: number; placement: 'top' | 'bottom' } | null>(null);

  React.useEffect(() => {
    cancelRef.current?.focus();
  }, [overlay]);

  React.useEffect(() => {
    if (!overlay) {
      return undefined;
    }
    const root = overlay.closest('.direactree');
    if (!(root instanceof HTMLElement)) {
      return undefined;
    }
    const viewport = root.querySelector('.direactree-viewport');
    const anchor = root.querySelector(`[data-node-id="${escapeNodeId(nodeId)}"]`)?.closest('.direactree-item-anchor');
    if (!(anchor instanceof HTMLElement)) {
      return undefined;
    }

    const placePanel = () => {
      const panel = overlay.querySelector('.direactree-confirm');
      const overlayRect = overlay.getBoundingClientRect();
      const anchorRect = anchor.getBoundingClientRect();
      const viewRect = viewport instanceof HTMLElement ? viewport.getBoundingClientRect() : overlayRect;
      const panelWidth = panel instanceof HTMLElement ? panel.offsetWidth : 220;
      const panelHeight = panel instanceof HTMLElement ? panel.offsetHeight : 0;
      const minLeft = Math.max(0, viewRect.left - overlayRect.left);
      const maxLeft = Math.max(minLeft, viewRect.right - overlayRect.left - panelWidth);
      const left = Math.min(Math.max(anchorRect.left - overlayRect.left, minLeft), maxLeft);
      let top = anchorRect.bottom - overlayRect.top + 4;
      let placement: 'top' | 'bottom' = 'bottom';
      if (panelHeight > 0 && overlayRect.bottom - anchorRect.bottom < panelHeight + 4 && anchorRect.top - overlayRect.top > panelHeight + 4) {
        top = anchorRect.top - overlayRect.top - panelHeight - 4;
        placement = 'top';
      }
      if (panelHeight > 0) {
        top = Math.min(Math.max(0, top), Math.max(0, overlayRect.height - panelHeight));
      }
      const maxWidth = Math.max(0, viewRect.width);
      setPlace((current) => {
        if (
          current
          && current.top === top
          && current.left === left
          && current.maxWidth === maxWidth
          && current.placement === placement
        ) {
          return current;
        }
        return { top, left, maxWidth, placement };
      });
    };

    placePanel();
    viewport?.addEventListener('scroll', placePanel);
    window.addEventListener('resize', placePanel);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(placePanel);
    observer?.observe(root);
    if (viewport instanceof HTMLElement) {
      observer?.observe(viewport);
    }
    observer?.observe(anchor);
    const panel = overlay.querySelector('.direactree-confirm');
    if (panel instanceof HTMLElement) {
      observer?.observe(panel);
    }
    return () => {
      viewport?.removeEventListener('scroll', placePanel);
      window.removeEventListener('resize', placePanel);
      observer?.disconnect();
    };
  }, [overlay, nodeId]);

  if (!overlay) {
    return null;
  }

  return ReactDOM.createPortal(
    <div
      className="direactree-confirm"
      role="group"
      data-placement={place?.placement ?? 'bottom'}
      style={{
        top: place?.top ?? 0,
        left: place?.left ?? 0,
        insetInlineStart: place?.left ?? 0,
        maxWidth: place && place.maxWidth > 0 ? place.maxWidth : undefined,
        visibility: place ? 'visible' : 'hidden',
      }}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={pending}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pending) {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
    >
      <div className="direactree-confirm-copy">
        <p className="direactree-confirm-title" id={titleId}>{applyMessage(messages.deleteTitle, { name })}</p>
        <p className="direactree-confirm-description" id={descriptionId}>
          {nodeType === 'folder' ? messages.deleteFolderDescription : messages.deleteFileDescription}
        </p>
      </div>
      {error ? <p className="direactree-error" role="alert">{error}</p> : null}
      <div className="direactree-confirm-actions">
        <button ref={cancelRef} type="button" className="direactree-cancel-button" onClick={onCancel} disabled={controlsDisabled}>{messages.cancel}</button>
        <button
          type="button"
          className="direactree-danger-button"
          aria-label={pending ? messages.deleting : messages.confirmDelete}
          disabled={controlsDisabled}
          onClick={onConfirm}
        >
          {pending ? messages.deleting : messages.delete}
        </button>
      </div>
    </div>,
    overlay
  );
};

const ContextMenu = ({
  label,
  entries,
  x,
  y,
  onSelect,
  onClose,
}: {
  label: string;
  entries: ContextMenuEntry<unknown>[];
  x: number;
  y: number;
  onSelect: (item: ContextMenuItem<unknown>) => void;
  onClose: (restoreFocus: boolean) => void;
}) => {
  const overlay = React.useContext(DireactreeOverlayContext);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [left, setLeft] = React.useState(x);
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  useIsoLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu || !overlay) {
      setLeft(x);
      return;
    }
    const room = overlay.clientWidth - menu.offsetWidth;
    setLeft(room > 0 ? Math.max(0, Math.min(x, room)) : x);
  }, [x, overlay]);

  React.useEffect(() => {
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    (first ?? menuRef.current)?.focus();
  }, [overlay]);

  React.useEffect(() => {
    const handleDown = (event: MouseEvent) => {
      const target = event.target;
      if (menuRef.current && target instanceof Node && !menuRef.current.contains(target)) {
        onCloseRef.current(false);
      }
    };
    document.addEventListener('mousedown', handleDown);
    return () => document.removeEventListener('mousedown', handleDown);
  }, []);

  if (!overlay) {
    return null;
  }

  const moveFocus = (step: number | 'first' | 'last') => {
    const items = Array.prototype.slice.call(
      menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') ?? []
    ) as HTMLElement[];
    if (!items.length) {
      return;
    }
    const current = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (step === 'first') {
      next = 0;
    } else if (step === 'last') {
      next = items.length - 1;
    } else {
      next = current === -1 ? 0 : (current + step + items.length) % items.length;
    }
    items[next].focus();
  };

  return ReactDOM.createPortal(
    <div
      ref={menuRef}
      className="direactree-menu"
      role="menu"
      aria-label={label}
      tabIndex={-1}
      style={{ top: y, left }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        switch (event.key) {
          case 'ArrowDown':
            event.preventDefault();
            moveFocus(1);
            break;
          case 'ArrowUp':
            event.preventDefault();
            moveFocus(-1);
            break;
          case 'Home':
            event.preventDefault();
            moveFocus('first');
            break;
          case 'End':
            event.preventDefault();
            moveFocus('last');
            break;
          case 'Escape':
            event.preventDefault();
            event.stopPropagation();
            onClose(true);
            break;
          case 'Tab':
            onClose(false);
            break;
          default:
            break;
        }
      }}
    >
      {entries.map((entry, index) => {
        if (entry === 'separator') {
          return <div key={`separator-${index}`} role="separator" className="direactree-menu-separator" />;
        }
        return (
          <button
            key={entry.id}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className={`direactree-menu-item${entry.danger ? ' direactree-menu-item-danger' : ''}`}
            disabled={entry.disabled}
            onClick={() => onSelect(entry)}
          >
            {entry.icon ? <span className="direactree-menu-icon" aria-hidden="true">{entry.icon}</span> : null}
            <span className="direactree-menu-label">{entry.label}</span>
          </button>
        );
      })}
    </div>,
    overlay
  );
};

interface ToolboxProps {
  selectedNode: NodePath | null;
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  toolboxActions?: ToolboxAction[];
  pending?: boolean;
  canCreate: boolean;
  canRename: boolean;
  canDelete: boolean;
  deleteButtonRef?: React.Ref<HTMLButtonElement>;
  messages: DireactreeMessages;
  onCreateFolder: (parentNode: NodePath | null) => void;
  onCreateFile: (parentNode: NodePath | null) => void;
  onRename: (node: NodePath) => void;
  onDelete: (node: NodePath) => void;
}

const Toolbox: React.FC<ToolboxProps> = ({
  selectedNode,
  toolboxIcons,
  toolboxSticky = false,
  toolboxActions,
  pending = false,
  canCreate,
  canRename,
  canDelete,
  deleteButtonRef,
  messages,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete
}) => {
  return (
    <div className={`direactree-toolbox ${toolboxSticky ? 'direactree-toolbox-sticky' : ''}`}>
      <button
        type="button"
        className="direactree-toolbox-button"
        onClick={() => onCreateFolder(selectedNode)}
        aria-label={messages.createFolder}
        title={messages.createFolder}
        disabled={pending || !canCreate}
      >
        {toolboxIcons?.createFolder || <span className="direactree-toolbox-icon" aria-hidden="true">📂</span>}
      </button>
      <button
        type="button"
        className="direactree-toolbox-button"
        onClick={() => onCreateFile(selectedNode)}
        aria-label={messages.createFile}
        title={messages.createFile}
        disabled={pending || !canCreate}
      >
        {toolboxIcons?.createFile || <span className="direactree-toolbox-icon" aria-hidden="true">📄</span>}
      </button>
      <button
        type="button"
        className="direactree-toolbox-button"
        onClick={() => selectedNode && onRename(selectedNode)}
        disabled={pending || !canRename || !selectedNode}
        aria-label={messages.rename}
        title={messages.rename}
      >
        {toolboxIcons?.rename || <span className="direactree-toolbox-icon" aria-hidden="true">✏️</span>}
      </button>
      <button
        ref={deleteButtonRef}
        type="button"
        className="direactree-toolbox-button"
        onClick={() => selectedNode && onDelete(selectedNode)}
        disabled={pending || !canDelete || !selectedNode}
        aria-label={messages.delete}
        title={messages.delete}
      >
        {toolboxIcons?.delete || <span className="direactree-toolbox-icon" aria-hidden="true">🗑️</span>}
      </button>
      {toolboxActions?.map(action => {
        const disabled = typeof action.disabled === 'function' ? action.disabled(selectedNode) : Boolean(action.disabled);
        return (
          <button
            key={action.id}
            type="button"
            className="direactree-toolbox-button"
            onClick={() => action.onClick(selectedNode)}
            disabled={disabled}
            aria-label={action.label}
            title={action.label}
          >
            {action.icon}
          </button>
        );
      })}
    </div>
  );
};

const themeColorScheme = (theme: DireactreeTheme): React.CSSProperties['colorScheme'] => (
  theme === 'system' ? 'light dark' : theme
);

function DireactreeInner(
  props: DireactreeProps<unknown>,
  ref: React.ForwardedRef<DireactreeHandle>
): React.ReactElement {
  const {
    className = '',
    theme = 'system',
    style,
    structure,
    indent = 20,
    showToolbox = true,
    toolboxIcons,
    toolboxSticky = false,
    toolboxActions,
    allowDragAndDrop = true,
    isAllExpanded = false,
    confirmDelete = false,
    messages: messagesProp,
    nameRules: nameRulesProp,
    validateName: validateNameProp,
    getNodePermissions,
    selectedId: selectedIdProp,
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
  const step = validatedIndent + ROW_GAP;
  const selectionControlled = selectedIdProp !== undefined;
  const [internalSelectedId, setInternalSelectedId] = React.useState<string | null>(null);
  const selectedNodeId = selectionControlled ? (selectedIdProp ?? null) : internalSelectedId;
  const [selectedAction, setSelectedAction] = React.useState<SelectedAction | null>(null);
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>(() => (
    isAllExpanded ? collectAllFolderIds(structure) : collectInitialExpanded(structure)
  ));
  const [searchToggleState, setSearchToggleState] = React.useState<{ term: string; open: Record<string, boolean> }>({ term: '', open: {} });
  const [internalSearch, setInternalSearch] = React.useState('');
  const [dragOverNodeId, setDragOverNodeId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<DireactreeMutation | null>(null);
  const [actionError, setActionError] = React.useState<{ kind: DireactreeMutation; message: string } | null>(null);
  const [loadState, setLoadState] = React.useState<Record<string, LoadEntry>>({});
  const [menu, setMenu] = React.useState<{ nodeId: string; x: number; y: number } | null>(null);
  const [announcement, setAnnouncement] = React.useState('');
  const [viewportState, setViewportState] = React.useState({ top: 0, height: 0 });
  const [editorHeight, setEditorHeight] = React.useState(0);
  const [, setRenderTick] = React.useState(0);
  const [overlayElement, setOverlayElement] = React.useState<HTMLDivElement | null>(null);

  const direactreeRef = React.useRef<HTMLDivElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusId = React.useRef<string | null>(null);
  const pendingScrollRef = React.useRef<PendingScroll | null>(null);
  const pendingRevealRef = React.useRef<string | null>(null);
  const draggedIdRef = React.useRef<string | null>(null);
  const requestedLoadsRef = React.useRef<Record<string, boolean>>({});
  const wasAllExpanded = React.useRef(isAllExpanded);
  const pendingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const confirmWasOpen = React.useRef(false);
  const deleteButtonRef = React.useRef<HTMLButtonElement>(null);
  const structureRef = React.useRef(structure);
  const onSelectedNodeChangeRef = React.useRef(onSelectedNodeChange);
  const onSaveRef = React.useRef(onSave);
  const onDeleteRef = React.useRef(onDelete);
  const onNodeMoveRef = React.useRef(onNodeMove);
  const onActionErrorRef = React.useRef(onActionError);
  const onLoadChildrenRef = React.useRef(onLoadChildren);
  const getNodePermissionsRef = React.useRef(getNodePermissions);
  const selectedNodeIdRef = React.useRef(selectedNodeId);
  const selectionControlledRef = React.useRef(selectionControlled);
  const viewportStateRef = React.useRef(viewportState);
  const messages = React.useMemo(
    () => ({ ...defaultDireactreeMessages, ...messagesProp }),
    [messagesProp]
  );
  const nameRules = React.useMemo(() => ({ ...defaultNameRules, ...nameRulesProp }), [nameRulesProp]);
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;
  structureRef.current = structure;
  onSelectedNodeChangeRef.current = onSelectedNodeChange;
  onSaveRef.current = onSave;
  onDeleteRef.current = onDelete;
  onNodeMoveRef.current = onNodeMove;
  onActionErrorRef.current = onActionError;
  onLoadChildrenRef.current = onLoadChildren;
  getNodePermissionsRef.current = getNodePermissions;
  selectedNodeIdRef.current = selectedNodeId;
  selectionControlledRef.current = selectionControlled;
  viewportStateRef.current = viewportState;

  const rawTerm = searchTermProp ?? internalSearch;
  const term = rawTerm.trim();
  const termRef = React.useRef(term);
  termRef.current = term;
  const searchResult = React.useMemo(
    () => (term ? searchTree(structure, term, filterNode) : null),
    [structure, term, filterNode]
  );
  const searchToggles = searchToggleState.term === term ? searchToggleState.open : EMPTY_FLAGS;

  const virtualConfig = virtualized
    ? {
      rowHeight: (typeof virtualized === 'object' && virtualized.rowHeight) || DEFAULT_ROW_HEIGHT,
      overscan: typeof virtualized === 'object' && typeof virtualized.overscan === 'number' ? virtualized.overscan : DEFAULT_OVERSCAN,
      height: typeof virtualized === 'object' ? virtualized.height : undefined,
    }
    : null;
  const isVirtual = virtualConfig !== null;

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

  const rowHeight = virtualConfig?.rowHeight ?? DEFAULT_ROW_HEIGHT;
  const layout = React.useMemo(() => {
    if (!isVirtual) {
      return null;
    }
    const tall = editorHeight || rowHeight * 2;
    const offsets: number[] = [0];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const height = row.kind === 'editor' || (row.kind === 'node' && row.item.id === renamingId) ? tall : rowHeight;
      offsets.push(offsets[i] + height);
    }
    return { offsets, total: offsets[rows.length] };
  }, [isVirtual, rows, rowHeight, editorHeight, renamingId]);
  const layoutRef = React.useRef(layout);
  layoutRef.current = layout;

  let windowStart = 0;
  let windowEnd = rows.length;
  if (layout && virtualConfig) {
    const viewHeight = viewportState.height || rowHeight * 12;
    windowStart = Math.max(0, rowIndexAt(layout.offsets, viewportState.top) - virtualConfig.overscan);
    windowEnd = Math.min(rows.length, rowIndexAt(layout.offsets, viewportState.top + viewHeight) + 1 + virtualConfig.overscan);
  }

  const setSelectedNodeId = React.useCallback((id: string | null) => {
    if (selectionControlledRef.current) {
      if (id !== selectedNodeIdRef.current) {
        onSelectedNodeChangeRef.current?.(id ? findNodePath(structureRef.current, id) : null);
      }
      return;
    }
    setInternalSelectedId(id);
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

  const scrollToRow = (index: number, id: string, block: PendingScroll['block']) => {
    const viewport = viewportRef.current;
    if (!viewport) {
      return;
    }
    const currentLayout = layoutRef.current;
    if (currentLayout) {
      const top = currentLayout.offsets[index];
      const bottom = currentLayout.offsets[index + 1];
      const viewHeight = viewport.clientHeight || viewportStateRef.current.height || rowHeight * 12;
      const current = viewportStateRef.current.top;
      let next = current;
      if (block === 'start') {
        next = top;
      } else if (block === 'end') {
        next = bottom - viewHeight;
      } else if (block === 'center') {
        next = top - (viewHeight - (bottom - top)) / 2;
      } else if (top < current) {
        next = top;
      } else if (bottom > current + viewHeight) {
        next = bottom - viewHeight;
      }
      next = Math.max(0, Math.min(next, Math.max(0, currentLayout.total - viewHeight)));
      if (viewport.scrollTop !== next) {
        viewport.scrollTop = next;
      }
      setViewportState(prev => (prev.top === next ? prev : { ...prev, top: next }));
      return;
    }
    const element = viewport.querySelector(`[data-node-id="${escapeNodeId(id)}"]`);
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
      setSelectedNodeId(id);
    }
    setRenderTick(tick => tick + 1);
    return true;
  };

  const handleRef = React.useRef({ reveal, setExpanded, expandMany });
  handleRef.current = { reveal, setExpanded, expandMany };

  React.useImperativeHandle(ref, () => ({
    revealNode: (id, options) => handleRef.current.reveal(id, options),
    expand: (id) => handleRef.current.setExpanded(id, true),
    collapse: (id) => handleRef.current.setExpanded(id, false),
    expandAll: () => {
      setExpandedNodes(collectAllFolderIds(structureRef.current));
    },
    collapseAll: () => {
      setExpandedNodes({});
      setSearchToggleState({ term: termRef.current, open: {} });
    },
    select: (id) => {
      if (id === null) {
        setSelectedNodeId(null);
        return;
      }
      handleRef.current.reveal(id, { select: true });
    },
    focus: () => {
      const id = selectedNodeIdRef.current ?? visibleItemsRef.current[0]?.id;
      if (!id) {
        return;
      }
      handleRef.current.reveal(id, { select: false, focus: true });
    },
  }), [setSelectedNodeId]);

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
  }, [isAllExpanded, structure]);

  React.useEffect(() => {
    if (selectedNodeId && !findNode(structure, selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [structure, selectedNodeId, setSelectedNodeId]);

  // A controlled `selectedId` that points into a closed folder opens the way to it.
  const previousSelectedProp = React.useRef(selectedIdProp);
  React.useEffect(() => {
    const previous = previousSelectedProp.current;
    previousSelectedProp.current = selectedIdProp;
    if (!selectionControlled || !selectedIdProp || previous === selectedIdProp) {
      return;
    }
    if (!visibleItemsRef.current.some(item => item.id === selectedIdProp)) {
      handleRef.current.reveal(selectedIdProp, { select: false });
    }
  }, [selectionControlled, selectedIdProp]);

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

  React.useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!direactreeRef.current || event.defaultPrevented) {
        return;
      }

      const target = event.target as HTMLElement | null;
      let isInside = false;
      let currentElement = target;

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
        setSelectedNodeId(null);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [selectedAction, setSelectedNodeId]);

  /* Lazy loading */

  const startLoad = React.useCallback((node: AnyNode) => {
    const load = onLoadChildrenRef.current;
    if (!load) {
      return;
    }
    requestedLoadsRef.current[node.id] = true;
    setLoadState(prev => ({ ...prev, [node.id]: { status: 'loading' } }));
    const fail = (error: unknown) => {
      if (mountedRef.current) {
        setLoadState(prev => ({
          ...prev,
          [node.id]: { status: 'error', message: toErrorMessage(error, messagesRef.current.loadFailed) },
        }));
      }
      onActionErrorRef.current?.(error, 'load');
    };
    const done = () => {
      if (mountedRef.current) {
        setLoadState(prev => {
          if (!prev[node.id]) {
            return prev;
          }
          const next = { ...prev };
          delete next[node.id];
          return next;
        });
      }
    };
    let result: unknown;
    try {
      result = load(node);
    } catch (error) {
      fail(error);
      return;
    }
    if (isPromise(result)) {
      result.then(done, fail);
    } else {
      done();
    }
  }, []);

  const lazyEnabled = Boolean(onLoadChildren);
  React.useEffect(() => {
    if (!lazyEnabled) {
      return;
    }
    for (const item of visibleItems) {
      const node = item.node;
      if (
        node.type === 'folder'
        && node.hasChildren
        && node.children === undefined
        && expandedNodesForView[node.id]
        && !requestedLoadsRef.current[node.id]
      ) {
        startLoad(node);
      }
    }
  }, [lazyEnabled, visibleItems, expandedNodesForView, startLoad]);

  const retryLoad = (id: string) => {
    const node = findNode(structureRef.current, id);
    if (node) {
      startLoad(node);
    }
  };

  /* Virtualization measuring */

  React.useEffect(() => {
    if (!isVirtual) {
      return undefined;
    }
    const viewport = viewportRef.current;
    if (!viewport) {
      return undefined;
    }
    const measure = () => {
      setViewportState(prev => (
        prev.height === viewport.clientHeight && prev.top === viewport.scrollTop
          ? prev
          : { top: viewport.scrollTop, height: viewport.clientHeight }
      ));
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(viewport);
    return () => observer?.disconnect();
  }, [isVirtual]);

  React.useEffect(() => {
    if (!isVirtual || !viewportRef.current) {
      return;
    }
    const editor = viewportRef.current.querySelector('.direactree-row-editor, .direactree-row-renaming');
    if (editor instanceof HTMLElement && editor.offsetHeight > 0 && editor.offsetHeight !== editorHeight) {
      setEditorHeight(editor.offsetHeight);
    }
  });

  /* Actions */

  const toggleExpanded = (id: string) => {
    if (isAllExpanded) {
      return;
    }
    setExpanded(id, !expandedNodesForView[id]);
  };

  const selectVisibleItem = (item: VisibleItem<unknown>) => {
    pendingFocusId.current = item.id;
    if (isVirtual) {
      pendingScrollRef.current = { id: item.id, block: 'nearest', attempts: 0 };
    }
    setSelectedNodeId(item.id);
    setRenderTick(tick => tick + 1);
  };

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

  const handleCreateFolder = (node: NodePath | null) => {
    if (!onSaveRef.current || (node && !permissionsById(node.id)?.createChild)) {
      return;
    }
    setActionError(null);
    setSelectedAction({ action: 'createFolder', nodeId: node?.id ?? null });
    if (node?.id) {
      setExpanded(node.id, true);
    }
    onCreateFolder?.(node);
  };

  const handleCreateFile = (node: NodePath | null) => {
    if (!onSaveRef.current || (node && !permissionsById(node.id)?.createChild)) {
      return;
    }
    setActionError(null);
    setSelectedAction({ action: 'createFile', nodeId: node?.id ?? null });
    if (node?.id) {
      setExpanded(node.id, true);
    }
    onCreateFile?.(node);
  };

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

  const moveCheck = (source: AnyNode, target: AnyNode): 'ok' | 'blocked' | 'conflict' => {
    if (!isMoveable(source, target) || !permissionsFor(source).move || !permissionsFor(target).drop) {
      return 'blocked';
    }
    if (hasNameConflict(target.children ?? [], source.name, source.id, nameRules.caseSensitive)) {
      return 'conflict';
    }
    return 'ok';
  };

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
    if (!allowDragAndDrop || !onNodeMoveRef.current || pendingRef.current || node.type !== 'folder') {
      event.stopPropagation();
      if (node.type !== 'folder') {
        event.dataTransfer.dropEffect = 'none';
        setDragOverNodeId(current => (current === null ? current : null));
      }
      return;
    }
    const sourceId = draggedIdRef.current;
    const source = sourceId ? findNode(structureRef.current, sourceId) : null;
    if (source && moveCheck(source, node) !== 'ok') {
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'none';
      setDragOverNodeId(current => (current === null ? current : null));
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    setDragOverNodeId(current => (current === node.id ? current : node.id));
  };

  const handleDragLeave = (event: React.DragEvent<HTMLLIElement>, id: string) => {
    if (!allowDragAndDrop || !onNodeMoveRef.current) {
      return;
    }
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) {
      return;
    }
    setDragOverNodeId(current => (current === id ? null : current));
  };

  const handleDragEnd = () => {
    draggedIdRef.current = null;
    setDragOverNodeId(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLLIElement>, targetNode: AnyNode) => {
    event.stopPropagation();
    setDragOverNodeId(null);
    const draggedId = draggedIdRef.current;
    draggedIdRef.current = null;
    if (!allowDragAndDrop || !onNodeMoveRef.current || targetNode.type !== 'folder' || pendingRef.current) {
      return;
    }

    event.preventDefault();

    const sourceId = readDraggedId(event.dataTransfer) ?? draggedId;
    if (!sourceId || !onNodeMoveRef.current) {
      return;
    }

    const sourceNode = findNode(structureRef.current, sourceId);
    const liveTarget = findNode(structureRef.current, targetNode.id);
    if (!sourceNode || !liveTarget) {
      return;
    }
    const check = moveCheck(sourceNode, liveTarget);
    if (check === 'conflict') {
      setAnnouncement(applyMessage(messagesRef.current.moveConflict, { name: sourceNode.name, target: liveTarget.name }));
      return;
    }
    if (check !== 'ok') {
      return;
    }

    setAnnouncement('');
    setExpanded(liveTarget.id, true);
    beginMutation(
      'move',
      () => onNodeMoveRef.current?.(sourceNode, liveTarget),
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
    setSelectedNodeId(nodeId);
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

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    const index = visibleItems.findIndex(item => item.id === id);
    const item = visibleItems[index];
    if (!item) {
      return;
    }

    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      if (contextMenuEnabled) {
        event.preventDefault();
        event.stopPropagation();
        openMenu(item.id, null);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown': {
        const next = visibleItems[index + 1];
        if (next) {
          event.preventDefault();
          event.stopPropagation();
          selectVisibleItem(next);
        }
        break;
      }
      case 'ArrowUp': {
        const previous = visibleItems[index - 1];
        if (previous) {
          event.preventDefault();
          event.stopPropagation();
          selectVisibleItem(previous);
        }
        break;
      }
      case 'ArrowRight': {
        if (item.node.type !== 'folder') {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (!expandedNodesForView[item.id]) {
          setExpanded(item.id, true);
          return;
        }
        const child = visibleItems[index + 1];
        if (child && child.parentId === item.id) {
          selectVisibleItem(child);
        }
        break;
      }
      case 'ArrowLeft': {
        event.preventDefault();
        event.stopPropagation();
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
        break;
      }
      case 'Home': {
        const first = visibleItems[0];
        if (first) {
          event.preventDefault();
          event.stopPropagation();
          selectVisibleItem(first);
        }
        break;
      }
      case 'End': {
        const last = visibleItems[visibleItems.length - 1];
        if (last) {
          event.preventDefault();
          event.stopPropagation();
          selectVisibleItem(last);
        }
        break;
      }
      case 'Enter':
      case ' ': {
        event.preventDefault();
        event.stopPropagation();
        selectVisibleItem(item);
        break;
      }
      case 'F2': {
        if (canSave && pendingAction === null) {
          event.preventDefault();
          event.stopPropagation();
          setSelectedNodeId(item.id);
          handleRename(item.path);
        }
        break;
      }
      case 'Delete': {
        if (canDelete && pendingAction === null) {
          event.preventDefault();
          event.stopPropagation();
          setSelectedNodeId(item.id);
          handleDelete(item.path);
        }
        break;
      }
      default:
        break;
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
          style={{ left: `${level * step - validatedIndent}px` }}
        />
      );
    }
    return guides;
  };

  const renderEditor = (actionType: 'create' | 'edit', target: NodePath | null) => (
    <SetNode
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
    const isSelected = selectedNodeId === node.id;
    const isRenaming = renamingId === node.id;
    const isExpanded = node.type === 'folder' && !!expandedNodesForView[node.id];
    const perms = permissionsFor(node, item.path);
    const rowState: RowRenderState = { expanded: isExpanded, selected: isSelected, depth: item.depth };
    const isMatch = Boolean(searchResult?.matches[node.id]);
    const highlighted = isMatch ? highlightName(node.name, term) : node.name;
    const badge = renderBadge ? renderBadge(node, rowState) : null;
    const rowClass = [
      'direactree-item',
      'direactree-row',
      isSelected ? 'direactree-item-selected' : '',
      dragOverNodeId === node.id ? 'direactree-item-dragover' : '',
      isMatch ? 'direactree-item-match' : '',
      isRenaming ? 'direactree-row-renaming' : '',
      getRowClassName?.(node, rowState) ?? '',
    ].filter(Boolean).join(' ');

    return (
      <li
        key={node.id}
        role="none"
        draggable={canDrag && perms.move && !isRenaming}
        className={rowClass}
        data-locked={node.locked ? 'true' : undefined}
        style={{
          paddingLeft: `${item.depth * step}px`,
          height: isVirtual && !isRenaming ? `${rowHeight}px` : undefined,
        }}
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
              aria-expanded={node.type === 'folder' ? isExpanded : undefined}
              aria-posinset={item.posinset}
              aria-setsize={item.setsize}
              aria-busy={loadState[node.id]?.status === 'loading' ? true : undefined}
              tabIndex={tabTargetId === node.id ? 0 : -1}
              className={`direactree-item-container ${isSelected ? 'selected' : ''}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNodeId(node.id);
              }}
              onContextMenu={contextMenuEnabled ? (event) => {
                event.preventDefault();
                event.stopPropagation();
                openMenu(node.id, { x: event.clientX, y: event.clientY });
              } : undefined}
              onKeyDown={(event) => handleItemKeyDown(event, node.id)}
            >
              {node.type === 'folder' ? (
                <button
                  type="button"
                  className="direactree-item-button"
                  tabIndex={-1}
                  aria-hidden="true"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleExpanded(node.id);
                  }}
                >
                  {isExpanded ? '▼' : '►'}
                </button>
              ) : (
                <span className="direactree-item-button" aria-hidden="true" />
              )}
              {renderIcon ? (
                <span className="direactree-item-icon" aria-hidden="true">{renderIcon(node, rowState)}</span>
              ) : null}
              <span className="direactree-item-name" title={node.name}>
                {renderLabel ? renderLabel(node, { ...rowState, term, highlighted }) : highlighted}
              </span>
              {badge !== null && badge !== undefined && badge !== false ? (
                <span className="direactree-item-badge">{badge}</span>
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
        <li key={row.key} role="none" className="direactree-row direactree-row-editor" style={{ paddingLeft: `${row.depth * step}px` }}>
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
        style={{ paddingLeft: `${row.depth * step}px`, height: isVirtual ? `${rowHeight}px` : undefined }}
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

  const shownRows = isVirtual ? rows.slice(windowStart, windowEnd) : rows;
  const listStyle: React.CSSProperties | undefined = layout
    ? ({
      paddingTop: `${layout.offsets[windowStart]}px`,
      paddingBottom: `${layout.total - layout.offsets[windowEnd]}px`,
      '--direactree-row-height': `${rowHeight}px`,
    } as React.CSSProperties)
    : undefined;
  const viewportStyle: React.CSSProperties | undefined = virtualConfig?.height !== undefined
    ? { height: typeof virtualConfig.height === 'number' ? `${virtualConfig.height}px` : virtualConfig.height }
    : undefined;

  const menuNode = menu ? findNode(structure, menu.nodeId) : null;
  const menuPath = menu ? findNodePath(structure, menu.nodeId) : null;

  return (
    <DireactreeOverlayContext.Provider value={overlayElement}>
    <div
      className={[
        'direactree',
        deleteConfirmationOpen ? 'direactree-confirm-open' : '',
        isVirtual ? 'direactree-virtualized' : '',
        className,
      ].filter(Boolean).join(' ')}
      data-direactree-theme={theme}
      style={{ colorScheme: themeColorScheme(theme), ...style }}
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
        <div className="direactree-search">
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
        className="direactree-viewport"
        ref={viewportRef}
        style={viewportStyle}
        onScroll={(event) => {
          if (menu) {
            setMenu(null);
          }
          if (isVirtual) {
            const top = event.currentTarget.scrollTop;
            setViewportState(prev => (prev.top === top ? prev : { ...prev, top }));
          }
        }}
      >
        <ul
          className="direactree-list"
          role="tree"
          aria-label={messages.directoryTree}
          style={listStyle}
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
  );
}

const Direactree = React.forwardRef<DireactreeHandle, DireactreeProps<unknown>>(DireactreeInner);
Direactree.displayName = 'Direactree';

/** Directory tree. Pass a `ref` to get the `DireactreeHandle` methods. */
export default Direactree as <T = unknown>(
  props: DireactreeProps<T> & React.RefAttributes<DireactreeHandle>
) => React.ReactElement | null;
