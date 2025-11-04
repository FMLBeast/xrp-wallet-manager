import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list'], ['html', { outputFolder: 'playwright-report' }]],
  use: {
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    headless: process.env.PLAYWRIGHT_HEADFUL !== '1'
  },
  projects: [
    {
      name: 'electron-app',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
