import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testIgnore: [
    '**/unit/**',
    // Frozen pre-React DOM suite; live Main and connector contracts are covered
    // by main-react.spec.ts, main-compat.spec.ts, and tests/unit/main.
    '**/step1.spec.ts',
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
