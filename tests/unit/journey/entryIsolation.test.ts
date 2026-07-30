/// <reference types="node" />

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it.each([
  {
    app: 'simulation',
    entry: '../../src/journey/simulation.tsx',
    title: 'ISF UIUX | Simulation',
    description: 'Main 계획과 연결될 신규 Simulation 앱의 준비 상태를 안내하는 화면',
  },
  {
    app: 'portfolio',
    entry: '../../src/journey/portfolio.tsx',
    title: 'ISF UIUX | Portfolio',
    description: '신규 Portfolio 앱의 준비 상태를 안내하는 화면',
  },
  {
    app: 'account-map',
    entry: '../../src/journey/accountMap.tsx',
    title: 'ISF UIUX | Account Map',
    description: 'Main과 분리해 설계할 신규 Account Map 앱의 준비 상태를 안내하는 화면',
  },
])('$app retains route metadata and loads only its new React entry', async ({ app, entry, title, description }) => {
  const html = await readFile(resolve(process.cwd(), 'apps', app, 'index.html'), 'utf8');

  expect(html).toContain('<div id="root"></div>');
  expect(html).toContain('<html lang="ko">');
  expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1" />');
  expect(html).toContain(`<title>${title}</title>`);
  expect(html).toContain(`<meta name="description" content="${description}" />`);
  expect(html).toContain('<link rel="manifest" href="../../manifest.webmanifest" />');
  expect(html).toContain('<link rel="icon" href="../../icons/icon-192.svg" type="image/svg+xml" />');
  expect(html).toContain(`src="${entry}"`);
  expect(html.match(/<script type="module"/g)).toHaveLength(1);
  expect(html).not.toMatch(/shared\/|modules\/|src\/entries\//);
  expect(html).not.toContain('<app-header');
  expect(html).not.toContain('<data-hub-modal');
});
