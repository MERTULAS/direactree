import fs from 'fs';
import path from 'path';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';

function extractStylesheet() {
  return {
    name: 'extract-direactree-css',
    generateBundle() {
      const source = fs.readFileSync(path.resolve('src/components/Direactree/styles.css'));
      const file = path.resolve('dist/direactree.css');
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, source);
    },
  };
}

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        name: 'direactree',
        inlineDynamicImports: true
      },
      {
        file: 'dist/index.mjs',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
        inlineDynamicImports: true
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }),
      commonjs(),
      postcss({
        modules: false,
        autoModules: false,
        inject: {
          insertAt: 'top'
        },
        minimize: true,
        extract: false,
        extensions: ['.css'],
        use: ['sass', 'stylus', 'less'],
      }),
      typescript({
        useTsconfigDeclarationDir: true,
        tsconfigOverride: {
          exclude: ['**/*.stories.tsx', '**/*.test.tsx'],
        },
      }),
      extractStylesheet(),
    ],
    external: ['react', 'react-dom']
  },
  {
    input: 'src/next.ts',
    output: [
      {
        file: 'dist/next.cjs',
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        name: 'direactree-next',
        inlineDynamicImports: true,
        banner: "'use client';"
      },
      {
        file: 'dist/next.mjs',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
        inlineDynamicImports: true,
        banner: "'use client';"
      },
    ],
    plugins: [
      peerDepsExternal(),
      resolve({
        extensions: ['.js', '.jsx', '.ts', '.tsx']
      }),
      commonjs(),
      postcss({
        modules: false,
        autoModules: false,
        inject: {
          insertAt: 'top'
        },
        minimize: true,
        extract: false,
        extensions: ['.css'],
        use: ['sass', 'stylus', 'less'],
      }),
      typescript({
        useTsconfigDeclarationDir: true,
        tsconfigOverride: {
          exclude: ['**/*.stories.tsx', '**/*.test.tsx'],
        },
      }),
    ],
    external: ['react', 'react-dom']
  }
]; 