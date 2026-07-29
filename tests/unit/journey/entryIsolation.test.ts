import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

it.each([
  {
    app: 'simulation',
    entry: '../../src/journey/simulation.tsx',
    title: 'ISF UIUX | Simulation',
    description: '개인 자산 흐름 프로젝트의 Simulation 화면으로, 월 투자 여력을 바탕으로 배당 성장 복리 효과를 시뮬레이션하는 UI',
  },
  {
    app: 'portfolio',
    entry: '../../src/journey/portfolio.tsx',
    title: 'ISF UIUX | Portfolio',
    description: '개인 자산 흐름 Portfolio 준비 화면',
  },
  {
    app: 'account-map',
    entry: '../../src/journey/accountMap.tsx',
    title: 'ISF UIUX | Account Map',
    description: 'Main 계좌 흐름 데이터를 바탕으로 반복 계좌 관계를 검토하는 Account Map 화면',
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
