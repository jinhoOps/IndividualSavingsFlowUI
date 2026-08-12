import { defineConfig, devices } from '@playwright/test';

function workspacePort(workspacePath: string): number {
  let hash = 0;
  for (const character of workspacePath) {
    hash = ((hash * 31) + character.charCodeAt(0)) >>> 0;
  }
  return 6300 + (hash % 500);
}

const pwaPort = Number(process.env.ISF_PWA_PORT ?? workspacePort(process.cwd()));
const pwaOrigin = `http://127.0.0.1:${pwaPort}`;

export default defineConfig({
  testDir: './tests',
  testMatch: 'motion-system.spec.ts',
  grep: /PWA offline revisit/,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `${pwaOrigin}/IndividualSavingsFlowUI/`,
    serviceWorkers: 'allow',
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 900 },
  },
  projects: [{
    name: 'pwa-chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
  webServer: {
    command: `node ./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${pwaPort} --strictPort`,
    url: `${pwaOrigin}/IndividualSavingsFlowUI/apps/main/`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
