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
      testIgnore: ['**/unit/**', '**/step2.spec.ts', '**/account-workspace.spec.ts'],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'cloud',
      testMatch: '**/account-workspace.spec.ts',
      use: {...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${e2ePort + 1}/IndividualSavingsFlowUI/`},
    },
  ],
  webServer: [{
    command: `node ./node_modules/vite/bin/vite.js --config tests/support/legacy.vite.config.ts --host 127.0.0.1 --port ${e2ePort}`,
    url: `${e2eOrigin}/IndividualSavingsFlowUI/apps/main/index.html`,
    reuseExistingServer: false,
    timeout: 120000,
  }, {
    command: `node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${e2ePort + 1}`,
    url: `http://127.0.0.1:${e2ePort + 1}/IndividualSavingsFlowUI/apps/main/`,
    env: {VITE_SUPABASE_URL: 'https://isf-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test_fixture'},
    reuseExistingServer: false,
    timeout: 120000,
  }],
});
