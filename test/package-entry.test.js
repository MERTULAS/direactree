const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..');

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
      execFileSync(process.execPath, ['-e', "const m = require('direactree'); if (typeof m.default !== 'function') throw new Error('CJS default export missing');"], {
        cwd: smokeDir,
        stdio: 'pipe',
      });
      execFileSync(process.execPath, ['--input-type=module', '-e', "const m = await import('direactree'); if (typeof m.default !== 'function') throw new Error('ESM default export missing');"], {
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
    const license = fs.readFileSync(path.join(root, 'LICENSE'), 'utf8');
    expect(license).toContain('MIT License');
    expect(license).toContain('Copyright (c) 2025 Mert ULAS');
  });

  it('keeps the use client directive on the Next entry files', () => {
    expect(readFirstLine('dist/next.mjs')).toBe("'use client';");
    expect(readFirstLine('dist/next.cjs')).toBe("'use client';");
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
    fs.writeFileSync(path.join(smokeDir, 'check.tsx'), "import Direactree from 'direactree/next';\nexport const Tree = Direactree;\n");

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
