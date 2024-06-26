import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import replace from '@rollup/plugin-replace';
import { resolvePkgPath } from '../rollup/utils';
import path from 'path';

// vite开发环境兼容rollup，生产环境完全rollup

// vite的作用是实现实时更新包

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), replace({ __DEV__: true, preventAssignment: true })],
  resolve: {
    alias: [
      {
        find: 'react',
        replacement: resolvePkgPath('react')
      },
      {
        find: 'react-dom',
        replacement: resolvePkgPath('react-dom')
      },
      {
        find: 'react-noop-renderer',
        replacement: resolvePkgPath('react-noop-renderer')
      },
      {
        find: 'hostConfig',
        replacement: path.resolve(
          resolvePkgPath('react-dom'),
          './src/hostConfig.ts'
        )
      }
    ]
  }
});
