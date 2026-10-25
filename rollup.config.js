import fs from 'fs';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import typescript from 'rollup-plugin-typescript2';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';

/*
 * The stylesheet is not bundled into the JavaScript. It ships as two files:
 * direactree.css (plain rules) and direactree.layer.css (the same rules inside
 * @layer direactree, so any unlayered CSS in the app wins without !important).
 */
function writeStylesheets() {
  return {
    name: 'write-direactree-css',
    generateBundle() {
      const source = fs.readFileSync(path.resolve('src/components/Direactree/styles.css'), 'utf8');
      const dist = path.resolve('dist');
      fs.mkdirSync(dist, { recursive: true });
      fs.writeFileSync(path.join(dist, 'direactree.css'), source);
      const indented = source.replace(/^(?=.)/gm, '  ');
      fs.writeFileSync(path.join(dist, 'direactree.layer.css'), `@layer direactree {\n${indented}}\n`);
    },
  };
}

const plugins = (extra = []) => [
  peerDepsExternal(),
  resolve({
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  }),
  commonjs(),
  typescript({
    useTsconfigDeclarationDir: true,
    tsconfigOverride: {
      compilerOptions: { sourceMap: true },
      exclude: ['**/*.stories.tsx', '**/*.test.tsx'],
    },
  }),
  terser({
    ecma: 2018,
    // Keeps the 'use client' banner of the Next entry, which terser would drop as an unknown directive.
    compress: { directives: false },
  }),
  ...extra,
];

const output = (file, format, banner) => ({
  file,
  format,
  exports: 'named',
  sourcemap: true,
  // Maps point at the original files without copying them, which keeps the package small.
  sourcemapExcludeSources: true,
  inlineDynamicImports: true,
  banner,
});

export default [
  {
    input: 'src/index.ts',
    output: [
      output('dist/index.cjs', 'cjs'),
      output('dist/index.mjs', 'esm'),
    ],
    plugins: plugins([writeStylesheets()]),
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  },
  {
    input: 'src/next.ts',
    output: [
      output('dist/next.cjs', 'cjs', "'use client';"),
      output('dist/next.mjs', 'esm', "'use client';"),
    ],
    plugins: plugins(),
    external: ['react', 'react-dom', 'react/jsx-runtime'],
  },
];
