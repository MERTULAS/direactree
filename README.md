![image](https://github.com/user-attachments/assets/4635c9c8-e759-4985-90fd-27c5c929585a)

# Direactree

React UI Component for directory structure.

![Alt Text](https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExMHd5YXAybmxrOWk4ejd3aXBtanVjcmExYTlqYjRyNzVmZzJ5OHF1MyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5DxL9HbwRUx5Xluk52/giphy.gif)

## Documentation Page
### https://docs.mertulas.dev/docs/direactree/

## Installation

```bash
npm install direactree
# or
yarn add direactree
```

## Usage

The JavaScript entry inserts the component stylesheet. Import `direactree/direactree.css` as well when the page should be styled before JavaScript runs, or when a Content-Security-Policy blocks styles inserted from script.

### For React Apps

```tsx
import Direactree, { type TreeNode } from 'direactree';
import 'direactree/direactree.css';

const structure: TreeNode[] = [
        {
          id: '0',
          name: 'Desktop',
          type: 'folder',
          children: [
            {
              id: '1',
              name: 'Projects',
              type: 'folder',
              children: [
                {
                  id: '1.1',
                  name: 'Web Applications',
                  type: 'folder',
                  children: [
                    {
                      id: '1.1.1',
                      name: 'React Projects',
                      type: 'folder',
                      children: [
                        {
                          id: 'sample.txt',
                          name: 'project-notes.txt',
                          type: 'file',
                        },
                        {
                          id: 'example.json',
                          name: 'config.json',
                          type: 'file',
                        },
                        {
                          id: 'sample.ts',
                          name: 'utils.ts',
                          type: 'file',
                        }
                      ],
                    },
                  ],
                },
              ],
            },
            {
              id: '2',
              name: 'Documents',
              type: 'folder',
              children: [
                {
                  id: '2.1',
                  name: 'Technical Documents',
                  type: 'folder',
                  children: [
                    {
                      id: '2.1.1',
                      name: 'API Documents',
                      type: 'folder',
                      children: [
                        {
                          id: '2.1.1.1',
                          name: 'REST-API.md',
                          type: 'file',
                        }
                      ],
                    },
                  ],
                },
              ],
            },
          ]
        }];

function App() {
  return (
    <div>
      <Direactree structure={structure} />
    </div>
  );
}
```

## Controlled data

`structure` is the only source of truth and is owned by the parent. Direactree does not call an API and does not change the list when a user creates, renames, deletes, or moves a node. It keeps UI state only: selection, the edit form, delete confirmation, pending and error state, and which folders are open.

Callbacks report intent. Return a Promise from `onSave`, `onDelete`, or `onNodeMove` when the component should wait for that request. A `void` return keeps the previous synchronous behavior. `onCreateFolder`, `onCreateFile`, and `onRename` only mean the editor opened. The create or rename request is sent from `onSave`.

`useDireactree` below does these updates for you.

Node `id` values must be unique across the whole tree. `TreeNode.isExpanded` is read only as the initial open state. While `isAllExpanded` is `true`, every current and newly added folder stays open. Setting it back to `false` closes every folder. `confirmDelete` opens a positioned confirmation popover under the selected row before `onDelete`. The popover does not move the tree layout. Cancel is focused when it opens.

`messages` replaces the built-in English copy. Omitted keys keep the defaults. `deleteTitle` may contain `{name}`.

```tsx
<Direactree
  structure={structure}
  messages={{
    delete: 'Sil',
    cancel: 'Vazgeç',
    deleteTitle: '{name} silinsin mi?',
  }}
/>
```

Arrow keys move the selection. Right opens a folder or moves into it. Left closes a folder or moves to its parent. Home and End jump to the ends. Enter and Space select the focused row. F2 renames and Delete deletes the focused row. In an editor, Enter saves and Escape cancels. In the delete confirmation, Escape and Cancel close the panel. While the request is pending, both buttons stay disabled.

## Theme

`theme` is `'system'` by default. `'light'` and `'dark'` stay fixed. `'system'` is the only mode that follows `prefers-color-scheme`. The root sets `data-direactree-theme` and `color-scheme` (`light`, `dark`, or `light dark`). A `style` prop is merged after that `color-scheme`, so it can override the scheme or set variables on this tree only.

Selected rows use a background and heavier font weight without changing the row's horizontal position. The delete confirmation button uses the danger tokens. Error text uses `--direactree-danger`. `prefers-reduced-motion: reduce` removes transitions and the confirmation animation. `forced-colors: active` falls back to system colors and keeps selection visible.

| Variable | Use |
| --- | --- |
| `--direactree-bg`, `--direactree-fg` | Root surface and text |
| `--direactree-border` | Root border |
| `--direactree-hover` | Row hover |
| `--direactree-selected` | Selected row background |
| `--direactree-focus` | Focus outline |
| `--direactree-input-border`, `--direactree-input-bg` | Name field |
| `--direactree-confirm-bg`, `--direactree-confirm-border`, `--direactree-confirm-shadow` | Delete confirmation popover |
| `--direactree-button-border`, `--direactree-button-bg`, `--direactree-button-hover` | Toolbox and secondary buttons |
| `--direactree-danger`, `--direactree-danger-bg`, `--direactree-danger-fg`, `--direactree-danger-border`, `--direactree-danger-hover` | Error text, and the delete confirmation button |
| `--direactree-dragover`, `--direactree-dragover-border` | Drop target |
| `--direactree-line`, `--direactree-line-hover` | Indent lines (`.direactree-guide`) |
| `--direactree-match` | Search match background |

The Storybook stories under `Components/Direactree/Features` show each 0.3.0 feature. The story `Components/Direactree/Theme matrix` shows light, dark, and system against normal, hover, focus, selected, dragover, and error.

## Ready-made tree updates: `useDireactree`

`useDireactree` keeps the tree in React state and returns updaters whose signatures match the callbacks. Wire them in directly and create, rename, delete, and move work with no extra code:

```tsx
import Direactree, { useDireactree } from 'direactree';

function Files() {
  const tree = useDireactree(initialStructure);

  return (
    <Direactree
      structure={tree.structure}
      onSave={tree.save}
      onDelete={tree.remove}
      onNodeMove={tree.move}
    />
  );
}
```

When a change has to reach your backend first, call the updater after the request succeeds. If the request throws, the tree stays as it was, the editor or delete confirmation stays open with the error, and `onActionError` receives it:

```tsx
const tree = useDireactree(initialStructure);

async function handleDelete(node) {
  await api.deleteFile(node.id);
  tree.remove(node);
}

async function handleSave(props) {
  const saved = await api.save(props);
  // Use the id your backend created.
  tree.save(props, { id: saved.id });
}

<Direactree
  structure={tree.structure}
  onSave={handleSave}
  onDelete={handleDelete}
  onNodeMove={tree.move}
/>
```

| Member | Use |
| --- | --- |
| `structure`, `setStructure` | The current tree and its React setter |
| `save(props, { id?, data? })` | Applies an `onSave` payload: renames, or creates a file or folder |
| `remove(node)` | Removes a node and its children |
| `move(node, target, index?)` | Moves a node into a folder, or to the root with `null` |
| `insert(parentId, node, index?)`, `update(id, patch)`, `setChildren(id, children)` | Lower-level updates |
| `loadChildren(node, loader)` | Runs `loader` and stores the result as the folder's children |
| `find(id)`, `reset(next?)` | Look up a node, or go back to the first tree |

Options: `createId(props)` makes ids for new nodes (default `crypto.randomUUID()`), and `sort: 'foldersFirst'` or a compare function keeps each folder sorted.

The same updates are exported as pure functions for Redux, Zustand, or your own state: `applySave`, `insertNode`, `renameNode`, `removeNode`, `moveNode`, `updateNode`, `setChildren`, `sortChildren`, `findNode`, `findNodePath`, `locateNode`, and `getAncestorIds`. They never mutate the input, and they return the input unchanged when nothing changed.

### Optimistic save with rollback

```tsx
const tree = useDireactree(initialStructure);

async function onSave(props) {
  const previous = tree.structure;
  tree.save(props);
  try {
    await api.save(props);
  } catch (error) {
    tree.setStructure(previous);
    throw error;
  }
}
```

Re-throw the error so the editor stays open when the request fails.

## Name checks

The create and rename editor checks the name as you type and keeps Save disabled while it is invalid. By default it rejects:

- an empty name, or one made only of spaces
- `/ \ : * ? " < > |` and control characters
- `.` and `..`
- names longer than 255 characters
- a name that already exists in the same folder, ignoring case

The name passed to `onSave` is trimmed. A drop is refused when the target folder already holds an item with the same name.

```tsx
<Direactree
  structure={structure}
  onSave={onSave}
  nameRules={{ caseSensitive: true, maxLength: 64, invalidChars: /[\\/#]/ }}
  validateName={(name, { type }) => (type === 'file' && !name.includes('.') ? 'Add a file extension.' : null)}
/>
```

`validateName` runs after the built-in rules. `validateName={false}` keeps only the empty check. The same check is exported as `validateName(name, { siblings, ignoreId, rules })`, along with `hasNameConflict` and `defaultNameRules`.

## Permissions

Lock a node, turn off single actions, or decide per node with a function. A missing key counts as allowed.

```tsx
const structure = [
  {
    id: 'root',
    name: 'project',
    type: 'folder',
    permissions: { delete: false, rename: false, move: false },
    children: [
      { id: 'nm', name: 'node_modules', type: 'folder', locked: true, children: [] },
      { id: 'lock', name: 'package-lock.json', type: 'file', permissions: { move: false } },
    ],
  },
];

<Direactree
  structure={structure}
  getNodePermissions={(node, path) => (path.parent === null ? { delete: false } : {})}
/>
```

| Key | Allows |
| --- | --- |
| `rename` | Rename from the toolbox, F2, or the menu |
| `delete` | Delete from the toolbox, the Delete key, or the menu |
| `move` | Dragging the node |
| `drop` | Dropping other nodes into this folder |
| `createChild` | Creating files and folders inside this folder |

`locked: true` turns everything off; `permissions` and then `getNodePermissions` are merged on top. Locked rows get `data-locked="true"` for styling.

## Search and reveal

```tsx
const ref = useRef<DireactreeHandle>(null);

<Direactree ref={ref} structure={structure} showSearch />

ref.current?.revealNode('button-id', { focus: true, block: 'center' });
```

- `showSearch` adds a search field under the toolbox. Enter or Down moves to the first match, Escape clears it.
- `searchTerm` controls the term from outside, with `onSearchChange`. `searchMode="filter"` (default) shows only matches and the folders that hold them; `"highlight"` keeps every row and marks matches. Folders that hold a match open on their own and close again when the search ends.
- `filterNode(node, term)` replaces the default case-insensitive name match. Wrap it in `useCallback` on large trees.
- `revealNode(id, { select, focus, block })` opens every ancestor, scrolls the row into view, and selects it. The handle also has `expand`, `collapse`, `expandAll`, `collapseAll`, `select`, and `focus`.
- `selectedId` makes selection controlled. When it points into a closed folder, the folders open.

Search covers the nodes that are in `structure`. Children that are not loaded yet are not searched.

## Rows, badges, and menus

Put your own fields in `TreeNode.data` and render them:

```tsx
type FileData = { git?: 'M' | 'A'; errors?: number };

<Direactree<FileData>
  structure={structure}
  renderIcon={(node) => (node.type === 'folder' ? <FolderIcon /> : <FileIcon name={node.name} />)}
  renderBadge={(node) => (
    <>
      {node.data?.errors ? <span className="error-badge">{node.data.errors}</span> : null}
      {node.data?.git ? <span className={`git-${node.data.git}`}>{node.data.git}</span> : null}
    </>
  )}
  getRowClassName={(node) => (node.data?.git ? `row-git-${node.data.git}` : undefined)}
  contextMenu={(node, defaults) => [
    ...defaults,
    'separator',
    { id: 'copy', label: 'Copy path', onSelect: (target, path) => copy(path) },
  ]}
  toolboxActions={[{ id: 'refresh', label: 'Refresh', icon: <RefreshIcon />, onClick: reload }]}
/>
```

`renderLabel(node, { highlighted, term, selected, expanded, depth })` replaces the name; `highlighted` already holds the search mark. `contextMenu={true}` shows the built-in Create, Rename, and Delete items, and they follow permissions. The menu opens on right-click, Shift+F10, or the menu key, and takes Up, Down, Home, End, and Escape. Without `contextMenu`, the browser menu is left alone.

## Large trees

### Lazy loading

Give a folder `hasChildren: true` and leave `children` undefined. The first time it opens, `onLoadChildren` runs and a loading row is shown. If the Promise rejects, the row shows the error and a Retry button.

```tsx
const tree = useDireactree([{ id: 'remote', name: 'remote', type: 'folder', hasChildren: true }]);

<Direactree
  structure={tree.structure}
  onLoadChildren={(node) => tree.loadChildren(node, (folder) => api.listFolder(folder.id))}
/>
```

Without the hook, put the loaded children into `structure` yourself and return the Promise.

### Virtualization

```tsx
<Direactree structure={structure} virtualized={{ height: 480, rowHeight: 32, overscan: 8 }} />
```

Only the rows in view are rendered. The scrolling area needs a fixed height: pass `height`, or set `--direactree-viewport-height` in CSS (default `360px`). Keyboard navigation and `revealNode` scroll rows into view. Search, lazy loading, and the other features keep working.

## For Next.js 13+ Applications

### In Next.js 13 and later versions, all components are considered Server Components by default. Since Direactree is a Client Component, you have two different usage methods:

#### 1. Using Special Next.js Import (Recommended)

```jsx
// This import automatically includes the 'use client' directive
import Direactree from 'direactree/next';

function MyComponent() {
  return (
    <div>
      <Direactree structure={structure} />
    </div>
  );
}

export default MyComponent;
```

#### 2. Using Standard Import with 'use client' Directive

```jsx
'use client';

import Direactree from 'direactree';

function MyComponent() {
  return (
    <div>
      <Direactree structure={structure} />
    </div>
  );
}

export default MyComponent;
```

## Development

### Installing Dependencies

```bash
npm install
# or
yarn
```

### Development with Storybook

```bash
npm run storybook
# or
yarn storybook
```

### Building

```bash
npm run build
# or
yarn build
```

`npm test` runs the suite on the installed React 18 and again on React 17.

Publish with `npm publish` from this repository so the pack is built from the current tree. Do not publish a previously saved package archive.

## License

MIT 
