import React from 'react';
import ReactDOM from 'react-dom';
import './styles.css';

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

export interface SaveProps {
  newName: string;
  selectedNode: NodePath | null;
  actionType: 'create' | 'edit';
  createType?: 'folder' | 'file';
}

export type NodePath = {
  name: string;
  id: string;
  type: 'file' | 'folder';
  parent: NodePath | null;
}

export interface TreeNode {
  /** Stable id. Must be unique across the whole tree. */
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: TreeNode[];
  /**
   * Initial open state for a folder. Read only when the tree first mounts.
   * Later open and closed state is kept by the component.
   * While `isAllExpanded` is true, every folder is shown open.
   */
  isExpanded?: boolean;
}

export interface ToolboxIcons {
  createFolder?: React.ReactNode;
  createFile?: React.ReactNode;
  rename?: React.ReactNode;
  delete?: React.ReactNode;
}

export type DireactreeMutation = 'save' | 'delete' | 'move';

export type DireactreeTheme = 'system' | 'light' | 'dark';

export interface DireactreeMessages {
  directoryTree: string;
  createFolder: string;
  createFile: string;
  rename: string;
  delete: string;
  save: string;
  cancel: string;
  newFolderName: string;
  newFileName: string;
  newItemName: string;
  /** `{name}` is replaced with the node name. */
  deleteTitle: string;
  deleteFolderDescription: string;
  deleteFileDescription: string;
  deleting: string;
  confirmDelete: string;
  actionFailed: string;
}

export const defaultDireactreeMessages: DireactreeMessages = {
  directoryTree: 'Directory tree',
  createFolder: 'Create Folder',
  createFile: 'Create File',
  rename: 'Rename',
  delete: 'Delete',
  save: 'Save',
  cancel: 'Cancel',
  newFolderName: 'New folder name',
  newFileName: 'New file name',
  newItemName: 'New item name',
  deleteTitle: 'Delete {name}?',
  deleteFolderDescription: 'This folder and its contents will be deleted.',
  deleteFileDescription: 'This file will be deleted.',
  deleting: 'Deleting…',
  confirmDelete: 'Confirm delete',
  actionFailed: 'Something went wrong.',
};

function applyMessage(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : `{${key}}`
  ));
}

export interface DireactreeProps {
  className?: string;
  /** `system` follows the OS color scheme. `light` and `dark` stay fixed. */
  theme?: DireactreeTheme;
  /** Merged onto the root after the theme `color-scheme` value. */
  style?: React.CSSProperties;
  /** Controlled tree. The component never copies or mutates this list. */
  structure: TreeNode[];
  indent?: number;
  showToolbox?: boolean;
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  allowDragAndDrop?: boolean;
  /**
   * While true, every current and newly added folder is shown open.
   * Changing this from true to false closes every folder.
   */
  isAllExpanded?: boolean;
  confirmDelete?: boolean;
  /** Partial copy overrides. Missing keys keep the English defaults. */
  messages?: Partial<DireactreeMessages>;
  /**
   * Lifecycle notice that the create-folder editor opened.
   * The create request itself is sent from `onSave`.
   */
  onCreateFolder?: (parentNode: NodePath | null) => void;
  /**
   * Lifecycle notice that the create-file editor opened.
   * The create request itself is sent from `onSave`.
   */
  onCreateFile?: (parentNode: NodePath | null) => void;
  /**
   * Lifecycle notice that the rename editor opened.
   * The rename request itself is sent from `onSave`.
   */
  onRename?: (node: NodePath) => void;
  /** Delete intent. Return a Promise to keep the confirmation pending until it settles. */
  onDelete?: (node: NodePath) => void | Promise<void>;
  /** Create or rename intent. Return a Promise to keep the editor pending until it settles. */
  onSave?: (props: SaveProps) => void | Promise<void>;
  onSelectedNodeChange?: (node: NodePath | null) => void;
  /** Move intent. Return a Promise to keep the drop pending until it settles. The tree is not reordered here. */
  onNodeMove?: (node: TreeNode, target: TreeNode) => void | Promise<void>;
  /** Called when a returned Promise from save, delete, or move rejects. */
  onActionError?: (error: unknown, action: DireactreeMutation) => void;
}

type Action = 'createFolder' | 'createFile' | 'rename' | 'delete';

type SelectedAction = {
  action: Action;
  nodeId: string | null;
};

type VisibleItem = {
  id: string;
  node: TreeNode;
  depth: number;
  path: NodePath;
  parentId: string | null;
  posinset: number;
  setsize: number;
};

const DRAG_PAYLOAD_MIME = 'application/json';

function collectInitialExpanded(nodes: TreeNode[], into: Record<string, boolean> = {}): Record<string, boolean> {
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

function collectAllFolderIds(nodes: TreeNode[], into: Record<string, boolean> = {}): Record<string, boolean> {
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

function findNodeById(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children?.length) {
      const found = findNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function findNodePath(nodes: TreeNode[], id: string, parent: NodePath | null = null): NodePath | null {
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

function pathSignature(path: NodePath | null): string {
  if (!path) {
    return '';
  }
  const parts: string[] = [];
  let current: NodePath | null = path;
  while (current) {
    parts.push(`${current.id}:${current.name}:${current.type}`);
    current = current.parent;
  }
  return parts.join('/');
}

function isDescendant(source: TreeNode, targetId: string): boolean {
  for (const child of source.children ?? []) {
    if (child.id === targetId || isDescendant(child, targetId)) {
      return true;
    }
  }
  return false;
}

function isMoveable(source: TreeNode, target: TreeNode): boolean {
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

function flattenVisible(
  nodes: TreeNode[],
  expanded: Record<string, boolean>,
  depth = 0,
  parent: NodePath | null = null
): VisibleItem[] {
  const items: VisibleItem[] = [];

  nodes.forEach((node, index) => {
    const path: NodePath = {
      name: node.name,
      id: node.id,
      type: node.type,
      parent
    };
    items.push({
      id: node.id,
      node,
      depth,
      path,
      parentId: parent?.id ?? null,
      posinset: index + 1,
      setsize: nodes.length
    });

    if (node.type === 'folder' && expanded[node.id] && node.children?.length) {
      items.push(...flattenVisible(node.children, expanded, depth + 1, path));
    }
  });

  return items;
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
  return id.replace(/"/g, '\\"');
}

function isPromise(value: unknown): value is Promise<void> {
  return typeof value === 'object' && value !== null && typeof (value as Promise<void>).then === 'function';
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

const SetNode = ({
  selectedNode,
  actionType,
  onCancel,
  onSave,
  indent,
  createType,
  pending = false,
  error = null,
  messages,
}: {
  selectedNode?: NodePath | null;
  actionType: 'create' | 'edit';
  onCancel: () => void;
  onSave: (props: SaveProps) => void;
  indent: number;
  createType?: 'folder' | 'file';
  pending?: boolean;
  error?: string | null;
  messages: DireactreeMessages;
}) => {
  const [name, setName] = React.useState(actionType === 'edit' ? selectedNode?.name || '' : '');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const canSave = !pending && name.length > 0 && !(actionType === 'edit' && name === selectedNode?.name);

  React.useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const save = () => {
    if (!canSave) {
      return;
    }
    onSave({ newName: name, selectedNode: selectedNode || null, actionType, createType });
  };

  return (
    <div className="direactree-editor" style={{ paddingLeft: `${actionType === 'create' ? indent + 8 : 0}px` }}>
    <div className="direactree-edit-node">
      <input
        ref={inputRef}
        type="text"
        value={name}
        disabled={pending}
        aria-label={actionType === 'edit'
          ? messages.rename
          : createType === 'folder'
            ? messages.newFolderName
            : createType === 'file'
              ? messages.newFileName
              : messages.newItemName}
        onChange={(event) => setName(event.target.value)}
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
      {error ? <p className="direactree-error" role="alert">{error}</p> : null}
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
  nodeType: TreeNode['type'];
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

interface DireactreeNodeProps {
  node: TreeNode[];
  depth: number;
  indent: number;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string) => void;
  selectedAction?: SelectedAction | null;
  actionNode: NodePath | null;
  onSave: (props: SaveProps) => void;
  onCancel: () => void;
  onConfirmDelete: (id: string) => void;
  deletePending?: boolean;
  actionsLocked?: boolean;
  deleteError?: string | null;
  expandedNodes: Record<string, boolean>;
  toggleExpanded: (id: string) => void;
  onItemKeyDown: (event: React.KeyboardEvent<HTMLDivElement>, id: string) => void;
  tabTargetId?: string;
  allowDragAndDrop?: boolean;
  dragOverNodeId: string | null;
  pendingSave?: boolean;
  saveError?: string | null;
  messages: DireactreeMessages;
  onDragStartNode: (event: React.DragEvent<HTMLLIElement>, id: string) => void;
  onDragOverNode: (event: React.DragEvent<HTMLLIElement>, node: TreeNode) => void;
  onDragLeaveNode: (event: React.DragEvent<HTMLLIElement>, id: string) => void;
  onDropNode: (event: React.DragEvent<HTMLLIElement>, node: TreeNode) => void;
}

const DireactreeNode: React.FC<DireactreeNodeProps> = ({
  node,
  depth,
  indent,
  selectedNodeId,
  setSelectedNodeId,
  selectedAction,
  actionNode,
  onSave,
  onCancel,
  onConfirmDelete,
  deletePending = false,
  actionsLocked = false,
  deleteError = null,
  expandedNodes,
  toggleExpanded,
  onItemKeyDown,
  tabTargetId,
  allowDragAndDrop = true,
  dragOverNodeId,
  pendingSave = false,
  saveError = null,
  messages,
  onDragStartNode,
  onDragOverNode,
  onDragLeaveNode,
  onDropNode
}) => {
  const isCreating = selectedAction?.action === 'createFolder' || selectedAction?.action === 'createFile';
  const createType = selectedAction?.action === 'createFolder' ? 'folder' : 'file';

  return (
    <>
      <ul
        className="direactree-list"
        role={depth === 0 ? 'tree' : 'group'}
        aria-label={depth === 0 ? messages.directoryTree : undefined}
        style={{ paddingLeft: `${depth === 0 ? 0 : indent}px` }}
      >
        {node.map((nodeChild, index) => {
          const isSelected = selectedNodeId === nodeChild.id;
          const isRenaming = selectedAction?.action === 'rename' && selectedAction.nodeId === nodeChild.id;
          const isExpanded = nodeChild.type === 'folder' && !!expandedNodes[nodeChild.id];

          return (
            <li
              role="none"
              draggable={allowDragAndDrop && !isRenaming}
              className={`direactree-item ${isSelected ? 'direactree-item-selected' : ''} ${dragOverNodeId === nodeChild.id ? 'direactree-item-dragover' : ''}`}
              key={nodeChild.id}
              onDragStart={(event) => onDragStartNode(event, nodeChild.id)}
              onDragOver={(event) => onDragOverNode(event, nodeChild)}
              onDragLeave={(event) => onDragLeaveNode(event, nodeChild.id)}
              onDrop={(event) => onDropNode(event, nodeChild)}
            >
              <div className="direactree-item-anchor">
              {isRenaming ? (
                <SetNode
                  selectedNode={actionNode}
                  actionType="edit"
                  onCancel={onCancel}
                  onSave={onSave}
                  indent={indent}
                  pending={pendingSave}
                  error={saveError}
                  messages={messages}
                />
              ) : (
                <div
                  role="treeitem"
                  data-node-id={nodeChild.id}
                  aria-label={nodeChild.name}
                  aria-selected={isSelected}
                  aria-level={depth + 1}
                  aria-expanded={nodeChild.type === 'folder' ? isExpanded : undefined}
                  aria-posinset={index + 1}
                  aria-setsize={node.length}
                  tabIndex={tabTargetId === nodeChild.id ? 0 : -1}
                  className={`direactree-item-container ${isSelected ? 'selected' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(nodeChild.id);
                  }}
                  onKeyDown={(event) => onItemKeyDown(event, nodeChild.id)}
                >
                  {nodeChild.type === 'folder' ? (
                    <button
                      type="button"
                      className="direactree-item-button"
                      tabIndex={-1}
                      aria-hidden="true"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleExpanded(nodeChild.id);
                      }}
                    >
                      {isExpanded ? '▼' : '►'}
                    </button>
                  ) : (
                    <span className="direactree-item-button" aria-hidden="true" />
                  )}
                  <span className="direactree-item-name" title={nodeChild.name}>{nodeChild.name}</span>
                </div>
              )}
              {selectedAction?.action === 'delete' && selectedAction.nodeId === nodeChild.id && (
                <DeleteConfirm
                  nodeId={nodeChild.id}
                  name={nodeChild.name}
                  nodeType={nodeChild.type}
                  pending={deletePending}
                  disabled={actionsLocked}
                  error={deleteError ?? null}
                  messages={messages}
                  onConfirm={() => onConfirmDelete(nodeChild.id)}
                  onCancel={onCancel}
                />
              )}
              </div>
              {nodeChild.type === 'folder' && isExpanded && !!nodeChild.children?.length && (
                <div className="direactree-item-children expanded">
                  <DireactreeNode
                    node={nodeChild.children}
                    depth={depth + 1}
                    indent={indent}
                    selectedNodeId={selectedNodeId}
                    setSelectedNodeId={setSelectedNodeId}
                    selectedAction={selectedAction}
                    actionNode={actionNode}
                    onSave={onSave}
                    onCancel={onCancel}
                    onConfirmDelete={onConfirmDelete}
                    deletePending={deletePending}
                    actionsLocked={actionsLocked}
                    deleteError={deleteError}
                    expandedNodes={expandedNodes}
                    toggleExpanded={toggleExpanded}
                    onItemKeyDown={onItemKeyDown}
                    tabTargetId={tabTargetId}
                    allowDragAndDrop={allowDragAndDrop}
                    dragOverNodeId={dragOverNodeId}
                    pendingSave={pendingSave}
                    saveError={saveError}
                    messages={messages}
                    onDragStartNode={onDragStartNode}
                    onDragOverNode={onDragOverNode}
                    onDragLeaveNode={onDragLeaveNode}
                    onDropNode={onDropNode}
                  />
                </div>
              )}
              {isCreating && selectedAction?.nodeId === nodeChild.id && (
                <SetNode
                  selectedNode={actionNode}
                  actionType="create"
                  onCancel={onCancel}
                  onSave={onSave}
                  indent={indent}
                  createType={createType}
                  pending={pendingSave}
                  error={saveError}
                  messages={messages}
                />
              )}
            </li>
          );
        })}
      </ul>
      {isCreating && selectedAction?.nodeId == null && depth === 0 && (
        <SetNode
          selectedNode={null}
          actionType="create"
          onCancel={onCancel}
          onSave={onSave}
          indent={0}
          createType={createType}
          pending={pendingSave}
          error={saveError}
          messages={messages}
        />
      )}
    </>
  );
};

interface ToolboxProps {
  selectedNode: NodePath | null;
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  pending?: boolean;
  canSave?: boolean;
  canDelete?: boolean;
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
  pending = false,
  canSave = false,
  canDelete = false,
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
        disabled={pending || !canSave || selectedNode?.type === 'file'}
      >
        {toolboxIcons?.createFolder || <span className="direactree-toolbox-icon" aria-hidden="true">📂</span>}
      </button>
      <button
        type="button"
        className="direactree-toolbox-button"
        onClick={() => onCreateFile(selectedNode)}
        aria-label={messages.createFile}
        title={messages.createFile}
        disabled={pending || !canSave || selectedNode?.type === 'file'}
      >
        {toolboxIcons?.createFile || <span className="direactree-toolbox-icon" aria-hidden="true">📄</span>}
      </button>
      <button
        type="button"
        className="direactree-toolbox-button"
        onClick={() => selectedNode && onRename(selectedNode)}
        disabled={pending || !canSave || !selectedNode}
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
    </div>
  );
};

const themeColorScheme = (theme: DireactreeTheme): React.CSSProperties['colorScheme'] => (
  theme === 'system' ? 'light dark' : theme
);

const Direactree = ({
  className = '',
  theme = 'system',
  style,
  structure,
  indent = 20,
  showToolbox = true,
  toolboxIcons,
  toolboxSticky = false,
  allowDragAndDrop = true,
  isAllExpanded = false,
  confirmDelete = false,
  messages: messagesProp,
  onCreateFolder,
  onCreateFile,
  onRename,
  onDelete,
  onSave,
  onSelectedNodeChange,
  onNodeMove,
  onActionError,
}: DireactreeProps): React.ReactElement => {
  const validatedIndent = React.useMemo(() => validateIndent(indent), [indent]);
  const [selectedNodeId, setSelectedNodeId] = React.useState<string | null>(null);
  const [selectedAction, setSelectedAction] = React.useState<SelectedAction | null>(null);
  const [expandedNodes, setExpandedNodes] = React.useState<Record<string, boolean>>(() => (
    isAllExpanded ? collectAllFolderIds(structure) : collectInitialExpanded(structure)
  ));
  const [dragOverNodeId, setDragOverNodeId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<DireactreeMutation | null>(null);
  const [actionError, setActionError] = React.useState<{ kind: DireactreeMutation; message: string } | null>(null);
  const direactreeRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusId = React.useRef<string | null>(null);
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
  const messages = React.useMemo(
    () => ({ ...defaultDireactreeMessages, ...messagesProp }),
    [messagesProp]
  );
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;
  structureRef.current = structure;
  onSelectedNodeChangeRef.current = onSelectedNodeChange;
  onSaveRef.current = onSave;
  onDeleteRef.current = onDelete;
  onNodeMoveRef.current = onNodeMove;
  onActionErrorRef.current = onActionError;

  const selectedNode = React.useMemo(
    () => (selectedNodeId ? findNodePath(structure, selectedNodeId) : null),
    [structure, selectedNodeId]
  );
  const selectedSignature = pathSignature(selectedNode);
  const selectedNodeRef = React.useRef(selectedNode);
  selectedNodeRef.current = selectedNode;

  const actionNode = React.useMemo(
    () => (selectedAction?.nodeId ? findNodePath(structure, selectedAction.nodeId) : null),
    [structure, selectedAction]
  );
  const expandedNodesForView = React.useMemo(
    () => (isAllExpanded ? collectAllFolderIds(structure) : expandedNodes),
    [isAllExpanded, structure, expandedNodes]
  );
  const visibleItems = React.useMemo(
    () => flattenVisible(structure, expandedNodesForView),
    [structure, expandedNodesForView]
  );
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
    if (selectedNodeId && !findNodeById(structure, selectedNodeId)) {
      setSelectedNodeId(null);
    }
  }, [structure, selectedNodeId]);

  React.useEffect(() => {
    if (!selectedNodeId || visibleItems.some(item => item.id === selectedNodeId)) {
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
  }, [selectedNodeId, visibleItems, structure, expandedNodesForView]);

  React.useEffect(() => {
    if (selectedAction?.nodeId && !findNodeById(structure, selectedAction.nodeId)) {
      setSelectedAction(null);
      setActionError(null);
    }
  }, [structure, selectedAction]);

  React.useEffect(() => {
    onSelectedNodeChangeRef.current?.(selectedNodeRef.current);
  }, [selectedSignature]);

  React.useEffect(() => {
    const id = pendingFocusId.current;
    if (!id || !direactreeRef.current) {
      return;
    }
    const target = direactreeRef.current.querySelector<HTMLElement>(`[data-node-id="${escapeNodeId(id)}"]`);
    target?.focus();
    pendingFocusId.current = null;
  }, [selectedNodeId, expandedNodesForView]);

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
          currentElement.classList.contains('direactree-confirm')
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
  }, [selectedAction]);

  const toggleExpanded = (id: string) => {
    if (isAllExpanded) {
      return;
    }
    setExpandedNodes(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const expandNode = (id: string) => {
    setExpandedNodes(prev => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  const selectVisibleItem = (item: VisibleItem) => {
    pendingFocusId.current = item.id;
    setSelectedNodeId(item.id);
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

  const handleItemKeyDown = (event: React.KeyboardEvent<HTMLDivElement>, id: string) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    const index = visibleItems.findIndex(item => item.id === id);
    const item = visibleItems[index];
    if (!item) {
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
          expandNode(item.id);
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
          setExpandedNodes(prev => ({ ...prev, [item.id]: false }));
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
      default:
        break;
    }
  };

  const handleCreateFolder = (node: NodePath | null) => {
    if (!onSaveRef.current) {
      return;
    }
    setActionError(null);
    setSelectedAction({ action: 'createFolder', nodeId: node?.id ?? null });
    if (node?.id) {
      expandNode(node.id);
    }
    onCreateFolder?.(node);
  };

  const handleCreateFile = (node: NodePath | null) => {
    if (!onSaveRef.current) {
      return;
    }
    setActionError(null);
    setSelectedAction({ action: 'createFile', nodeId: node?.id ?? null });
    if (node?.id) {
      expandNode(node.id);
    }
    onCreateFile?.(node);
  };

  const handleRename = (node: NodePath) => {
    if (!onSaveRef.current) {
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
    if (!onDeleteRef.current) {
      return;
    }
    if (confirmDelete) {
      setActionError(null);
      setSelectedAction({ action: 'delete', nodeId: node.id });
      return;
    }
    performDelete(node.id);
  };

  const handleSave = (props: SaveProps) => {
    const liveNode = props.selectedNode?.id
      ? findNodePath(structureRef.current, props.selectedNode.id)
      : null;
    beginMutation(
      'save',
      () => onSaveRef.current?.({ ...props, selectedNode: liveNode }),
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

  const handleDragStart = (event: React.DragEvent<HTMLLIElement>, id: string) => {
    if (!allowDragAndDrop || !onNodeMoveRef.current || pendingRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    const payload = JSON.stringify({ id });
    event.dataTransfer.setData('text/plain', payload);
    try {
      event.dataTransfer.setData(DRAG_PAYLOAD_MIME, payload);
    } catch {
      // text/plain already holds the id payload.
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLLIElement>, node: TreeNode) => {
    if (!allowDragAndDrop || !onNodeMoveRef.current || pendingRef.current || node.type !== 'folder') {
      event.stopPropagation();
      if (node.type !== 'folder') {
        event.dataTransfer.dropEffect = 'none';
        setDragOverNodeId(current => (current === null ? current : null));
      }
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

  const handleDrop = (event: React.DragEvent<HTMLLIElement>, targetNode: TreeNode) => {
    event.stopPropagation();
    setDragOverNodeId(null);
    if (!allowDragAndDrop || !onNodeMoveRef.current || targetNode.type !== 'folder' || pendingRef.current) {
      return;
    }

    event.preventDefault();

    const sourceId = readDraggedId(event.dataTransfer);
    if (!sourceId || !onNodeMoveRef.current) {
      return;
    }

    const sourceNode = findNodeById(structureRef.current, sourceId);
    const liveTarget = findNodeById(structureRef.current, targetNode.id);
    if (!sourceNode || !liveTarget || !isMoveable(sourceNode, liveTarget)) {
      return;
    }

    expandNode(liveTarget.id);
    beginMutation(
      'move',
      () => onNodeMoveRef.current?.(sourceNode, liveTarget),
      () => undefined
    );
  };

  const [overlayElement, setOverlayElement] = React.useState<HTMLDivElement | null>(null);

  return (
    <DireactreeOverlayContext.Provider value={overlayElement}>
    <div
      className={[
        'direactree',
        deleteConfirmationOpen ? 'direactree-confirm-open' : '',
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
          onCreateFolder={handleCreateFolder}
          onCreateFile={handleCreateFile}
          onRename={handleRename}
          onDelete={handleDelete}
          toolboxSticky={toolboxSticky}
          pending={pendingAction !== null}
          canSave={canSave}
          canDelete={canDelete}
          deleteButtonRef={deleteButtonRef}
          messages={messages}
        />
      )}
      <div className="direactree-viewport">
      <DireactreeNode
        node={structure}
        depth={0}
        indent={validatedIndent}
        selectedNodeId={selectedNodeId}
        setSelectedNodeId={setSelectedNodeId}
        selectedAction={selectedAction}
        actionNode={actionNode}
        onSave={handleSave}
        onCancel={handleCancel}
        onConfirmDelete={performDelete}
        deletePending={pendingAction === 'delete'}
        actionsLocked={pendingAction !== null}
        deleteError={deleteError}
        expandedNodes={expandedNodesForView}
        toggleExpanded={toggleExpanded}
        onItemKeyDown={handleItemKeyDown}
        tabTargetId={tabTargetId}
        allowDragAndDrop={canDrag}
        dragOverNodeId={dragOverNodeId}
        pendingSave={pendingAction !== null}
        saveError={saveError}
        messages={messages}
        onDragStartNode={handleDragStart}
        onDragOverNode={handleDragOver}
        onDragLeaveNode={handleDragLeave}
        onDropNode={handleDrop}
      />
      </div>
      <div className="direactree-overlay" ref={setOverlayElement} />
    </div>
    </DireactreeOverlayContext.Provider>
  );
};

export default Direactree;
