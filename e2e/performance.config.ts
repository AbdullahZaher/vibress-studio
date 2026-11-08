import { defineConfig } from '@playwright/test';
import base from './playwright.config';

export default defineConfig({
  ...base,
  testDir: './performance',
  outputDir: '../benchmark-results',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  projects: [
    { name: 'desktop', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-emulation-4x-cpu', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'desktop-firefox', use: { browserName: 'firefox', viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-webkit', use: { browserName: 'webkit', viewport: { width: 1440, height: 900 } } },
  ],
});
