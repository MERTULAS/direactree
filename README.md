# Direactree

React UI Component for directory structure.

## Documentation Page
### https://direactree-documentation.vercel.app/

## Installation

```bash
npm install direactree
# or
yarn add direactree
```

## Usage

### For React Apps

```jsx
import Direactree from 'direactree';

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

### For Next.js 13+ Applications

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

## License

MIT 
