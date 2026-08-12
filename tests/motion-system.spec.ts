import { expect, test, type Locator, type Page } from '@playwright/test';

const MAIN = {
  schemaVersion: 2 as const,
  updatedAt: Date.UTC(2026, 7, 12, 4),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const SIMULATION = {
  schemaVersion: 2 as const,
  source: {
    monthlySavingsWon: MAIN.monthlySavingWon,
    monthlyInvestmentWon: MAIN.monthlyInvestmentWon,
    mainUpdatedAt: MAIN.updatedAt,
  },
  initialInvestmentWon: 2_000_000,
  years: 20,
  expectedAnnualReturnPercent: 9,
  baseRatePercent: 2.5,
  inflationOffsetPercentPoints: -0.5,
  amountMode: 'nominal' as const,
  updatedAt: Date.UTC(2026, 7, 12, 4, 1),
};

const PORTFOLIO_PLAN = {
  schemaVersion: 2 as const,
  scope: { type: 'aggregate' as const },
  items: [
    {
      id: 'gold',
      name: '금',
      shareUnits: 150_000,
      order: 0,
      classification: 'stable' as const,
      classificationOrigin: 'automatic' as const,
    },
    {
      id: 'global-index',
      name: '글로벌 인덱스',
      shareUnits: 500_000,
      order: 1,
      classification: 'growth' as const,
      classificationOrigin: 'automatic' as const,
    },
    {
      id: 'bond',
      name: '채권',
      shareUnits: 250_000,
      order: 2,
      classification: 'stable' as const,
      classificationOrigin: 'automatic' as const,
    },
  ],
  cashShareUnits: 100_000,
  cashMode: 'automatic' as const,
  syncedInvestmentWon: MAIN.monthlyInvestmentWon,
  appliedAt: Date.UTC(2026, 7, 12, 4, 2),
  updatedAt: Date.UTC(2026, 7, 12, 4, 2),
};

const WORKSPACE = {
  schemaVersion: 1 as const,
  revision: 3,
  updatedAt: Date.UTC(2026, 7, 12, 4, 2),
  main: { applied: MAIN, setupProgress: null },
  simulation: { draft: SIMULATION },
  portfolio: { plans: [PORTFOLIO_PLAN], draft: null },
  locations: [],
  accountMap: { applied: null, draft: null, instruments: [], flows: [] },
};

const VIEWPORTS = [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 900, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
] as const;

for (const viewport of VIEWPORTS) {
  test(`${viewport.label} captures final cross-app motion states without losing semantics or focus`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'pwa-chromium', 'The preview project runs only the offline revisit gate.');
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });

    await captureMainReview(page, testInfo.outputPath.bind(testInfo), viewport.width, MAIN, 'normal');
    await captureMainReview(page, testInfo.outputPath.bind(testInfo), viewport.width, {
      ...MAIN,
      monthlyInvestmentWon: 1_260_000,
    }, 'deficit-unclipped');
    await captureMainReview(page, testInfo.outputPath.bind(testInfo), viewport.width, {
      ...MAIN,
      monthlyNetIncomeWon: 1_000_000,
      monthlyHousingWon: 1_000_000,
      monthlyLivingWon: 0,
      monthlySavingWon: 1_000_000,
      monthlyInvestmentWon: 1_000_000,
    }, 'deficit-clipped');

    await openWithWorkspace(page, 'apps/main/', WORKSPACE);
    const mainEditTrigger = page.getByRole('button', { name: '월 소비 편집' });
    await mainEditTrigger.click();
    const livingInput = page.getByLabel('월평균 생활비');
    await livingInput.focus();
    await expect(livingInput).toBeFocused();
    await livingInput.fill('1100000');
    await page.getByRole('button', { name: '적용' }).click();
    await expect.poll(() => page.evaluate(() => (
      JSON.parse(localStorage.getItem('isf-workspace-v1')!).main.applied.monthlyLivingWon
    ))).toBe(1_100_000);
    await page.getByRole('button', { name: '편집기 닫기' }).click();
    await expect(mainEditTrigger).toBeFocused();
    await expect(mainEditTrigger).toContainText('190만 원');
    await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('80만 원');
    await expect(page.getByRole('status', { name: '저장됨' })).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `main-${viewport.width}-edit-applied.png`);

    await openWithWorkspace(page, 'apps/simulation/', WORKSPACE);
    const graph = page.locator('.growth-chart');
    await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
    const initialSemanticPath = await graph.locator('.growth-chart__semantic-path').nth(1).getAttribute('d');
    const years = page.getByRole('spinbutton', { name: '기간 숫자' });
    await years.focus();
    await years.fill('25');
    await expect(years).toBeFocused();
    await expect(page.getByRole('heading', { name: /이대로 25년 유지하면/ })).toBeVisible();
    await expect(graph.locator('.sr-only')).toContainText('명목 기준 25년');
    expect(await graph.locator('.growth-chart__semantic-path').nth(1).getAttribute('d'))
      .not.toBe(initialSemanticPath);
    await expectFinalSimulationPaths(graph);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `simulation-${viewport.width}-projection-changed.png`);

    await openWithWorkspace(page, 'apps/portfolio/', WORKSPACE, true);
    const allocationRows = page.locator('.portfolio-summary').getByRole('listitem');
    await expect(allocationRows).toHaveCount(4);
    await expect(allocationRows.nth(0)).toContainText('글로벌 인덱스');
    await expect(allocationRows.nth(0).getByLabel('50%')).toBeVisible();
    await expect(allocationRows.nth(1).getByLabel('25%')).toBeVisible();
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `portfolio-${viewport.width}-allocation.png`);

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    const inputOrder = page.getByRole('radio', { name: '입력순' });
    await inputOrder.focus();
    await inputOrder.check();
    await expect(inputOrder).toBeFocused();
    await expect.poll(() => allocationRows.evaluateAll((rows) => (
      rows.map((row) => row.querySelector('h2')?.textContent?.trim())
    ))).toEqual(['금', '글로벌 인덱스', '채권', '현금']);
    await expectFinalPortfolioRows(allocationRows);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `portfolio-${viewport.width}-sorted.png`);

    await openWithWorkspace(page, 'apps/account-map/', WORKSPACE);
    const readiness = page.locator('[data-readiness-motion]');
    await expect(page.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
    await page.getByRole('link', { name: 'Main으로 이동' }).focus();
    await expect(page.getByRole('link', { name: 'Main으로 이동' })).toBeFocused();
    await expectFinalTransform(readiness);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `account-map-${viewport.width}-readiness.png`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await captureReducedMotionFinals(page, viewport.width);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `cross-app-${viewport.width}-reduced-motion.png`);
  });
}

test('PWA offline revisit keeps all app routes and final motion state available', async ({ context, page }, testInfo) => {
  test.skip(testInfo.project.name !== 'pwa-chromium', 'The normal E2E project blocks service workers.');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openWithWorkspace(page, 'apps/main/', WORKSPACE);
  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  if (!await page.evaluate(() => navigator.serviceWorker.controller !== null)) {
    await page.reload();
  }
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

  const routes = [
    { path: 'apps/main/', heading: '이번 달 자금 흐름', motion: '.cashflow-donut' },
    { path: 'apps/simulation/', heading: /이대로 20년 유지하면/, motion: '.growth-chart' },
    { path: 'apps/portfolio/', heading: '안정 50%', motion: '.portfolio-summary' },
    { path: 'apps/account-map/', heading: 'Account Map 준비 중', motion: '[data-readiness-motion]' },
  ] as const;

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
    await expect(page.locator(route.motion)).toBeVisible();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  }

  const failedRequests: string[] = [];
  page.on('requestfailed', (request) => failedRequests.push(request.url()));
  await context.setOffline(true);
  try {
    for (const route of routes) {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
      await expect(page.locator(route.motion)).toBeVisible();
      await expectNoDocumentOverflow(page);
      if (route.path === 'apps/simulation/') {
        await expectFinalSimulationPaths(page.locator('.growth-chart'));
      }
      if (route.path === 'apps/portfolio/') {
        await expectFinalPortfolioRows(page.locator('.portfolio-summary').getByRole('listitem'));
      }
      if (route.path === 'apps/account-map/') {
        await expectFinalTransform(page.locator('[data-readiness-motion]'));
      }
    }
  } finally {
    await context.setOffline(false);
  }
  expect(failedRequests.filter((url) => /(?:anime|assets\/.*\.js)/.test(url))).toEqual([]);
});

async function captureMainReview(
  page: Page,
  outputPath: (name: string) => string,
  width: number,
  draft: typeof MAIN,
  phase: string,
): Promise<void> {
  await openWithWorkspace(page, 'apps/main/', {
    ...WORKSPACE,
    main: {
      applied: null,
      setupProgress: {
        kind: 'initial' as const,
        step: 'review' as const,
        draft,
        savedAt: Date.UTC(2026, 7, 12, 4, 3),
      },
    },
  });
  await expect(page.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
  const bar = page.getByLabel('월 수입 나누기');
  await expect(bar.locator('.allocation-bar__segments')).toHaveAttribute(
    'data-overflow-clipped',
    phase === 'deficit-clipped' ? 'true' : 'false',
  );
  const consumptionPercentage = (
    (draft.monthlyHousingWon + draft.monthlyLivingWon) / draft.monthlyNetIncomeWon * 100
  ).toFixed(1);
  await expect(bar.getByRole('button', {
    name: new RegExp(`소비.*${escapeRegExp(consumptionPercentage)}%`),
  })).toBeVisible();
  if (phase === 'normal') {
    await expect(bar.getByRole('button', { name: /남는 돈.*28\.1%/ })).toBeVisible();
  } else {
    await expect(bar.getByText(/수입보다 .* 초과/)).toBeVisible();
  }
  await expect.poll(() => bar.locator('.allocation-bar__visual-track').evaluate((element) => (
    new DOMMatrixReadOnly(getComputedStyle(element).transform).a
  ))).toBeCloseTo(1, 3);
  await expectNoDocumentOverflow(page);
  await screenshot(page, outputPath, `main-${width}-${phase}.png`);
}

async function captureReducedMotionFinals(page: Page, width: number): Promise<void> {
  await openWithWorkspace(page, 'apps/main/', {
    ...WORKSPACE,
    main: {
      applied: null,
      setupProgress: {
        kind: 'initial' as const,
        step: 'review' as const,
        draft: MAIN,
        savedAt: Date.UTC(2026, 7, 12, 4, 4),
      },
    },
  });
  const mainState = await page.locator('.setup-flow-surface').evaluate((root) => ({
    scale: new DOMMatrixReadOnly(getComputedStyle(
      root.querySelector<HTMLElement>('.allocation-bar__visual-track')!,
    ).transform).a,
    opacities: [...root.querySelectorAll<HTMLElement>('[data-assembly-content]')]
      .map((element) => Number(getComputedStyle(element).opacity)),
  }));
  expect(mainState.scale).toBeCloseTo(1, 3);
  expect(mainState.opacities).toEqual(mainState.opacities.map(() => 1));

  await openWithWorkspace(page, 'apps/simulation/', WORKSPACE);
  const years = page.getByRole('spinbutton', { name: '기간 숫자' });
  await years.fill('24');
  await expect(page.getByRole('heading', { name: /이대로 24년 유지하면/ })).toBeVisible();
  await expectFinalSimulationPaths(page.locator('.growth-chart'));

  await openWithWorkspace(page, 'apps/portfolio/', WORKSPACE, true);
  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('radio', { name: '입력순' }).check();
  const rows = page.locator('.portfolio-summary').getByRole('listitem');
  await expect.poll(() => rows.evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).transform)
  ))).toEqual(['none', 'none', 'none', 'none']);
  await expectFinalPortfolioRows(rows);

  await openWithWorkspace(page, 'apps/account-map/', WORKSPACE);
  await expectFinalTransform(page.locator('[data-readiness-motion]'));
  await expectNoDocumentOverflow(page);
  expect(width).toBeGreaterThan(0);
}

async function openWithWorkspace(
  page: Page,
  path: string,
  workspace: object,
  clearPortfolioPreferences = false,
): Promise<void> {
  await page.goto(path);
  await page.evaluate(({ value, clearPreference }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(value));
    if (clearPreference) localStorage.removeItem('isf-portfolio-view-preferences-v1');
  }, { value: workspace, clearPreference: clearPortfolioPreferences });
  await page.reload();
}

async function expectNoDocumentOverflow(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
}

async function expectFinalSimulationPaths(graph: Locator): Promise<void> {
  await expect.poll(() => graph.evaluate((element) => ({
    semantic: [...element.querySelectorAll('.growth-chart__semantic-path')]
      .map((path) => path.getAttribute('d')),
    visual: [...element.querySelectorAll('.growth-chart__motion-path')]
      .map((path) => path.getAttribute('d')),
    revealWidth: element.querySelector('.growth-chart__reveal-clip')?.getAttribute('width'),
  }))).toMatchObject({
    visual: await graph.locator('.growth-chart__semantic-path').evaluateAll((paths) => (
      paths.map((path) => path.getAttribute('d'))
    )),
    revealWidth: '620',
  });
}

async function expectFinalPortfolioRows(rows: Locator): Promise<void> {
  await expect.poll(() => rows.evaluateAll((elements) => elements.map((row) => {
    const style = getComputedStyle(row);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return {
      accessible: row.querySelector('strong')?.getAttribute('aria-label'),
      settled: matrix.isIdentity && Number(style.opacity) === 1,
      visual: row.querySelector('[data-allocation-ratio-visual]')?.textContent,
    };
  }))).toEqual([
    expect.objectContaining({ settled: true }),
    expect.objectContaining({ settled: true }),
    expect.objectContaining({ settled: true }),
    expect.objectContaining({ settled: true }),
  ]);
  const values = await rows.evaluateAll((elements) => elements.map((row) => ({
    accessible: row.querySelector('strong')?.getAttribute('aria-label'),
    visual: row.querySelector('[data-allocation-ratio-visual]')?.textContent,
  })));
  expect(values.every(({ accessible, visual }) => accessible === visual)).toBe(true);
}

async function expectFinalTransform(locator: Locator): Promise<void> {
  await expect.poll(() => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return { opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42 };
  })).toEqual({ opacity: 1, x: 0, y: 0 });
}

async function screenshot(
  page: Page,
  outputPath: (name: string) => string,
  name: string,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({ fullPage: true, path: outputPath(name) });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
