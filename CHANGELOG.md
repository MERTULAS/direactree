# Changelog

## 0.3.0

### Added

- **Name checks.** The create and rename editor rejects blank names, names made only of spaces, characters such as `/ \ : * ? " < > |`, `.` and `..`, names over 255 characters, and a name that already exists in the same folder (case-insensitive by default). The name sent to `onSave` is trimmed. Change the rules with `nameRules`, add your own check with `validateName`, or turn the checks off with `validateName={false}`. `validateName()` and `hasNameConflict()` are also exported.
- **Move conflicts.** A drop into a folder that already holds an item with the same name is refused, and the reason is announced to screen readers.
- **`useDireactree` hook.** Keeps the tree in state and returns `save`, `remove`, and `move`, which plug straight into `onSave`, `onDelete`, and `onNodeMove`. Also `insert`, `update`, `setChildren`, `loadChildren`, `find`, and `reset`, plus an optional `sort: 'foldersFirst'`.
- **Pure tree helpers.** `applySave`, `insertNode`, `renameNode`, `removeNode`, `moveNode`, `updateNode`, `setChildren`, `sortChildren`, `findNode`, `findNodePath`, `locateNode`, `getAncestorIds`. None of them mutate their input.
- **Per-node permissions.** `TreeNode.locked`, `TreeNode.permissions` (`rename`, `delete`, `move`, `drop`, `createChild`), and the `getNodePermissions` prop. The toolbox, keyboard shortcuts, context menu, and drag and drop all follow them.
- **Search.** `searchTerm` with `searchMode` `'filter'` (default) or `'highlight'`, a custom `filterNode`, and a built-in search field with `showSearch`. Folders that hold a match open on their own, and the match is wrapped in `<mark>`.
- **Imperative handle.** Pass a `ref` to get `revealNode(id, { select, focus, block })`, `expand`, `collapse`, `expandAll`, `collapseAll`, `select`, and `focus`. `revealNode` opens every ancestor and scrolls the row into view.
- **Controlled selection** with `selectedId`. Setting it to a node inside a closed folder opens the way to it.
- **Row customization.** `renderIcon`, `renderLabel`, `renderBadge`, `getRowClassName`, and `TreeNode.data` for your own fields, such as a Git status or an error count.
- **Context menu.** `contextMenu` shows the built-in actions on right-click, Shift+F10, or the menu key. Pass a function to add or replace items.
- **Toolbox actions** with `toolboxActions`.
- **Keyboard shortcuts.** F2 renames and Delete deletes the focused row.
- **Lazy loading.** A folder with `hasChildren: true` and no `children` calls `onLoadChildren` the first time it opens. A loading row and a retry button are built in.
- **Virtualization** with `virtualized` (`rowHeight`, `overscan`, `height`). Only the rows in view are rendered.

### Changed

- Rows are now rendered as one flat list (`<ul role="tree">` with one `<li>` per row) instead of nested `<ul role="group">` lists. Depth is still exposed through `aria-level`, `aria-posinset`, and `aria-setsize`, and indent lines are drawn per row with `.direactree-guide`. Custom CSS that targeted `.direactree-item-children` or nested `.direactree-list` needs updating.
- The default export is now a `React.forwardRef` component so it can take a `ref`.
- `DireactreeMutation` includes `'load'`, used by `onActionError` when `onLoadChildren` rejects.

## 0.2.0

- Controlled `structure`, Promise-aware callbacks, keyboard navigation, delete confirmation, themes, and `messages`.
