import { defineConfig } from '@playwright/test';

/**
 * Browser E2E harness for Vibress Studio.
 *
 * The harness page (playground/e2e.html) mounts the editor with a mock
 * upload adapter, block-format controls, and import/export UI, and exposes
 * `window.__studio` for assertions.
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  webServer: {
    command: 'pnpm --filter vibress-studio-playground dev --port 5173 --strictPort',
    url: 'http://localhost:5173/e2e.html',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
