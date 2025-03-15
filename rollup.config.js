import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from 'rollup-plugin-typescript2';
import peerDepsExternal from 'rollup-plugin-peer-deps-external';
import postcss from 'rollup-plugin-postcss';
import pkg from './package.json';

// 'use client' direktifini koruyan özel plugin
const preserveUseClient = () => {
  return {
    name: 'preserve-use-client',
    renderChunk(code) {
      // Eğer 'use client' direktifi yoksa, kodu olduğu gibi döndür
      if (!code.includes("'use client'") && !code.includes('"use client"')) {
        return null;
      }
      return null;
    }
  };
};

export default [
  {
    input: 'src/index.ts',
    output: [
      {
        file: pkg.main,
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        name: 'direactree',
        inlineDynamicImports: true
      },
      {
        file: pkg.module,
        format: 'esm',
        exports: 'named',
        sourcemap: true,
        inlineDynamicImports: true
      },
    ],
    plugins: [
      preserveUseClient(),
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
  },
  {
    input: 'src/next.ts',
    output: [
      {
        file: 'dist/next.js',
        format: 'cjs',
        exports: 'named',
        sourcemap: true,
        name: 'direactree-next',
        inlineDynamicImports: true,
        banner: "'use client';"
      },
      {
        file: 'dist/next.esm.js',
        format: 'esm',
        exports: 'named',
        sourcemap: true,
        inlineDynamicImports: true,
        banner: "'use client';"
      },
    ],
    plugins: [
      preserveUseClient(),
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