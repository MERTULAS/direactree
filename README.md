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

Arrow keys move the selection. Right opens a folder or moves into it. Left closes a folder or moves to its parent. Home and End jump to the ends. Enter and Space select the focused row. In an editor, Enter saves and Escape cancels. In the delete confirmation, Escape and Cancel close the panel. While the request is pending, both buttons stay disabled.

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

The Storybook story `Components/Direactree/Theme matrix` shows light, dark, and system against normal, hover, focus, selected, dragover, and error.

### Pessimistic save

```jsx
const [structure, setStructure] = useState(initialStructure);

async function onSave(props) {
  await api.save(props);
  setStructure(await api.fetchTree());
}

<Direactree structure={structure} onSave={onSave} />
```

The row changes only after `setStructure`. If `onSave` rejects, the editor stays open and the typed name is kept.

### Optimistic save with rollback

```jsx
const [structure, setStructure] = useState(initialStructure);

async function onSave(props) {
  const previous = structure;
  setStructure(applySave(previous, props));
  try {
    await api.save(props);
  } catch (error) {
    setStructure(previous);
    throw error;
  }
}
```

`applySave` is parent code. Direactree does not roll the list back itself, because it never changed it. Re-throw the error so the editor stays open when the request fails.

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
