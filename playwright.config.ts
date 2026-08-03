import { defineConfig, devices } from '@playwright/test';

function workspacePort(workspacePath: string): number {
  let hash = 0;
  for (const character of workspacePath) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  }
  return 5300 + (hash % 500);
}

const e2ePort = Number(process.env.ISF_E2E_PORT ?? workspacePort(process.cwd()));
const e2eOrigin = `http://127.0.0.1:${e2ePort}`;

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
    baseURL: `${e2eOrigin}/IndividualSavingsFlowUI/`,
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
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${e2ePort}`,
    url: `${e2eOrigin}/IndividualSavingsFlowUI/apps/main/index.html`,
    reuseExistingServer: true,
    timeout: 120000,
  },
});
