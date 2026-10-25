const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');

// The component is a forwardRef object, so check for a React component instead of a function.
const checkExports = [
  "if (!m.default || typeof m.default.render !== 'function') throw new Error('default export is not a component');",
  "for (const name of ['useDireactree', 'validateName', 'moveNode', 'applySave', 'removeNode']) {",
  "  if (typeof m[name] !== 'function') throw new Error(name + ' export missing');",
  "}",
].join(' ');

function readFirstLine(file) {
  return fs.readFileSync(path.join(root, file), 'utf8').split(/\r?\n/, 1)[0];
}

describe('package entrypoints', () => {
  beforeAll(() => {
    execFileSync('npm', ['run', 'build'], {
      cwd: root,
      stdio: 'pipe',
      shell: true,
      env: process.env,
    });
  }, 120000);

  it('resolves require(\'direactree\') and import(\'direactree\')', () => {
    const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direactree-smoke-'));
    const link = path.join(smokeDir, 'node_modules', 'direactree');
    fs.mkdirSync(path.dirname(link), { recursive: true });
    fs.symlinkSync(root, link, 'junction');

    try {
      execFileSync(process.execPath, ['-e', `const m = require('direactree'); ${checkExports}`], {
        cwd: smokeDir,
        stdio: 'pipe',
      });
      execFileSync(process.execPath, ['--input-type=module', '-e', `const m = await import('direactree'); ${checkExports}`], {
        cwd: smokeDir,
        stdio: 'pipe',
      });
    } finally {
      fs.unlinkSync(link);
      fs.rmSync(smokeDir, { recursive: true, force: true });
    }
  });

  it('ships the extracted stylesheet and the MIT license', () => {
    const css = fs.readFileSync(path.join(root, 'dist', 'direactree.css'), 'utf8');
    expect(css).toContain('.direactree');
    expect(css).toContain('@keyframes direactree-fade-in');
    expect(css).not.toMatch(/@keyframes\s+fadeIn\b/);
    const layered = fs.readFileSync(path.join(root, 'dist', 'direactree.layer.css'), 'utf8');
    expect(layered.startsWith('@layer direactree {')).toBe(true);
    expect(layered).toContain('@keyframes direactree-fade-in');
    expect(layered.trim().endsWith('}')).toBe(true);
    const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2025 Mert ULAS');
  });

  it('keeps CSS out of the JavaScript bundles', () => {
    for (const file of ['index.mjs', 'index.cjs', 'next.mjs', 'next.cjs']) {
      const code = fs.readFileSync(path.join(root, 'dist', file), 'utf8');
      expect(code).not.toContain('styleInject');
      expect(code).not.toContain('--direactree-surface');
    }
  });

  it('keeps the use client directive on the Next entry files', () => {
    expect(readFirstLine('dist/next.mjs')).toMatch(/^["']use client["'];/);
    expect(readFirstLine('dist/next.cjs')).toMatch(/^["']use client["'];/);
  });

  it('resolves direactree/next with classic moduleResolution node', () => {
    const smokeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'direactree-types-'));
    const modules = path.join(smokeDir, 'node_modules');
    const link = path.join(modules, 'direactree');
    const reactLink = path.join(modules, 'react');
    const reactTypesLink = path.join(modules, '@types', 'react');
    fs.mkdirSync(path.dirname(reactTypesLink), { recursive: true });
    fs.symlinkSync(root, link, 'junction');
    fs.symlinkSync(path.join(root, 'node_modules', 'react'), reactLink, 'junction');
    fs.symlinkSync(path.join(root, 'node_modules', '@types', 'react'), reactTypesLink, 'junction');
    fs.writeFileSync(path.join(smokeDir, 'tsconfig.json'), JSON.stringify({
      compilerOptions: {
        module: 'esnext',
        moduleResolution: 'node',
        jsx: 'react',
        strict: true,
        skipLibCheck: true,
        noEmit: true,
        esModuleInterop: true,
      },
      files: ['check.tsx'],
    }));
    fs.writeFileSync(path.join(smokeDir, 'check.tsx'), [
      "import * as React from 'react';",
      "import Direactree, { useDireactree, type DireactreeHandle, type TreeNode } from 'direactree/next';",
      "type Git = { status: 'M' | 'A' };",
      "const initial: TreeNode<Git>[] = [{ id: 'a', name: 'a.ts', type: 'file', data: { status: 'M' } }];",
      'export function Tree() {',
      '  const tree = useDireactree(initial);',
      '  const ref = React.useRef<DireactreeHandle>(null);',
      '  return <Direactree ref={ref} structure={tree.structure} onSave={tree.save} onDelete={tree.remove} onNodeMove={tree.move}',
      '    renderBadge={(node) => node.data?.status} />;',
      '}',
      '',
    ].join('\n'));

    try {
      execFileSync(process.execPath, [
        path.join(root, 'node_modules', 'typescript', 'lib', 'tsc.js'),
        '-p',
        smokeDir,
        '--pretty',
        'false',
      ], {
        cwd: smokeDir,
        stdio: 'pipe',
      });
    } finally {
      fs.unlinkSync(link);
      fs.unlinkSync(reactLink);
      fs.unlinkSync(reactTypesLink);
      fs.rmSync(smokeDir, { recursive: true, force: true });
    }
  });
});
