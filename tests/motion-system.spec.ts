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

const MAIN_DONUT_INITIAL = {
  activeAnimations: 0,
  semanticName: '소비 56.3%, 저축 9.4%, 투자 6.3%, 여윳돈 28.1%',
  centerSemantic: '15.6%',
  centerVisual: '15.6%',
  segments: [
    { id: 'consumption', dasharray: '56.25 43.75', dashoffset: '0' },
    { id: 'saving', dasharray: '9.375 90.625', dashoffset: '-56.25' },
    { id: 'investment', dasharray: '6.25 93.75', dashoffset: '-65.625' },
    { id: 'remaining', dasharray: '28.125 71.875', dashoffset: '-71.875' },
  ],
};

const MAIN_DONUT_AFTER_EDIT = {
  activeAnimations: 0,
  semanticName: '소비 59.4%, 저축 9.4%, 투자 6.3%, 여윳돈 25.0%',
  centerSemantic: '15.6%',
  centerVisual: '15.6%',
  segments: [
    { id: 'consumption', dasharray: '59.375 40.625', dashoffset: '0' },
    { id: 'saving', dasharray: '9.375 90.625', dashoffset: '-59.375' },
    { id: 'investment', dasharray: '6.25 93.75', dashoffset: '-68.75' },
    { id: 'remaining', dasharray: '25 75', dashoffset: '-75' },
  ],
};

const SIMULATION_24_SUMMARY = '명목 기준 24년, 현재 계획 3억 2,539만 원, 전부 저축 1억 9,993만 원, 차이 1억 2,546만 원';
const SIMULATION_25_SUMMARY = '명목 기준 25년, 현재 계획 3억 5,315만 원, 전부 저축 2억 1,099만 원, 차이 1억 4,216만 원';

const PORTFOLIO_INITIAL_ROWS = [
  { id: 'global-index', name: '글로벌 인덱스', accessible: '50%' },
  { id: 'bond', name: '채권', accessible: '25%' },
  { id: 'gold', name: '금', accessible: '15%' },
  { id: 'cash', name: '현금', accessible: '10%' },
] as const;

const PORTFOLIO_UPDATED_ROWS = [
  { id: 'global-index', name: '글로벌 인덱스', accessible: '50%' },
  { id: 'bond', name: '채권', accessible: '25%' },
  { id: 'gold', name: '금', accessible: '20%' },
  { id: 'cash', name: '현금', accessible: '5%' },
] as const;

const PORTFOLIO_INPUT_ROWS = [
  { id: 'gold', name: '금', accessible: '20%' },
  { id: 'global-index', name: '글로벌 인덱스', accessible: '50%' },
  { id: 'bond', name: '채권', accessible: '25%' },
  { id: 'cash', name: '현금', accessible: '5%' },
] as const;

for (const viewport of VIEWPORTS) {
  test(`${viewport.label} captures cross-app motion boundaries without losing semantics or focus`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'pwa-chromium', 'The preview project runs only the offline revisit gate.');
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await installAccountMapFirstFrameProbe(page);

    await captureMainReview(page, testInfo.outputPath.bind(testInfo), viewport.width, MAIN, 'normal');
    await captureMainReview(page, testInfo.outputPath.bind(testInfo), viewport.width, {
      ...MAIN,
      monthlyInvestmentWon: 1_260_000,
    }, 'deficit-slight');
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
    await expectFinalMainDonut(page.locator('.cashflow-donut'), MAIN_DONUT_INITIAL);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `main-${viewport.width}-edit-before.png`);
    await mainEditTrigger.click();
    const livingInput = page.getByLabel('월평균 생활비');
    await livingInput.focus();
    await expect(livingInput).toBeFocused();
    await livingInput.fill('1100000');
    await page.getByRole('button', { name: '적용' }).click();
    const mainTransitionStart = await readMainDonut(page.locator('.cashflow-donut'));
    expect(mainTransitionStart.semanticName).toBe(MAIN_DONUT_AFTER_EDIT.semanticName);
    expect(mainTransitionStart.centerSemantic).toBe(MAIN_DONUT_AFTER_EDIT.centerSemantic);
    expect(mainTransitionStart.segments).not.toEqual(MAIN_DONUT_AFTER_EDIT.segments);
    await expect.poll(() => page.evaluate(() => (
      JSON.parse(localStorage.getItem('isf-workspace-v1')!).main.applied.monthlyLivingWon
    ))).toBe(1_100_000);
    await expectFinalMainDonut(page.locator('.cashflow-donut'), MAIN_DONUT_AFTER_EDIT);
    await page.getByRole('button', { name: '편집기 닫기' }).click();
    await expect(mainEditTrigger).toBeFocused();
    await expect(mainEditTrigger).toContainText('190만 원');
    await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('80만 원');
    await expect(page.getByRole('status', { name: '저장됨' })).toHaveCount(0);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `main-${viewport.width}-edit-after.png`);

    await openWithWorkspace(page, 'apps/simulation/', WORKSPACE);
    const graph = page.locator('.growth-chart');
    await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
    await expectFinalSimulationPaths(graph);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `simulation-${viewport.width}-before.png`);
    const years = page.getByRole('spinbutton', { name: '기간 숫자' });
    await years.focus();
    await years.fill('25');
    const simulationTransitionStart = await readSimulationState(graph);
    expect(simulationTransitionStart.summary).toBe(SIMULATION_25_SUMMARY);
    expect(simulationTransitionStart.visual).not.toEqual(simulationTransitionStart.semantic);
    await expect(years).toBeFocused();
    await expect(page.getByRole('heading', { name: /이대로 25년 유지하면/ })).toBeVisible();
    await expectFinalSimulationPaths(graph);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `simulation-${viewport.width}-after.png`);

    await openWithWorkspace(page, 'apps/portfolio/', WORKSPACE, true);
    const allocationRows = page.locator('.portfolio-summary').getByRole('listitem');
    await expectFinalPortfolioRows(allocationRows, PORTFOLIO_INITIAL_ROWS);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `portfolio-${viewport.width}-allocation-before.png`);

    await page.getByRole('button', { name: '배분 수정' }).click();
    const goldAmount = page.getByLabel('금 금액', { exact: true });
    await goldAmount.fill('40000');
    await goldAmount.blur();
    await page.getByRole('button', { name: '적용' }).click();
    await installPortfolioBoundaryProbe(page, PORTFOLIO_UPDATED_ROWS);
    await page.getByRole('dialog', { name: '투자 배분을 적용할까요?' })
      .getByRole('button', { name: '배분 적용' }).click();
    const allocationTransitionStart = await readProbedPortfolioBoundary(page);
    expectPortfolioSemantics(allocationTransitionStart.rows, PORTFOLIO_UPDATED_ROWS);
    expect(allocationTransitionStart.rows.some((row) => row.visual !== row.accessible)).toBe(true);
    await expectFinalPortfolioRows(allocationRows, PORTFOLIO_UPDATED_ROWS);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `portfolio-${viewport.width}-allocation-after.png`);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `portfolio-${viewport.width}-sort-before.png`);

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    const inputOrder = page.getByRole('radio', { name: '입력순' });
    await inputOrder.focus();
    await installPortfolioBoundaryProbe(page, PORTFOLIO_INPUT_ROWS);
    await inputOrder.check();
    const sortTransitionStart = await readProbedPortfolioBoundary(page);
    expectPortfolioSemantics(sortTransitionStart.rows, PORTFOLIO_INPUT_ROWS);
    expect(sortTransitionStart.rows.some((row) => !row.transformIdentity)).toBe(true);
    await expect(inputOrder).toBeFocused();
    await expectFinalPortfolioRows(allocationRows, PORTFOLIO_INPUT_ROWS);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `portfolio-${viewport.width}-sort-after.png`);

    await openWithWorkspace(page, 'apps/account-map/', WORKSPACE);
    const setup = page.locator('.account-map-setup');
    const setupFirstFrame = await readProbedAccountMapFirstFrame(page);
    expect(setupFirstFrame).toEqual({
      activeAnimations: 0,
      heading: '월 자금의 위치를 알려주세요',
      opacity: 1,
      x: 0,
      y: 0,
    });
    await expect(page.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
    const firstConnect = page.getByRole('button', { name: '연결', exact: true }).first();
    await firstConnect.focus();
    await expect(firstConnect).toBeFocused();
    await expectFinalTransform(setup);
    await expectNoDocumentOverflow(page);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `account-map-${viewport.width}-setup.png`);

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await captureReducedMotionFinals(page, viewport.width);
    await screenshot(page, testInfo.outputPath.bind(testInfo), `account-map-${viewport.width}-reduced-motion.png`);
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
    { path: 'apps/account-map/', heading: '월 자금의 위치를 알려주세요', motion: '.account-map-setup' },
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
      if (route.path === 'apps/main/') {
        expect(await readMainDonut(page.locator('.cashflow-donut'))).toEqual(MAIN_DONUT_INITIAL);
      }
      if (route.path === 'apps/simulation/') {
        await expectFinalSimulationPaths(page.locator('.growth-chart'));
      }
      if (route.path === 'apps/portfolio/') {
        await expectFinalPortfolioRows(
          page.locator('.portfolio-summary').getByRole('listitem'),
          PORTFOLIO_INITIAL_ROWS,
        );
      }
      if (route.path === 'apps/account-map/') {
        await expectFinalTransform(page.locator('.account-map-setup'));
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
  const segments = bar.locator('.allocation-bar__segments');
  const geometry = await segments.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return {
      desiredEndPercent: Number(element.getAttribute('data-desired-end-percent')),
      visibleEndPercent: Number(element.getAttribute('data-visible-end-percent')),
      clipped: element.getAttribute('data-overflow-clipped') === 'true',
      barWidth: box.width,
      availableRight: Math.max(0, document.documentElement.clientWidth - 16 - box.right),
    };
  });
  const plannedOutflowWon = draft.monthlyHousingWon
    + draft.monthlyLivingWon
    + draft.monthlySavingWon
    + draft.monthlyInvestmentWon;
  const expectedDesiredEndPercent = Math.max(
    100,
    plannedOutflowWon / draft.monthlyNetIncomeWon * 100,
  );
  const expectedCapacityPercent = geometry.barWidth > 0
    ? geometry.availableRight / geometry.barWidth * 100
    : 0;
  const expectedVisibleEndPercent = Math.min(
    expectedDesiredEndPercent,
    100 + expectedCapacityPercent,
  );
  const expectedClipped = expectedVisibleEndPercent < expectedDesiredEndPercent;
  expect(geometry.desiredEndPercent).toBeCloseTo(expectedDesiredEndPercent, 3);
  expect(geometry.visibleEndPercent).toBeCloseTo(expectedVisibleEndPercent, 3);
  expect(geometry.clipped).toBe(expectedClipped);
  const overflowPercent = Math.max(0, expectedDesiredEndPercent - 100);
  if (expectedClipped) {
    await expect(bar.locator('.cashflow-bar__overflow-label'))
      .toHaveText(`+${overflowPercent.toFixed(1)}% 초과`);
  } else {
    await expect(bar.locator('.cashflow-bar__overflow-label')).toHaveCount(0);
  }
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
    activeAnimations: root.getAnimations({ subtree: true })
      .filter((animation) => (
        (animation.playState === 'running' || animation.playState === 'pending')
        && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1
      ))
      .length,
  }));
  expect(mainState.scale).toBeCloseTo(1, 3);
  expect(mainState.opacities).toEqual(mainState.opacities.map(() => 1));
  expect(mainState.activeAnimations).toBe(0);

  await openWithWorkspace(page, 'apps/simulation/', WORKSPACE);
  const years = page.getByRole('spinbutton', { name: '기간 숫자' });
  await years.fill('24');
  const reducedSimulationFirstRead = await readSimulationState(page.locator('.growth-chart'));
  expect(reducedSimulationFirstRead.summary).toBe(SIMULATION_24_SUMMARY);
  expect(reducedSimulationFirstRead.visual).toEqual(reducedSimulationFirstRead.semantic);
  expect(reducedSimulationFirstRead.revealWidth).toBe('620');
  expect(reducedSimulationFirstRead.activeAnimations).toBe(0);

  await openWithWorkspace(page, 'apps/portfolio/', WORKSPACE, true);
  await page.getByRole('button', { name: '관리 메뉴' }).click();
  const reducedPortfolioRows = [
    { id: 'gold', name: '금', accessible: '15%' },
    { id: 'global-index', name: '글로벌 인덱스', accessible: '50%' },
    { id: 'bond', name: '채권', accessible: '25%' },
    { id: 'cash', name: '현금', accessible: '10%' },
  ] as const;
  await installPortfolioBoundaryProbe(page, reducedPortfolioRows);
  await page.getByRole('radio', { name: '입력순' }).check();
  const reducedPortfolioFirstRead = await readProbedPortfolioBoundary(page);
  expectPortfolioSemantics(reducedPortfolioFirstRead.rows, reducedPortfolioRows);
  expect(reducedPortfolioFirstRead.rows.every((row) => (
    row.visual === row.accessible && row.transformIdentity && row.opacity === 1
  ))).toBe(true);
  expect(reducedPortfolioFirstRead.activeAnimations).toBe(0);

  await openWithWorkspace(page, 'apps/account-map/', WORKSPACE);
  const reducedSetupFirstRead = await readProbedAccountMapFirstFrame(page);
  expect(reducedSetupFirstRead).toEqual({
    activeAnimations: 0,
    heading: '월 자금의 위치를 알려주세요',
    opacity: 1,
    x: 0,
    y: 0,
  });
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

async function readMainDonut(donut: Locator) {
  return donut.evaluate((element) => ({
    activeAnimations: element.getAnimations({ subtree: true })
      .filter((animation) => (
        (animation.playState === 'running' || animation.playState === 'pending')
        && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1
      ))
      .length,
    semanticName: element.querySelector('svg')?.getAttribute('aria-label'),
    centerSemantic: element.querySelector('.cashflow-donut__center strong .sr-only')?.textContent,
    centerVisual: element.querySelector('.cashflow-donut__center strong > [aria-hidden="true"]')?.textContent,
    segments: ['consumption', 'saving', 'investment', 'remaining'].map((id) => {
      const circle = element.querySelector(`.cashflow-donut__segment--${id}`);
      return {
        id,
        dasharray: circle?.getAttribute('stroke-dasharray'),
        dashoffset: circle?.getAttribute('stroke-dashoffset'),
      };
    }),
  }));
}

async function expectFinalMainDonut(donut: Locator, expected: typeof MAIN_DONUT_INITIAL): Promise<void> {
  await expect.poll(() => readMainDonut(donut)).toEqual(expected);
}

async function readSimulationState(graph: Locator) {
  return graph.evaluate((element) => ({
    activeAnimations: element.getAnimations({ subtree: true })
      .filter((animation) => (
        (animation.playState === 'running' || animation.playState === 'pending')
        && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1
      ))
      .length,
    summary: element.querySelector('.sr-only')?.textContent?.trim(),
    semantic: [...element.querySelectorAll('.growth-chart__semantic-path')]
      .map((path) => path.getAttribute('d')),
    visual: [...element.querySelectorAll('.growth-chart__motion-path')]
      .map((path) => path.getAttribute('d')),
    revealWidth: element.querySelector('.growth-chart__reveal-clip')?.getAttribute('width'),
  }));
}

async function expectFinalSimulationPaths(graph: Locator): Promise<void> {
  await expect.poll(() => readSimulationState(graph)).toMatchObject({
    visual: await graph.locator('.growth-chart__semantic-path').evaluateAll((paths) => (
      paths.map((path) => path.getAttribute('d'))
    )),
    revealWidth: '620',
  });
}

type ExpectedPortfolioRows = ReadonlyArray<{
  id: string;
  name: string;
  accessible: string;
}>;

async function readPortfolioRows(rows: Locator) {
  const values = await rows.evaluateAll((elements) => elements.map((row) => {
    const style = getComputedStyle(row);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const fill = row.querySelector<HTMLElement>('.portfolio-allocation-row__fill');
    const fillMatrix = new DOMMatrixReadOnly(fill === null ? 'none' : getComputedStyle(fill).transform);
    return {
      id: row.getAttribute('data-allocation-id'),
      name: row.querySelector('h2')?.textContent?.trim(),
      accessible: row.querySelector('strong')?.getAttribute('aria-label'),
      visual: row.querySelector('[data-allocation-ratio-visual]')?.textContent,
      fillScale: fillMatrix.a,
      transformIdentity: matrix.isIdentity,
      opacity: Number(style.opacity),
    };
  }));
  const activeAnimations = await rows.first().locator('xpath=..').evaluate((element) => (
    element.getAnimations({ subtree: true })
      .filter((animation) => (
        (animation.playState === 'running' || animation.playState === 'pending')
        && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1
      ))
      .length
  ));
  return { activeAnimations, rows: values };
}

function expectPortfolioSemantics(
  actual: Awaited<ReturnType<typeof readPortfolioRows>>['rows'],
  expected: ExpectedPortfolioRows,
): void {
  expect(actual.map(({ id, name, accessible }) => ({ id, name, accessible }))).toEqual(expected);
  expect(actual.every(({ accessible }) => accessible !== null && accessible !== undefined)).toBe(true);
}

async function expectFinalPortfolioRows(
  rows: Locator,
  expected: ExpectedPortfolioRows,
): Promise<void> {
  await expect.poll(async () => {
    const state = await readPortfolioRows(rows);
    return state.rows.map(({ id, name, accessible, visual, transformIdentity, opacity }) => ({
      id,
      name,
      accessible,
      visual,
      transformIdentity,
      opacity,
    }));
  }).toEqual(expected.map((row) => ({
    ...row,
    visual: row.accessible,
    transformIdentity: true,
    opacity: 1,
  })));
}

async function installPortfolioBoundaryProbe(
  page: Page,
  expected: ExpectedPortfolioRows,
): Promise<void> {
  await page.evaluate((expectedRows) => {
    const stateWindow = window as typeof window & {
      __isfPortfolioBoundary?: {
        activeAnimations: number;
        rows: Array<{
          id: string | null;
          name: string | undefined;
          accessible: string | null | undefined;
          visual: string | null | undefined;
          fillScale: number;
          transformIdentity: boolean;
          opacity: number;
        }>;
      };
    };
    delete stateWindow.__isfPortfolioBoundary;
    const expectedSignature = JSON.stringify(expectedRows);
    const capture = (): boolean => {
      const summary = document.querySelector<HTMLElement>('.portfolio-summary');
      if (summary === null) return false;
      const elements = [...summary.querySelectorAll<HTMLElement>('[data-allocation-id]')];
      const semantics = elements.map((row) => ({
        id: row.getAttribute('data-allocation-id'),
        name: row.querySelector('h2')?.textContent?.trim(),
        accessible: row.querySelector('strong')?.getAttribute('aria-label'),
      }));
      if (JSON.stringify(semantics) !== expectedSignature) return false;
      stateWindow.__isfPortfolioBoundary = {
        activeAnimations: summary.getAnimations({ subtree: true })
          .filter((animation) => (
            (animation.playState === 'running' || animation.playState === 'pending')
            && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1
          ))
          .length,
        rows: elements.map((row) => {
          const style = getComputedStyle(row);
          const fill = row.querySelector<HTMLElement>('.portfolio-allocation-row__fill');
          const fillMatrix = new DOMMatrixReadOnly(
            fill === null ? 'none' : getComputedStyle(fill).transform,
          );
          return {
            id: row.getAttribute('data-allocation-id'),
            name: row.querySelector('h2')?.textContent?.trim(),
            accessible: row.querySelector('strong')?.getAttribute('aria-label'),
            visual: row.querySelector('[data-allocation-ratio-visual]')?.textContent,
            fillScale: fillMatrix.a,
            transformIdentity: new DOMMatrixReadOnly(style.transform).isIdentity,
            opacity: Number(style.opacity),
          };
        }),
      };
      return true;
    };
    if (capture()) return;
    const observer = new MutationObserver(() => {
      if (capture()) observer.disconnect();
    });
    observer.observe(document, {
      attributes: true,
      attributeFilter: ['aria-label', 'data-allocation-id', 'data-allocation-percentage'],
      childList: true,
      subtree: true,
    });
  }, expected);
}

async function readProbedPortfolioBoundary(page: Page) {
  await page.waitForFunction(() => '__isfPortfolioBoundary' in window);
  return page.evaluate(() => (window as typeof window & {
    __isfPortfolioBoundary: {
      activeAnimations: number;
      rows: Array<{
        id: string | null;
        name: string | undefined;
        accessible: string | null | undefined;
        visual: string | null | undefined;
        fillScale: number;
        transformIdentity: boolean;
        opacity: number;
      }>;
    };
  }).__isfPortfolioBoundary);
}

async function expectFinalTransform(locator: Locator): Promise<void> {
  await expect.poll(() => locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform);
    return { opacity: Number(style.opacity), x: matrix.m41, y: matrix.m42 };
  })).toEqual({ opacity: 1, x: 0, y: 0 });
}

async function installAccountMapFirstFrameProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const stateWindow = window as typeof window & {
      __isfAccountMapFirstFrame?: {
        activeAnimations: number;
        heading: string | undefined;
        opacity: number;
        x: number;
        y: number;
      };
    };
    const observer = new MutationObserver(() => {
      const root = document.querySelector<HTMLElement>('.account-map-setup');
      if (root === null) return;
      const style = getComputedStyle(root);
      const matrix = new DOMMatrixReadOnly(style.transform);
      stateWindow.__isfAccountMapFirstFrame = {
        activeAnimations: root.getAnimations({ subtree: true })
          .filter((animation) => (
            (animation.playState === 'running' || animation.playState === 'pending')
            && Number(animation.effect?.getComputedTiming().duration ?? 0) > 1
          ))
          .length,
        heading: root.querySelector('h1')?.textContent?.trim(),
        opacity: Number(style.opacity),
        x: matrix.m41,
        y: matrix.m42,
      };
      observer.disconnect();
    });
    observer.observe(document, { childList: true, subtree: true });
  });
}

async function readProbedAccountMapFirstFrame(page: Page) {
  await page.waitForFunction(() => '__isfAccountMapFirstFrame' in window);
  return page.evaluate(() => (window as typeof window & {
    __isfAccountMapFirstFrame: {
      activeAnimations: number;
      heading: string | undefined;
      opacity: number;
      x: number;
      y: number;
    };
  }).__isfAccountMapFirstFrame);
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
