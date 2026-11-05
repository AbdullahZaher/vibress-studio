import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    fileParallelism: false,
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', 'playwright-report/**', 'test-results/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: [
        'packages/studio-core/src/index.ts',
        'packages/studio-core/src/editable-node-schemas.ts',
        'packages/studio-serializer/src/index.ts',
        'packages/studio-utils/src/index.ts',
        'packages/studio-utils/src/sanitize.ts',
      ],
      thresholds: {
        perFile: true,
        'packages/studio-core/src/*.ts': { branches: 90 },
        'packages/studio-serializer/src/index.ts': { branches: 90 },
        'packages/studio-utils/src/sanitize.ts': { branches: 90 },
      },
    },
  },
  resolve: {
    alias: {
      '@vibress/studio-core': path.resolve(__dirname, './packages/studio-core/src/index.ts'),
      '@vibress/studio-utils': path.resolve(__dirname, './packages/studio-utils/src/index.ts'),
      '@vibress/studio-nodes': path.resolve(__dirname, './packages/studio-nodes/src/index.ts'),
      '@vibress/studio-transforms': path.resolve(__dirname, './packages/studio-transforms/src/index.ts'),
      '@vibress/studio-cards': path.resolve(__dirname, './packages/studio-cards/src/index.ts'),
      '@vibress/studio-card-definitions': path.resolve(__dirname, './packages/studio-card-definitions/src/index.ts'),
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
