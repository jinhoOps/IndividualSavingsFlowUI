import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: [
    '**/unit/**',
    // Migration-reference suites return only with each app's approved detailed spec/migration.
    '**/account-map.spec.ts',
    '**/step2.spec.ts',
  ],
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/IndividualSavingsFlowUI/',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1',
    url: 'http://localhost:5173/IndividualSavingsFlowUI/apps/main/index.html',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
