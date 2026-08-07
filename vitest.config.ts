import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@vibress/studio-core': path.resolve(__dirname, './packages/studio-core/src/index.ts'),
      '@vibress/studio-utils': path.resolve(__dirname, './packages/studio-utils/src/index.ts'),
      '@vibress/studio-nodes': path.resolve(__dirname, './packages/studio-nodes/src/index.ts'),
      '@vibress/studio-transforms': path.resolve(__dirname, './packages/studio-transforms/src/index.ts'),
      '@vibress/studio-cards': path.resolve(__dirname, './packages/studio-cards/src/index.ts'),
      '@vibress/studio-serializer': path.resolve(__dirname, './packages/studio-serializer/src/index.ts'),
      '@vibress/studio-renderer': path.resolve(__dirname, './packages/studio-renderer/src/index.ts'),
      '@vibress/studio-html': path.resolve(__dirname, './packages/studio-html/src/index.ts'),
      '@vibress/studio-markdown': path.resolve(__dirname, './packages/studio-markdown/src/index.ts'),
      '@vibress/studio-plugin-sdk': path.resolve(__dirname, './packages/studio-plugin-sdk/src/index.ts'),
      '@vibress/studio-testing': path.resolve(__dirname, './packages/studio-testing/src/index.ts'),
      '@vibress/studio-react': path.resolve(__dirname, './packages/studio-react/src/index.ts'),
    },
  },
});
