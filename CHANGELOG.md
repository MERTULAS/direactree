# Changelog

## 0.4.0

### Breaking

- **The stylesheet is no longer inserted by JavaScript.** Add `import 'direactree/direactree.css'` once (or `direactree/direactree.layer.css`). Without it the tree renders unstyled. This removes the duplicate styles that came from importing the file as well, and works under a strict Content-Security-Policy.
- **New default look.** `appearance="plain"` is the default: no border or shadow, a background that follows the theme, compact toolbox, 28px rows, and selection across the whole row. Pass `appearance="card"` for a look close to 0.3.
- `indent` is now the full space per level. In 0.3 each level added `indent + 8px`.
- `onNodeMove` receives a third argument, `info: { position, parentId, index }`. Handlers that take two arguments keep working.
- `toolboxActions` `onClick` and `disabled` receive the selected ids as a second argument.
- Enter on a folder now opens or closes it, and calls `onNodeActivate`.
- Styling moved to data attributes: `[data-selected]`, `[data-state="open"]`, `[data-drop-position]`, and others. The old classes (`direactree-item-selected`, `direactree-item-dragover`) are still set, but the built-in CSS no longer uses them.
- Colors use CSS `light-dark()` (Chrome 123, Safari 17.5, Firefox 120 and later). The `prefers-color-scheme` media block is gone.

### Added

- `appearance` (`plain`, `card`) and `density` (`comfortable`, `compact`).
- `classNames` adds classes to each part of the tree, for Tailwind and other utility CSS.
- The `style` prop accepts `--direactree-*` tokens without a TypeScript cast (`DireactreeStyle`).
- `direactree.layer.css`: the same rules inside `@layer direactree`, so any unlayered app CSS wins.
- Row tokens: `--direactree-row-height`, `--direactree-font-size`, `--direactree-radius`, `--direactree-indent`, `--direactree-toolbox-button-size`, `--direactree-surface`, `--direactree-divider`, `--direactree-selected-fg`.
- SVG toolbox and chevron icons that follow `currentColor`, replacing emoji and text arrows.
- Right-to-left support: indent, guide lines, chevrons, and drop markers use logical properties.
- `onNodeActivate(node, path)` on double click and Enter, for opening files.
- `allowReorder` drops a node before or after a row, with a drop line. `resolveDrop` is exported, and `moveNode` reorders inside a folder when given an index.
- `expandedIds`, `defaultExpandedIds`, and `onExpandedChange` for controlled open folders. `getExpandedIds()` on the ref handle.
- `selectionMode="multiple"` with Ctrl/Cmd+click, Shift+click, Shift+arrows, Ctrl/Cmd+A, `selectedIds`, `onSelectionChange`, and `getSelectedIds()`.
- Type-ahead: typing letters moves to the next matching row.

### Changed

- The bundle is minified and targets ES2018: 46 KB instead of 121 KB (15 KB gzipped). Source maps now map back to the TypeScript sources.
- The component is split into smaller modules (`NameEditor`, `DeleteConfirm`, `ContextMenu`, `Toolbox`, `useVirtualWindow`, `useLazyChildren`).
- A virtualized tree reads its row height from `--direactree-row-height` unless `rowHeight` is given.

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
