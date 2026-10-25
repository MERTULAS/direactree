import type React from 'react';

export type NodeType = 'file' | 'folder';

export interface SaveProps {
  /** The name the user typed. Trimmed when `nameRules.trim` is true (the default). */
  newName: string;
  selectedNode: NodePath | null;
  actionType: 'create' | 'edit';
  createType?: 'folder' | 'file';
}

export type NodePath = {
  name: string;
  id: string;
  type: NodeType;
  parent: NodePath | null;
}

/** What a user may do with a node. A missing key counts as `true`. */
export interface NodePermissions {
  rename: boolean;
  delete: boolean;
  /** The node can be dragged. */
  move: boolean;
  /** Other nodes can be dropped into this folder. */
  drop: boolean;
  /** New files and folders can be created inside this folder. */
  createChild: boolean;
}

export interface TreeNode<T = unknown> {
  /** Stable id. Must be unique across the whole tree. */
  id: string;
  name: string;
  type: NodeType;
  /**
   * Child nodes of a folder. Leave it `undefined` together with `hasChildren: true`
   * to load the children with `onLoadChildren` when the folder opens.
   */
  children?: TreeNode<T>[];
  /**
   * Initial open state for a folder. Read only when the tree first mounts.
   * Later open and closed state is kept by the component, or by `expandedIds`.
   * While `isAllExpanded` is true, every folder is shown open.
   */
  isExpanded?: boolean;
  /** The folder has children that are not loaded yet. Used with `onLoadChildren`. */
  hasChildren?: boolean;
  /** Turns every permission off for this node. `permissions` and `getNodePermissions` can turn single ones back on. */
  locked?: boolean;
  /** Per-node permissions. A missing key counts as `true`. */
  permissions?: Partial<NodePermissions>;
  /** Your own data, such as a Git status or an error count. Direactree passes it through untouched. */
  data?: T;
}

export interface ToolboxIcons {
  createFolder?: React.ReactNode;
  createFile?: React.ReactNode;
  rename?: React.ReactNode;
  delete?: React.ReactNode;
}

export interface ToolboxAction {
  id: string;
  /** Accessible name and tooltip. */
  label: string;
  icon: React.ReactNode;
  disabled?: boolean | ((selectedNode: NodePath | null, selectedIds: string[]) => boolean);
  onClick: (selectedNode: NodePath | null, selectedIds: string[]) => void;
}

export type DireactreeMutation = 'save' | 'delete' | 'move' | 'load';

export type DireactreeTheme = 'system' | 'light' | 'dark';

/** `plain` blends into the page. `card` adds the border, padding, and boxed toolbox. */
export type DireactreeAppearance = 'plain' | 'card';

/** Row height and font size. `comfortable` is 28px rows, `compact` 22px rows. */
export type DireactreeDensity = 'comfortable' | 'compact';

/** Parts of the tree that take an extra class through `classNames`. */
export type DireactreeSlot =
  | 'root'
  | 'toolbox'
  | 'toolboxButton'
  | 'search'
  | 'viewport'
  | 'list'
  | 'row'
  | 'item'
  | 'toggle'
  | 'icon'
  | 'label'
  | 'badge'
  | 'editor'
  | 'menu'
  | 'menuItem'
  | 'confirm';

/** CSS for the root, including any `--direactree-*` token, such as `{ '--direactree-bg': 'transparent' }`. */
export type DireactreeStyle = React.CSSProperties & { [token: `--direactree-${string}`]: string | number | undefined };

export type DropPosition = 'inside' | 'before' | 'after';

/** Where a dropped node goes. `index` counts the new parent's children without the moved node. */
export interface MoveInfo {
  position: DropPosition;
  /** The folder that will hold the node. `null` is the root. */
  parentId: string | null;
  index: number;
}

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
  nameEmpty: string;
  /** `{char}` is replaced with the first character that is not allowed. */
  nameInvalidChars: string;
  /** `{name}` is replaced with the typed name. */
  nameReserved: string;
  /** `{max}` is replaced with the limit. */
  nameTooLong: string;
  /** `{name}` is replaced with the typed name. */
  nameDuplicate: string;
  /** `{name}` is the moved node, `{target}` the folder. */
  moveConflict: string;
  search: string;
  searchPlaceholder: string;
  noResults: string;
  loading: string;
  loadFailed: string;
  retry: string;
  /** `{name}` is replaced with the node name. */
  contextMenu: string;
}

export interface NameRules {
  /** Trim spaces before checking and before `onSave`. Default `true`. */
  trim: boolean;
  /** Characters that may not appear in a name. A string is read as a list of characters. */
  invalidChars: RegExp | string;
  /** Names that may not be used, such as `.` and `..`. */
  reserved: string[];
  /** Treat `Readme.md` and `readme.md` as different names. Default `false`. */
  caseSensitive: boolean;
  /** Longest allowed name. `0` turns the check off. Default `255`. */
  maxLength: number;
}

export interface NameValidationContext<T = unknown> {
  actionType: 'create' | 'edit';
  type: NodeType;
  /** Folder that will hold the node. `null` is the root. */
  parent: NodePath | null;
  /** The node being renamed. `null` while creating. */
  node: NodePath | null;
  siblings: TreeNode<T>[];
}

export type ContextMenuItem<T = unknown> = {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onSelect: (node: TreeNode<T>, path: NodePath) => void;
};

export type ContextMenuEntry<T = unknown> = ContextMenuItem<T> | 'separator';

export interface RevealOptions {
  /** Select the node. Default `true`. */
  select?: boolean;
  /** Move keyboard focus to the row. Default `false`. */
  focus?: boolean;
  /** Where the row lands in the viewport. Default `'nearest'`. */
  block?: 'start' | 'center' | 'end' | 'nearest';
}

export interface DireactreeHandle {
  /** Opens every ancestor, scrolls the row into view, and selects it. Returns `false` when the id is not in the tree. */
  revealNode: (id: string, options?: RevealOptions) => boolean;
  expand: (id: string) => void;
  collapse: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  select: (id: string | null) => void;
  /** Focuses the selected row, or the first row. */
  focus: () => void;
  /** Ids of every selected node. In `single` mode this holds at most one id. */
  getSelectedIds: () => string[];
  getExpandedIds: () => string[];
}

export interface VirtualizedOptions {
  /** Height of one row in pixels. Default: the density row height (28 or 22). */
  rowHeight?: number;
  /** Extra rows rendered above and below the visible area. Default `8`. */
  overscan?: number;
  /** Height of the scrolling area. Default `360px` (CSS variable `--direactree-viewport-height`). */
  height?: number | string;
}

export interface RowRenderState {
  expanded: boolean;
  selected: boolean;
  depth: number;
}

export interface LabelRenderState extends RowRenderState {
  /** Current search term, trimmed. Empty when no search is active. */
  term: string;
  /** The name with the matching part wrapped in `<mark>`. */
  highlighted: React.ReactNode;
}

export interface DireactreeProps<T = unknown> {
  className?: string;
  /** Extra classes for parts of the tree. Works well with utility CSS. */
  classNames?: Partial<Record<DireactreeSlot, string>>;
  /** `system` follows the OS color scheme. `light` and `dark` stay fixed. */
  theme?: DireactreeTheme;
  /** `plain` (default) has no border or padding. `card` adds them. */
  appearance?: DireactreeAppearance;
  /** `comfortable` (default) or `compact` rows. */
  density?: DireactreeDensity;
  /** Merged onto the root after the theme `color-scheme` value. Takes `--direactree-*` tokens without a cast. */
  style?: DireactreeStyle;
  /** Controlled tree. The component never copies or mutates this list. */
  structure: TreeNode<T>[];
  /** Pixels added per level. 8 to 50. Default `20`. */
  indent?: number;
  showToolbox?: boolean;
  toolboxIcons?: ToolboxIcons;
  toolboxSticky?: boolean;
  /** Extra buttons placed after the built-in toolbox buttons. */
  toolboxActions?: ToolboxAction[];
  allowDragAndDrop?: boolean;
  /** Lets a drop land before or after a row, not only inside a folder. */
  allowReorder?: boolean;
  /**
   * While true, every current and newly added folder is shown open.
   * Changing this from true to false closes every folder.
   */
  isAllExpanded?: boolean;
  /** Controlled open folders. Use with `onExpandedChange`. */
  expandedIds?: string[];
  /** Open folders on the first render. `TreeNode.isExpanded` is used when this is missing. */
  defaultExpandedIds?: string[];
  onExpandedChange?: (expandedIds: string[]) => void;
  confirmDelete?: boolean;
  /** Partial copy overrides. Missing keys keep the English defaults. */
  messages?: Partial<DireactreeMessages>;

  /** Overrides for the built-in name checks. */
  nameRules?: Partial<NameRules>;
  /**
   * Extra name check that runs after the built-in rules. Return an error message to block saving.
   * `false` turns every name check off except the empty check.
   */
  validateName?: false | ((name: string, context: NameValidationContext<T>) => string | null | undefined);

  /** Permissions for a node, merged over `node.locked` and `node.permissions`. */
  getNodePermissions?: (node: TreeNode<T>, path: NodePath) => Partial<NodePermissions>;

  /** `multiple` adds Ctrl/Cmd+click, Shift+click, Shift+arrows, and Ctrl/Cmd+A. Default `single`. */
  selectionMode?: 'single' | 'multiple';
  /** Controlled selection. Leave it `undefined` to let the component keep selection. */
  selectedId?: string | null;
  /** Controlled selection for `multiple` mode. */
  selectedIds?: string[];
  /** Called with every selected id in `multiple` mode. */
  onSelectionChange?: (selectedIds: string[], nodes: NodePath[]) => void;
  /** Shows only matching nodes and their folders (`filter`), or every node with matches marked (`highlight`). */
  searchTerm?: string;
  searchMode?: 'filter' | 'highlight';
  /** Custom match. The default is a case-insensitive name match. */
  filterNode?: (node: TreeNode<T>, term: string) => boolean;
  /** Shows a built-in search field under the toolbox. */
  showSearch?: boolean;
  onSearchChange?: (term: string) => void;

  /** Content placed before the name, such as a file type icon. */
  renderIcon?: (node: TreeNode<T>, state: RowRenderState) => React.ReactNode;
  /** Replaces the name text. */
  renderLabel?: (node: TreeNode<T>, state: LabelRenderState) => React.ReactNode;
  /** Content placed after the name, such as an error badge or a Git status. */
  renderBadge?: (node: TreeNode<T>, state: RowRenderState) => React.ReactNode;
  getRowClassName?: (node: TreeNode<T>, state: RowRenderState) => string | undefined;
  /**
   * Right-click and Shift+F10 menu. `true` shows the built-in actions.
   * A function receives the built-in items and returns the list to show.
   */
  contextMenu?: boolean | ((node: TreeNode<T>, defaults: ContextMenuEntry<T>[], path: NodePath) => ContextMenuEntry<T>[]);

  /** Renders only the rows in view. The viewport needs a fixed height. */
  virtualized?: boolean | VirtualizedOptions;
  /**
   * Called the first time a folder with `hasChildren` and no `children` opens.
   * Put the loaded children into `structure`; `useDireactree().loadChildren` does that for you.
   */
  onLoadChildren?: (node: TreeNode<T>) => void | Promise<unknown>;

  /** A double click, or Enter on a row. Use it to open a file. */
  onNodeActivate?: (node: TreeNode<T>, path: NodePath) => void;
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
  /**
   * Move intent. `target` is the folder for an `inside` drop, or the row the node lands
   * next to for `before` and `after`. Return a Promise to keep the drop pending until it settles.
   * The tree is not reordered here.
   */
  onNodeMove?: (node: TreeNode<T>, target: TreeNode<T>, info: MoveInfo) => void | Promise<void>;
  /** Called when a returned Promise from save, delete, move, or load rejects. */
  onActionError?: (error: unknown, action: DireactreeMutation) => void;
}
