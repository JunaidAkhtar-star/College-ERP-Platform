import { defineConfig, devices } from '@playwright/test';
import fs from 'node:fs';

const baseURL = process.env.UAT_WEB_URL;
const storageState = process.env.UAT_STORAGE_STATE;
const roleMatrix = process.env.UAT_ROLE_MATRIX || process.env.UAT_ROLE_MATRIX_FILE;
if (!baseURL) throw new Error('UAT_WEB_URL is required for browser assurance');
if (!roleMatrix && (!storageState || !fs.existsSync(storageState))) {
  throw new Error('UAT_STORAGE_STATE or UAT_ROLE_MATRIX must provide authenticated staging state');
}

export default defineConfig({
  testDir: './e2e',
  outputDir: 'test-results',
  forbidOnly: true,
  retries: 1,
  reporter: [['html', { outputFolder: 'playwright-report', open: 'never' }], ['list']],
  use: {
    baseURL,
    storageState: storageState || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet-chromium', use: { ...devices['iPad (gen 7)'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
    {
      name: 'wide-chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } },
    },
  ],
  webServer: undefined,
});
