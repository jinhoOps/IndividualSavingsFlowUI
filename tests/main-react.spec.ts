import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const appliedMainV2 = {
  schemaVersion: 2 as const,
  updatedAt: 1,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const appliedWorkspaceV1 = {
  schemaVersion: 1 as const,
  revision: 1,
  updatedAt: 1,
  main: { applied: appliedMainV2, setupProgress: null },
  simulation: { draft: null },
  portfolio: { plans: [], draft: null },
  locations: [],
  accountMap: { applied: null, draft: null, instruments: [], flows: [] },
};

const appliedWorkspaceV5 = { ...appliedWorkspaceV1, main: {...appliedWorkspaceV1.main, expenseAssistant: null},
  schemaVersion: 5 as const,
  accountMap: { applied: null, draft: null },
};

const seededOldMainRecords = {
  'isf-main-v2': JSON.stringify({ ...appliedMainV2, monthlyNetIncomeWon: 9_900_000 }),
  'isf-main-v2-pending': '{old-pending',
  'isf-main-v2-setup-progress': JSON.stringify({
    kind: 'initial',
    step: 'review',
    draft: { ...appliedMainV2, monthlyNetIncomeWon: 8_800_000 },
    savedAt: 999,
  }),
  'isf-main-v2-dismissed-recovery': '999',
  'isf-main-v2-quarantined-current': '{old-current-quarantine',
  'isf-main-v2-quarantined-pending': '{old-pending-quarantine',
  'isf-main-v2-history': '[{"updatedAt":999}]',
  'isf-main-v1': '{old-v1',
  'isf-rebuild-v1': '{old-rebuild',
  'isf-step1-active': '{old-active',
};

async function clearBrowserStorage(page: Page, seededRecords: Record<string, string> = {}) {
  await page.addInitScript((records) => {
    if (sessionStorage.getItem('isf-e2e-storage-cleared') !== null) return;
    localStorage.clear();
    for (const [key, raw] of Object.entries(records)) localStorage.setItem(key, raw);
    sessionStorage.setItem('isf-e2e-storage-cleared', 'true');
  }, seededRecords);
}

const mainBrandIntroViewports = [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
] as const;

async function pressTab(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab');
  }
}

async function expectSetupActionVisuallyReady(page: Page, name: string) {
  const action = page.getByRole('button', { name });
  await expect(action).toBeVisible();
  await expect.poll(() => action.evaluate((element) => {
    const style = getComputedStyle(element);
    const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
    return {
      opacity: Number(style.opacity),
      translateY: Math.round(matrix.f * 1000) / 1000,
    };
  })).toEqual({ opacity: 1, translateY: 0 });
}

async function expectReviewVisualInViewport(page: Page) {
  const visual = page.getByTestId('allocation-visual-stage');
  await expect(visual).toBeVisible();
  await expect.poll(() => visual.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      hasArea: bounds.width > 0 && bounds.height > 0,
      inViewport: bounds.bottom > 0
        && bounds.top < window.innerHeight
        && bounds.right > 0
        && bounds.left < window.innerWidth,
      opacity: Number(style.opacity),
    };
  })).toEqual({ hasArea: true, inViewport: true, opacity: 1 });
}

async function expectReviewReadingWidth(page: Page, viewportWidth: number) {
  const reviewSurface = page.locator('.setup-flow-surface');
  const allocation = page.locator('.allocation-bar');
  await expect(reviewSurface).not.toHaveClass(/app-wide-visual/);
  await expect(allocation).not.toHaveClass(/app-wide-visual/);

  await expect.poll(() => reviewSurface.evaluate((surface) => {
    const surfaceRect = surface.getBoundingClientRect();
    const allocationRect = surface.querySelector<HTMLElement>('.allocation-bar')!.getBoundingClientRect();
    return {
      allocationInsideSurface: allocationRect.left >= surfaceRect.left
        && allocationRect.right <= surfaceRect.right,
      surfaceWidth: surfaceRect.width,
    };
  })).toEqual({
    allocationInsideSurface: true,
    surfaceWidth: Math.min(viewportWidth - 32, 48 * 16),
  });
}

async function expectDashboardSummary(page: Page, amounts: {
  consumption: string;
  remaining: string;
  saving: string;
  investment: string;
}) {
  const summary = page.getByRole('region', { name: '월 자금 구성 요약' });
  await expect(summary).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(summary.locator('.cashflow-donut__center strong > [aria-hidden="true"]')).toHaveText('15.6%');
  await expect(summary.getByText('저축·투자 비중', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toHaveCount(0);
  await expect(page.locator('details.allocation-details')).not.toHaveAttribute('open');
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText(amounts.consumption);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '남는 돈' })).toContainText(amounts.remaining);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 저축' })).toContainText(amounts.saving);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 투자' })).toContainText(amounts.investment);
  await page.getByText('자세히 보기', { exact: true }).click();
  await expect(page.getByRole('table', { name: '월 자금 항목' })).toBeVisible();
}

async function expectResponsiveDashboardFlow(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('apps/main/');

  const summary = page.getByRole('region', { name: '월 자금 구성 요약' });
  const donut = summary.getByRole('region', { name: '월 수입 배분' });
  const cards = page.getByRole('region', { name: '월간 핵심 수치' });
  const simulation = page.getByRole('region', { name: 'Simulation으로 계획 이어가기' });
  await expect(donut).toBeVisible();
  await expect(cards).toBeVisible();
  await expect(simulation).toBeVisible();

  const layout = await page.evaluate(() => {
    const donut = document.querySelector<HTMLElement>('.cashflow-donut')!;
    const cards = document.querySelector<HTMLElement>('[aria-label="월간 핵심 수치"]')!;
    const simulation = document.querySelector<HTMLElement>('[aria-labelledby="journey-entry-title"]')!;
    const chart = donut.querySelector<HTMLElement>('.cashflow-donut__chart')!;
    const center = donut.querySelector<HTMLElement>('.cashflow-donut__center')!;
    const centerValue = center.querySelector<HTMLElement>('strong')!;
    const centerLabel = center.querySelector<HTMLElement>(':scope > span')!;
    const chartRect = donut.querySelector<HTMLElement>('.cashflow-donut__overview')!.getBoundingClientRect();
    const valueRect = centerValue.getBoundingClientRect();
    const labelRect = centerLabel.getBoundingClientRect();
    const relativeLuminance = (color: string) => {
      const channels = color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).map((value) => {
        const normalized = Number(value) / 255;
        return normalized <= 0.04045
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const whiteLuminance = 1;
    return {
      domOrder: (donut.compareDocumentPosition(cards) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
        && (cards.compareDocumentPosition(simulation) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
      visualOrder: [donut, cards, simulation].map((element) => element.getBoundingClientRect().top),
      centerWithinChart: valueRect.top >= chartRect.top
        && labelRect.bottom <= chartRect.bottom
        && valueRect.bottom <= labelRect.top,
      legendHeights: Array.from(donut.querySelectorAll<HTMLElement>('.cashflow-donut__legend-button')).map((element) => element.getBoundingClientRect().height),
      legendTextContrast: Array.from(donut.querySelectorAll<HTMLElement>('.cashflow-donut__legend-button span')).map((element) => {
        const luminance = relativeLuminance(getComputedStyle(element).color);
        return (whiteLuminance + 0.05) / (luminance + 0.05);
      }),
      detailsSummaryHeight: document.querySelector<HTMLElement>('.allocation-details > summary')!.getBoundingClientRect().height,
      overflow: document.documentElement.scrollWidth <= window.innerWidth,
    };
  });
  expect(layout.domOrder).toBe(true);
  expect(layout.visualOrder[0]).toBeLessThan(layout.visualOrder[1]);
  expect(layout.visualOrder[1]).toBeLessThan(layout.visualOrder[2]);
  expect(layout.centerWithinChart).toBe(true);
  for (const height of layout.legendHeights) expect(height).toBeGreaterThanOrEqual(43.99);
  expect(layout.detailsSummaryHeight).toBeGreaterThanOrEqual(43.99);
  for (const contrast of layout.legendTextContrast) expect(contrast).toBeGreaterThanOrEqual(4.5);
  expect(layout.overflow).toBe(true);

  const details = page.locator('details.allocation-details');
  await expect(details).not.toHaveAttribute('open');
  await page.getByText('자세히 보기', { exact: true }).click();
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('.allocation-bar')).toBeVisible();
  await expect(details.getByTestId('allocation-visual-stage')).not.toHaveClass(/app-wide-visual/);
  const dashboardTable = details.getByRole('table', { name: '월 자금 항목' });
  await expect(dashboardTable).toBeVisible();
  await expect(dashboardTable).not.toHaveClass(/app-wide-visual/);
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
  ))).toBe(true);

  await page.getByRole('button', { name: '월 금액 편집' }).click();
  const editor = viewport.width < 768
    ? page.getByRole('dialog')
    : page.locator('.main-editor-panel');
  await expect(editor).toBeVisible();
  await expect.poll(() => editor.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
  await expect.poll(() => editor.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0
      && bounds.top >= 0
      && bounds.right <= window.innerWidth
      && bounds.bottom <= window.innerHeight;
  })).toBe(true);
}

test('downloads and explicitly resets an invalid workspace before a durable apply', async ({ page }) => {
  const invalidRaw = '{malformed-workspace';
  await clearBrowserStorage(page, {
    ...seededOldMainRecords,
    'isf-workspace-v1': invalidRaw,
  });
  await page.goto('apps/main/');
  await expect(page.getByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '기존 원본 JSON 다운로드' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  expect(await readFile(downloadPath!, 'utf8')).toBe(invalidRaw);

  await page.getByRole('button', { name: '빈 초안으로 다시 시작' }).click();
  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => {
    const currentRaw = localStorage.getItem('isf-workspace-v5');
    return {
      retiredRaw: localStorage.getItem('isf-workspace-v1'),
      current: currentRaw === null ? null : JSON.parse(currentRaw),
    };
  })).toEqual({
    retiredRaw: invalidRaw,
    current: expect.objectContaining({
      schemaVersion: 5,
      revision: 1,
      main: { expenseAssistant: null, applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null },
    }),
  });
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 실수령액').fill('3200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 주거 고정비').fill('800000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월평균 생활비').fill('1000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '계획 적용' }).click();
  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v5')!).main.applied.monthlyNetIncomeWon
  ))).toBe(3_200_000);
  expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v1'))).toBe(invalidRaw);
  await expect.poll(() => page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), Object.keys(seededOldMainRecords))).toEqual(seededOldMainRecords);
});

for (const viewport of mainBrandIntroViewports) {
  test(`Main fresh setup opens directly at ${viewport.width}px and resumes`, async ({page}) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    const welcome = page.getByRole('heading', {name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.'});
    await expect(welcome).toBeVisible();
    await expect(welcome).toBeFocused();
    await expect(page.getByTestId('main-welcome-intro')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('isf-workspace-v5')!).main.setupProgress))
      .toMatchObject({kind: 'initial', step: 'welcome'});
    await page.reload();
    await expect(welcome).toBeFocused();
  });
}

test('Main restart brand entry preserves the applied plan and writes restart welcome progress', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript((workspace) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
  }, appliedWorkspaceV5);
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '처음부터 다시' }).click();
  await page.getByRole('button', { name: '다시 시작' }).click();

  const intro = page.getByTestId('brand-welcome');
  await expect(intro).toBeVisible();
  await expect(page.getByRole('button', {name: '화면을 눌러 건너뛰기'})).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    return { applied: workspace.main.applied, progress: workspace.main.setupProgress };
  })).toEqual({
    applied: appliedMainV2,
    progress: {
      kind: 'restart',
      step: 'welcome',
      draft: appliedMainV2,
      savedAt: expect.any(Number),
    },
  });

  await page.getByRole('button', {name: '화면을 눌러 건너뛰기'}).click();
  const welcome = page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' });
  await expect(welcome).toBeVisible();
  await expect(welcome).toBeFocused();
  await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
});

test('Main brand intro reduced motion skips fresh animation and writes initial welcome progress', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

  const welcome = page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' });
  await expect(page.getByTestId('main-welcome-intro')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '화면을 눌러 건너뛰기' })).toHaveCount(0);
  await expect(welcome).toBeVisible();
  await expect(welcome).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-workspace-v5');
    return raw === null ? null : JSON.parse(raw).main.setupProgress;
  })).toMatchObject({ kind: 'initial', step: 'welcome' });
});

test('Main brand intro reduced motion skips restart animation and preserves the applied plan', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((workspace) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
  }, appliedWorkspaceV5);
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('menuitem', { name: '처음부터 다시' }).click();
  await page.getByRole('button', { name: '다시 시작' }).click();

  const welcome = page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' });
  await expect(page.getByTestId('main-welcome-intro')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '화면을 눌러 건너뛰기' })).toHaveCount(0);
  await expect(welcome).toBeVisible();
  await expect(welcome).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    return { applied: workspace.main.applied, progress: workspace.main.setupProgress };
  })).toEqual({
    applied: appliedMainV2,
    progress: {
      kind: 'restart',
      step: 'welcome',
      draft: appliedMainV2,
      savedAt: expect.any(Number),
    },
  });
});

test('new user applies the v2 quick setup and refreshes into matching dashboard totals', async ({ page }) => {
  await clearBrowserStorage(page, seededOldMainRecords);
  await page.goto('apps/main/');

  await expect(page).toHaveURL(/\/IndividualSavingsFlowUI\/apps\/main\/$/);
  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 실수령액').fill('3200000');
  await expect(page.getByLabel('월 실수령액')).toHaveValue('3,200,000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 주거 고정비').fill('800000');
  await expect(page.getByLabel('월 주거 고정비')).toHaveValue('800,000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월평균 생활비').fill('1000000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await expect(page.locator('.allocation-bar__visual-track')).toBeVisible();
  await expect(page.getByRole('button', { name: '지출 · 180만 원 · 56.3%' })).toBeVisible();
  await expect(page.getByRole('button', { name: /저축 (상세 정보|· 30만 원 · 9\.4%)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /투자 (상세 정보|· 20만 원 · 6\.3%)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '남는 돈 · 90만 원 · 28.1%' })).toBeVisible();
  const reviewAllocation = page.locator('.allocation-bar');
  await expect(reviewAllocation).not.toHaveClass(/app-wide-visual/);
  await expect(page.getByTestId('allocation-visual-stage')).not.toHaveClass(/app-wide-visual/);
  const reviewTable = page.getByRole('table', { name: '월 자금 항목' });
  await expect(reviewTable).not.toHaveClass(/app-wide-visual/);
  const reviewBounds = await reviewAllocation.evaluate((card) => {
    const cardRect = card.getBoundingClientRect();
    const surfaceRect = card.closest<HTMLElement>('.setup-flow-surface')!.getBoundingClientRect();
    const stageRect = card.querySelector('.allocation-bar__visual-stage')!.getBoundingClientRect();
    const tableRect = card.querySelector('table')!.getBoundingClientRect();
    return {
      cardInsideSurface: cardRect.left >= surfaceRect.left && cardRect.right <= surfaceRect.right,
      stageInside: stageRect.left >= cardRect.left && stageRect.right <= cardRect.right,
      tableInside: tableRect.left >= cardRect.left && tableRect.right <= cardRect.right,
    };
  });
  expect(reviewBounds).toEqual({ cardInsideSurface: true, stageInside: true, tableInside: true });
  await expect(reviewTable.getByRole('row', { name: /지출.*180만 원.*56\.3%/ })).toBeVisible();
  await expect(reviewTable.getByRole('row', { name: /저축.*30만 원.*9\.4%/ })).toBeVisible();
  await expect(reviewTable.getByRole('row', { name: /투자.*20만 원.*6\.3%/ })).toBeVisible();
  await expect(reviewTable.getByRole('row', { name: /남는 돈.*90만 원.*28\.1%/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth <= window.innerWidth
  ))).toBe(true);
  await page.getByRole('button', { name: '이전' }).click();
  await page.getByRole('button', { name: '다음' }).click();
  await expect(page.locator('.allocation-bar__visual-track')).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  await page.getByRole('button', { name: '계획 적용' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeEnabled();
  await expectDashboardSummary(page, {
    consumption: '180만 원',
    remaining: '90만 원',
    saving: '30만 원',
    investment: '20만 원',
  });

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-workspace-v5');
    if (raw === null) return null;
    const workspace = JSON.parse(raw);
    const { updatedAt: _updatedAt, ...stored } = workspace.main.applied;
    return {
      applied: stored,
      setupProgress: workspace.main.setupProgress,
      simulation: workspace.simulation,
      portfolio: workspace.portfolio,
      locations: workspace.locations,
      accountMap: workspace.accountMap,
    };
  })).toEqual({
    applied: {
      schemaVersion: 2,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: 300_000,
      monthlyInvestmentWon: 200_000,
    },
    setupProgress: null,
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [],
    accountMap: { applied: null, draft: null },
  });
  await expect.poll(() => page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), Object.keys(seededOldMainRecords))).toEqual(seededOldMainRecords);

  await page.reload();

  await expect(page).toHaveURL(/\/IndividualSavingsFlowUI\/apps\/main\/$/);
  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expectDashboardSummary(page, {
    consumption: '180만 원',
    remaining: '90만 원',
    saving: '30만 원',
    investment: '20만 원',
  });
});

test('setup motion reaches final state in real time at required viewports', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.addInitScript((workspace) => {
    if (sessionStorage.getItem('isf-main-real-time-motion-seeded') !== null) return;
    localStorage.clear();
    localStorage.setItem('isf-workspace-v5', JSON.stringify({
      ...workspace,
      main: { expenseAssistant: null,
        applied: null,
        setupProgress: {
          kind: 'initial',
          step: 'welcome',
          draft: { ...workspace.main.applied, updatedAt: 0 },
          savedAt: Date.now(),
        },
      },
    }));
    sessionStorage.setItem('isf-main-real-time-motion-seeded', 'true');
  }, appliedWorkspaceV5);

  for (const viewport of mainBrandIntroViewports) {
    await page.setViewportSize(viewport);
    await page.goto('apps/main/');

    const next = page.getByRole('button', { name: '다음' });
    await expect(next).toBeVisible();
    await expect.poll(() => next.evaluate((element) => (
      Number(getComputedStyle(element).opacity)
    ))).toBe(1);
    await expect.poll(() => next.evaluate((element) => {
      const transform = getComputedStyle(element).transform;
      return new DOMMatrixReadOnly(transform === 'none' ? undefined : transform).f;
    })).toBeCloseTo(0, 3);

    await page.evaluate((workspace) => {
      localStorage.setItem('isf-workspace-v5', JSON.stringify({
        ...workspace,
        main: { expenseAssistant: null,
          applied: null,
          setupProgress: {
            kind: 'initial',
            step: 'review',
            draft: workspace.main.applied,
            savedAt: Date.now(),
          },
        },
      }));
    }, appliedWorkspaceV5);
    await page.reload();

    await expect.poll(() => page.locator('.setup-flow-surface').evaluate((root) => ({
      scaleX: new DOMMatrixReadOnly(
        getComputedStyle(root.querySelector<HTMLElement>('.allocation-bar__visual-track')!).transform,
      ).a,
      segmentOpacities: [...root.querySelectorAll<HTMLElement>('.allocation-bar__visual-segment')]
        .map((element) => Number(getComputedStyle(element).opacity)),
      contentOpacities: [...root.querySelectorAll<HTMLElement>('[data-assembly-content]')]
        .map((element) => Number(getComputedStyle(element).opacity)),
    }))).toEqual({
      scaleX: 1,
      segmentOpacities: [1, 1, 1, 1],
      contentOpacities: [1, 1, 1],
    });
    await expect(page.getByRole('button', { name: '계획 적용' })).toBeVisible();
    await expect(page.locator('.allocation-bar')).not.toHaveClass(/app-wide-visual/);
    await expect(page.getByTestId('allocation-visual-stage')).not.toHaveClass(/app-wide-visual/);
    await expectReviewReadingWidth(page, viewport.width);
    await expectReviewVisualInViewport(page);
    await expect.poll(() => page.evaluate(() => (
      document.documentElement.scrollWidth <= window.innerWidth
    ))).toBe(true);

    await page.evaluate((workspace) => {
      localStorage.setItem('isf-workspace-v5', JSON.stringify({
        ...workspace,
        main: { expenseAssistant: null,
          applied: workspace.main.applied,
          setupProgress: {
            kind: 'restart',
            step: 'review',
            draft: workspace.main.applied,
            savedAt: Date.now(),
          },
        },
      }));
    }, appliedWorkspaceV5);
    await page.reload();

    await expect(page.getByRole('button', { name: '계획 적용' })).toBeVisible();
    await expectReviewReadingWidth(page, viewport.width);
    await expectReviewVisualInViewport(page);
    await expect.poll(() => page.evaluate(() => (
      document.documentElement.scrollWidth <= window.innerWidth
    ))).toBe(true);

    await page.evaluate((workspace) => {
      localStorage.setItem('isf-workspace-v5', JSON.stringify({
        ...workspace,
        main: { expenseAssistant: null,
          applied: null,
          setupProgress: {
            kind: 'initial',
            step: 'welcome',
            draft: { ...workspace.main.applied, updatedAt: 0 },
            savedAt: Date.now(),
          },
        },
      }));
    }, appliedWorkspaceV5);
  }
});

test('setup action stays visible after welcome motion hands off to later steps', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();

  await page.getByRole('button', { name: '다음' }).click();
  await page.waitForTimeout(600);
  await expectSetupActionVisuallyReady(page, '다음');

  await page.getByLabel('월 실수령액').fill('3200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 주거 고정비').fill('800000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월평균 생활비').fill('1000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
  await expect(page.locator('.allocation-table')).toBeVisible();
  await expect(page.locator('.setup-flow-surface').evaluate((root) => (
    [...root.querySelectorAll<HTMLElement>('[data-assembly-content]')]
      .map((element) => Number(getComputedStyle(element).opacity))
  ))).resolves.toEqual([1, 1, 1]);

  await expect.poll(() => page.locator('.setup-flow-surface').evaluate((root) => ({
    trackScaleX: new DOMMatrixReadOnly(
      getComputedStyle(root.querySelector<HTMLElement>('.allocation-bar__visual-track')!).transform,
    ).a,
    contentOpacities: [...root.querySelectorAll<HTMLElement>('[data-assembly-content]')]
      .map((element) => Number(getComputedStyle(element).opacity)),
  }))).toEqual({
    trackScaleX: 1,
    contentOpacities: [1, 1, 1],
  });
  await expectReviewVisualInViewport(page);
  await expectSetupActionVisuallyReady(page, '계획 적용');
});

test('initial setup previous keeps every returned step visible and actionable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 390, height: 844 });
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 실수령액').fill('3200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 주거 고정비').fill('800000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월평균 생활비').fill('1000000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await page.getByRole('button', { name: '다음' }).click();

  for (const expectedHeading of [
    '매달 저축과 투자는 얼마나 하나요?',
    '그 밖의 생활비는 보통 얼마인가요?',
    '주거비로 매달 얼마가 나가나요?',
    '한 달에 실제로 들어오는 돈은 얼마인가요?',
    '한 달 돈의 흐름, 2분이면 확인할 수 있어요.',
  ]) {
    await page.getByRole('button', { name: '이전' }).click();
    const heading = page.getByRole('heading', { name: expectedHeading });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByRole('button', { name: '다음' })).toBeVisible();
    await expect.poll(() => heading.evaluate((element) => {
      const motionTarget = element.closest<HTMLElement>('[data-step-motion]')
        ?? element.closest<HTMLElement>('[data-welcome-motion]')!;
      const styles = getComputedStyle(motionTarget);
      const matrix = styles.transform === 'none'
        ? new DOMMatrixReadOnly()
        : new DOMMatrixReadOnly(styles.transform);
      return { opacity: styles.opacity, scaleY: matrix.d, translateY: matrix.f };
    })).toEqual({ opacity: '1', scaleY: 1, translateY: 0 });
  }
});

test('review assembly captures timed deficit geometry and reduced motion', async ({ page }, testInfo) => {
  const viewports = [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ];
  const slightDeficit = {
    ...appliedMainV2,
    monthlyInvestmentWon: 1_260_000,
  };
  const clippedDeficit = {
    ...appliedMainV2,
    monthlyNetIncomeWon: 1_000_000,
    monthlyHousingWon: 1_000_000,
    monthlyLivingWon: 0,
    monthlySavingWon: 1_000_000,
    monthlyInvestmentWon: 1_000_000,
  };

  await page.clock.install({ time: new Date('2026-08-12T00:00:00Z') });
  await page.goto('apps/main/');
  await page.clock.pauseAt(new Date('2026-08-12T00:01:00Z'));

  const showReview = async (
    draft: typeof appliedMainV2,
    kind: 'initial' | 'restart' = 'initial',
  ) => {
    await page.evaluate(({ workspace, reviewDraft, setupKind }) => {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v5', JSON.stringify({
        ...workspace,
        main: { expenseAssistant: null,
          applied: setupKind === 'restart' ? workspace.main.applied : null,
          setupProgress: {
            kind: setupKind,
            step: 'review',
            draft: reviewDraft,
            savedAt: Date.now(),
          },
        },
      }));
    }, { workspace: appliedWorkspaceV5, reviewDraft: draft, setupKind: kind });
    await page.reload();
    await expect(page.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();
  };
  const pauseSubtreeAnimations = async () => {
    await page.locator('.setup-flow-surface').evaluate((element) => {
      for (const animation of element.getAnimations({ subtree: true })) animation.pause();
    });
  };
  const capture = async (width: number, state: string) => {
    await pauseSubtreeAnimations();
    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`main-review-${width}-${state}.png`),
    });
  };
  const readAssemblyState = async () => page.locator('.allocation-bar').evaluate((element) => {
    const track = element.querySelector<HTMLElement>('.allocation-bar__visual-track')!;
    const overflowLabel = element.querySelector<HTMLElement>('.cashflow-bar__overflow-label');
    const matrix = new DOMMatrixReadOnly(getComputedStyle(track).transform);
    const opacities = Array.from(element.querySelectorAll<HTMLElement>('[data-assembly-content]'))
      .map((content) => Number(getComputedStyle(content).opacity));
    return {
      scaleX: matrix.a,
      opacities,
      overflowLabelOpacity: overflowLabel === null
        ? null
        : Number(getComputedStyle(overflowLabel).opacity),
    };
  });
  const expectOverflowGeometry = async (draft: typeof appliedMainV2) => {
    const geometry = await page.locator('.allocation-bar__segments').evaluate((element) => {
      const extension = element.querySelector<HTMLElement>('.cashflow-bar__clip')!
        .getBoundingClientRect();
      const track = element.querySelector<HTMLElement>('.allocation-bar__visual-track')!
        .getBoundingClientRect();
      const base = element.getBoundingClientRect();
      return {
        actualOverflowRatio: (track.width - base.width) / base.width,
        baseRight: base.right,
        baseWidth: base.width,
        clipped: element.getAttribute('data-overflow-clipped') === 'true',
        extensionRight: extension.right,
        safeRight: document.documentElement.clientWidth - 16,
        viewportWidth: window.innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
      };
    });
    const deficitWon = draft.monthlyHousingWon
      + draft.monthlyLivingWon
      + draft.monthlySavingWon
      + draft.monthlyInvestmentWon
      - draft.monthlyNetIncomeWon;
    const expectedDesiredEndPercent = 100 + deficitWon / draft.monthlyNetIncomeWon * 100;
    const availableRightPercent = (geometry.safeRight - geometry.baseRight) / geometry.baseWidth * 100;
    const expectedVisibleEndPercent = Math.min(
      expectedDesiredEndPercent,
      100 + Math.max(0, availableRightPercent),
    );
    expect(geometry.clipped).toBe(expectedVisibleEndPercent < expectedDesiredEndPercent);
    expect(geometry.actualOverflowRatio).toBeCloseTo(deficitWon / draft.monthlyNetIncomeWon, 3);
    expect(geometry.extensionRight).toBeLessThanOrEqual(geometry.safeRight + 0.01);
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.viewportWidth);
  };

  for (const viewport of viewports) {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize(viewport);
    await showReview(appliedMainV2);
    await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toHaveCount(0);
    await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);

    const start = await readAssemblyState();
    expect(start.scaleX).toBeLessThan(0.1);
    expect(start.opacities).toEqual(start.opacities.map(() => 1));
    await capture(viewport.width, 'start');

    await page.clock.runFor(130);
    const middle = await readAssemblyState();
    expect(middle.scaleX).toBeGreaterThan(0.1);
    expect(middle.scaleX).toBeLessThan(1);
    expect(middle.opacities).toEqual(middle.opacities.map(() => 1));
    await capture(viewport.width, 'mid');

    await page.clock.runFor(1_200);
    const final = await readAssemblyState();
    expect(final.scaleX).toBeCloseTo(1, 3);
    expect(final.opacities).toEqual(final.opacities.map(() => 1));
    await expectReviewVisualInViewport(page);
    await capture(viewport.width, 'final');

    await showReview(slightDeficit);
    await page.clock.runFor(1_200);
    await expectOverflowGeometry(slightDeficit);
    await capture(viewport.width, 'deficit-slight');

    await showReview(clippedDeficit);
    const clippedStart = await readAssemblyState();
    expect(clippedStart.scaleX).toBeLessThan(0.1);
    expect(clippedStart.overflowLabelOpacity).toBe(1);
    await capture(viewport.width, 'deficit-clipped-start');

    await page.clock.runFor(130);
    const clippedMiddle = await readAssemblyState();
    expect(clippedMiddle.scaleX).toBeGreaterThan(0.1);
    expect(clippedMiddle.scaleX).toBeLessThan(1);
    expect(clippedMiddle.overflowLabelOpacity).toBe(1);
    await capture(viewport.width, 'deficit-clipped-mid');

    await page.clock.runFor(1_200);
    const clippedFinal = await readAssemblyState();
    expect(clippedFinal.overflowLabelOpacity).toBe(1);
    await expectOverflowGeometry(clippedDeficit);
    await capture(viewport.width, 'deficit-clipped');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await showReview(appliedMainV2);
    const reduced = await readAssemblyState();
    expect(reduced.scaleX).toBeCloseTo(1, 3);
    expect(reduced.opacities).toEqual(reduced.opacities.map(() => 1));
    await expectReviewVisualInViewport(page);
    await capture(viewport.width, 'reduced-motion');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await showReview(appliedMainV2, 'restart');
    await page.clock.runFor(1_200);
    const restarted = await readAssemblyState();
    expect(restarted.scaleX).toBeCloseTo(1, 3);
    expect(restarted.opacities).toEqual(restarted.opacities.map(() => 1));
    await expectReviewVisualInViewport(page);
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
});

test('live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspaceV5);

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await expectResponsiveDashboardFlow(page, viewport);
  }
});

test.describe('mobile cashflow donut', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('keeps readable amount rows and reveals touched ring details', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
    }, appliedWorkspaceV5);
    await page.goto('apps/main/');

    const donut = page.getByRole('region', { name: '월 수입 배분' });
    const legendLayout = await donut.locator('.cashflow-donut__legend-button').evaluateAll((buttons) => (
      buttons.map((button) => {
        const row = button.closest('.cashflow-metric')!;
        const rect = row.getBoundingClientRect();
        const label = button.querySelector('span:first-child')!.getBoundingClientRect();
        const amount = row.querySelector('.cashflow-metric__value')!.getBoundingClientRect();
        return {
          height: rect.height,
          alignedAmount: amount.left >= label.right && amount.bottom <= rect.bottom,
          text: row.textContent ?? '',
          accessibleName: button.getAttribute('aria-label') ?? '',
        };
      })
    ));

    expect(legendLayout).toHaveLength(4);
    for (const item of legendLayout) {
      expect(item.height).toBeGreaterThanOrEqual(44);
      expect(item.alignedAmount).toBe(true);
      expect(item.text).toContain('만 원');
      expect(item.accessibleName).toContain('만 원');
    }
    await expect(donut.locator('.cashflow-metric__value')).toHaveCount(4);

    const chart = donut.getByRole('img', { name: /지출 56\.3%.*여윳돈 28\.1%/ });
    const chartBox = await chart.boundingBox();
    expect(chartBox).not.toBeNull();
    const center = donut.locator('.cashflow-donut__center');
    for (const allocation of [
      { id: 'consumption', label: '지출', amount: '180만 원', percentage: '56.3%', x: 89.2, y: 57.8 },
      { id: 'saving', label: '저축', amount: '30만 원', percentage: '9.4%', x: 24.6, y: 80.9 },
      { id: 'investment', label: '투자', amount: '20만 원', percentage: '6.3%', x: 13, y: 65.3 },
      { id: 'remaining', label: '여윳돈', amount: '90만 원', percentage: '28.1%', x: 19.1, y: 24.6 },
    ]) {
      await chart.tap({
        position: {
          x: chartBox!.width * allocation.x / 100,
          y: chartBox!.height * allocation.y / 100,
        },
      });
      await expect(center.getByText(allocation.percentage, { exact: true })).toBeVisible();
      await expect(center.getByText(allocation.label, { exact: true })).toBeVisible();
      await expect(center.getByText(allocation.amount, { exact: true })).toBeVisible();
      await expect(donut.getByRole('tooltip')).toHaveCount(0);
      await expect(donut.getByRole('button', {
        name: `${allocation.label} · ${allocation.amount} · ${allocation.percentage}`,
      })).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(() => (
        donut.locator(`circle.cashflow-donut__segment--${allocation.id}`).evaluate((circle) => {
          const style = getComputedStyle(circle);
          return { r: style.r, strokeWidth: style.strokeWidth };
        })
      )).toEqual({ r: '42px', strokeWidth: '15px' });
    }

    await page.getByRole('heading', { name: '이번 달 자금 흐름' }).tap();
    await expect(center.locator('strong > [aria-hidden="true"]')).toHaveText('15.6%');
    await expect(center.getByText('저축·투자 비중', { exact: true })).toBeVisible();
    await expect(donut.locator('.cashflow-donut__segment--active')).toHaveCount(0);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await page.setViewportSize({ width: 768, height: 900 });
    await expect(donut.locator('.cashflow-metric__value')).toHaveCount(4);

    const tabletChartBox = await chart.boundingBox();
    expect(tabletChartBox).not.toBeNull();
    await chart.tap({
      position: {
        x: tabletChartBox!.width * 0.13,
        y: tabletChartBox!.height * 0.653,
      },
    });
    const saving = donut.getByRole('button', { name: '저축 · 30만 원 · 9.4%' });
    await saving.focus();
    await expect(center.getByText('9.4%', { exact: true })).toBeVisible();
    await expect(center.getByText('저축', { exact: true })).toBeVisible();
    await expect(center.getByText('30만 원', { exact: true })).toBeVisible();
    await expect(donut.getByRole('tooltip')).toHaveCount(0);
    await expect(donut.getByRole('button', { name: '투자 · 20만 원 · 6.3%' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(donut.locator('circle.cashflow-donut__segment--saving'))
      .toHaveClass(/cashflow-donut__segment--active/);
    await saving.evaluate((button) => button.blur());
    await expect(center.getByText('6.3%', { exact: true })).toBeVisible();
    await expect(center.getByText('투자', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await expect(donut.locator('.cashflow-metric__value')).toHaveCount(4);
    await saving.hover();
    await expect(center.getByText('9.4%', { exact: true })).toBeVisible();
    await expect(center.getByText('30만 원', { exact: true })).toBeVisible();
    await expect(donut.getByRole('tooltip')).toHaveCount(0);
  });
});

test('live dashboard removes donut circle transitions when reduced motion is requested', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspaceV5);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/main/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();

  await expect(page.getByRole('region', { name: '월 자금 구성 요약' })).toBeVisible();
  const chart = page.getByRole('img', { name: /지출 56\.3%/ });
  const chartBox = await chart.boundingBox();
  expect(chartBox).not.toBeNull();
  await chart.click({ position: { x: chartBox!.width / 2, y: chartBox!.height * 0.1 } });
  const transition = await page.locator('.cashflow-donut__segment--active').evaluate((element) => {
    const style = getComputedStyle(element);
    return { duration: style.transitionDuration, property: style.transitionProperty, r: style.r };
  });
  expect(transition).toEqual({ duration: '0s', property: 'none', r: '42px' });
});

test.describe('mobile quick setup', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('formats money without adding an intermediate visualization', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('3200000');
    await expect(page.getByLabel('월 실수령액')).toHaveValue('3,200,000');
    await page.getByRole('button', { name: '다음' }).tap();

    await page.getByLabel('월 주거 고정비').fill('800000');
    const quickAdjustments = ['-50만', '-10만', '+10만', '+50만'].map(
      (name) => page.getByRole('button', { name }),
    );
    const adjustmentBoxes = await Promise.all(quickAdjustments.map((button) => button.boundingBox()));
    expect(new Set(adjustmentBoxes.map((box) => Math.round(box!.y))).size).toBe(1);
    for (const box of adjustmentBoxes) {
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
    await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' }).tap();
    expect(await page.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('shows an ordered review table and keeps tiny table targets at least 44px', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('3200000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 투자액').fill('1000');
    await page.getByRole('button', { name: '다음' }).tap();

    const table = page.getByRole('table', { name: '월 자금 항목' });
    await expect(table.getByRole('columnheader')).toHaveText(['종류', '금액', '수입 대비']);
    await expect(table.getByRole('row')).toHaveText([
      '종류금액수입 대비',
      '지출0원0.0%',
      '저축0원0.0%',
      '투자1,000원0.0%',
      '남는 돈319.9만 원100.0%',
    ]);
    await expect(page.locator('.allocation-bar__visual-track')).toHaveCount(1);

    const layout = await page.locator('.allocation-bar').evaluate((card) => {
      const cardRect = card.getBoundingClientRect();
      const parentRect = card.closest('form')!.getBoundingClientRect();
      const tableRect = card.querySelector('.allocation-table')!.getBoundingClientRect();
      const bar = card.querySelector('.allocation-bar__segments')!;
      const cardStyle = getComputedStyle(card);
      const barStyle = getComputedStyle(bar);
      const borderMatch = cardStyle.borderLeftColor.match(/rgba?\(([^)]+)\)/);
      const borderParts = borderMatch?.[1].split(',').map((part) => Number.parseFloat(part.trim())) ?? [];
      return {
        leftGap: cardRect.left - parentRect.left,
        rightGap: parentRect.right - cardRect.right,
        paddingLeft: Number.parseFloat(cardStyle.paddingLeft),
        paddingRight: Number.parseFloat(cardStyle.paddingRight),
        borderWidth: Number.parseFloat(cardStyle.borderLeftWidth),
        borderAlpha: borderParts.length === 4 ? borderParts[3] : 1,
        tableMatchesCard:
          Math.abs(tableRect.left - (cardRect.left + 13)) <= 1
          && Math.abs(tableRect.right - (cardRect.right - 13)) <= 1,
        barRightMargin: Number.parseFloat(barStyle.marginRight),
      };
    });
    expect(Math.abs(layout.leftGap - layout.rightGap)).toBeLessThanOrEqual(1);
    expect(layout.paddingLeft).toBe(12);
    expect(layout.paddingRight).toBe(12);
    expect(layout.borderWidth).toBe(1);
    expect(layout.borderAlpha).toBeGreaterThan(0);
    expect(layout.borderAlpha).toBeLessThanOrEqual(0.2);
    expect(layout.tableMatchesCard).toBe(true);
    expect(layout.barRightMargin).toBe(0);

    for (const name of [
      '남는 돈 · 319.9만 원 · 100.0%',
      '지출 상세 정보',
      '투자 상세 정보',
    ]) {
      const target = page.getByRole('button', { name });
      await expect(target).toHaveCSS('min-height', '44px');
      const box = await target.boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(43.99);
    }

    const tinyTarget = page.getByRole('button', { name: '투자 상세 정보' });
    await tinyTarget.tap();
    await expect(page.getByRole('tooltip')).toHaveText('투자 · 1,000원 · 0.0%');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
  });

  test('routes adjacent small allocations to non-overlapping table targets', async ({ page }) => {
    await clearBrowserStorage(page);
    await page.goto('apps/main/');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 실수령액').fill('10000000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 주거 고정비').fill('200000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월평균 생활비').fill('300000');
    await page.getByRole('button', { name: '다음' }).tap();
    await page.getByLabel('월 저축액').fill('600000');
    await page.getByLabel('월 투자액').fill('700000');
    await page.getByRole('button', { name: '다음' }).tap();

    for (const [name, percentage] of [
      ['지출 상세 정보', '지출 · 50만 원 · 5.0%'],
      ['저축 상세 정보', '저축 · 60만 원 · 6.0%'],
      ['투자 상세 정보', '투자 · 70만 원 · 7.0%'],
    ] as const) {
      const target = page.getByRole('button', { name });
      await expect(target).toHaveClass(/allocation-table__label-target/);
      const box = await target.boundingBox();
      expect(box, `${name} target`).not.toBeNull();
      expect(box!.width, `${name} width`).toBeGreaterThanOrEqual(44);
      expect(box!.height, `${name} height`).toBeGreaterThanOrEqual(44);
      await target.tap();
      await expect(page.getByRole('tooltip')).toHaveText(percentage);
    }

    const remaining = page.getByRole('button', { name: '남는 돈 · 820만 원 · 82.0%' });
    await expect(remaining).toHaveClass(/allocation-bar__segment-target/);
    await expect(remaining).toHaveCSS('min-width', '0px');
    await expect(page.locator('.allocation-bar__segment-target')).toHaveCount(1);
  });
});

test('keyboard-only user completes the full quick setup', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeFocused();

  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('3200000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('800000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('1000000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Tab');
  await page.keyboard.type('300000');
  await pressTab(page, 5);
  await page.keyboard.type('200000');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');
  await pressTab(page, 6);
  await page.keyboard.press('Enter');

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '남는 돈' })).toContainText('90만 원');
});

test('interrupted setup reloads at housing with its v2 draft intact', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 실수령액').fill('3200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 주거 고정비').fill('800000');

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-workspace-v5');
    return raw === null ? null : JSON.parse(raw).main.setupProgress;
  })).toMatchObject({
    kind: 'initial',
    step: 'housing',
    draft: {
      schemaVersion: 2,
      monthlyNetIncomeWon: 3_200_000,
      monthlyHousingWon: 800_000,
    },
  });

  await page.reload();

  await expect(page.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' })).toBeVisible();
  await expect(page.getByLabel('월 주거 고정비')).toHaveValue('800,000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);
});

test('dashboard edit persists only the v2 scalar plan', async ({ page }) => {
  await page.addInitScript((fixture) => {
    if (localStorage.getItem('isf-workspace-v5') === null) {
      localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
    }
  }, appliedWorkspaceV5);
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '월 금액 편집' }).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
  await expect(page.locator('.cashflow-metric').filter({ hasText: '남는 돈' })).toContainText('80만 원');

  await page.reload();

  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText('190만 원');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-workspace-v5');
    return raw === null ? null : Object.keys(JSON.parse(raw).main.applied).sort();
  })).toEqual([
    'monthlyHousingWon',
    'monthlyInvestmentWon',
    'monthlyLivingWon',
    'monthlyNetIncomeWon',
    'monthlySavingWon',
    'schemaVersion',
    'updatedAt',
  ]);
});

test('dashboard deficit entry keeps exiting remaining geometry until interpolation completes', async ({ page }, testInfo) => {
  await page.clock.install({ time: new Date('2026-08-12T00:00:00Z') });
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspaceV5);
  await page.goto('apps/main/');
  await page.clock.pauseAt(new Date('2026-08-12T00:01:00Z'));
  await page.getByText('자세히 보기', { exact: true }).click();

  await page.getByRole('button', { name: '월 금액 편집' }).click();
  await page.getByLabel('월 투자액').fill('1500000');
  await page.getByRole('button', { name: '적용' }).click();

  await expect(page.locator('.cashflow-donut__chart svg')).not.toHaveAccessibleName(/여윳돈/);
  await expect(page.getByRole('button', { name: /여윳돈 ·/ })).toHaveCount(0);
  await expect(page.getByRole('table', { name: '월 자금 항목' }).getByRole('row', { name: /남는 돈/ }))
    .toHaveCount(0);
  await expect(page.getByLabel('월 수입 나누기').getByText('수입보다 40만 원 초과'))
    .toBeVisible();

  const remainingArc = page.locator('circle.cashflow-donut__segment--remaining');
  const remainingBar = page.locator('.allocation-bar__visual-segment--remaining');
  await expect(remainingArc).toHaveAttribute('aria-hidden', 'true');
  await expect(remainingArc).toHaveAttribute('stroke-dasharray', '28.125 71.875');
  await expect.poll(() => remainingBar.evaluate(
    (element) => (element as HTMLElement).style.width,
  )).toBe('28.125%');
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('main-dashboard-deficit-entry-start.png'),
  });

  await page.clock.runFor(130);
  const middle = await Promise.all([
    remainingArc.getAttribute('stroke-dasharray'),
    remainingBar.evaluate((element) => Number.parseFloat((element as HTMLElement).style.width)),
  ]);
  const middleArc = Number.parseFloat(middle[0] ?? '0');
  expect(middleArc).toBeGreaterThan(0);
  expect(middleArc).toBeLessThan(28.125);
  expect(middle[1]).toBeGreaterThan(0);
  expect(middle[1]).toBeLessThan(28.125);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('main-dashboard-deficit-entry-mid.png'),
  });

  await page.clock.runFor(500);
  await expect(remainingArc).toHaveCount(0);
  await expect(remainingBar).toHaveCount(0);
  await page.screenshot({
    fullPage: true,
    path: testInfo.outputPath('main-dashboard-deficit-entry-final.png'),
  });
});

test('월 자금 계획 편집은 편집 중인 금액의 빠른 조정만 표시한다', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture));
  }, appliedWorkspaceV5);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '월 금액 편집' }).click();

  const editor = page.locator('[aria-labelledby="cashflow-editor-title"]');
  const fields = editor.locator('.money-field');
  await fields.nth(0).getByRole('textbox').focus();
  await expect(fields.nth(0).locator('.money-field__adjustments')).toBeVisible();
  await expect(fields.nth(1).locator('.money-field__adjustments')).toBeHidden();

  await fields.nth(0).getByRole('button', { name: '+10만' }).focus();
  await expect(fields.nth(0).locator('.money-field__adjustments')).toBeVisible();

  await fields.nth(1).getByRole('textbox').focus();
  await expect(fields.nth(0).locator('.money-field__adjustments')).toBeHidden();
  await expect(fields.nth(1).locator('.money-field__adjustments')).toBeVisible();
});

for (const width of [390, 768, 1280]) {
  test(`saving and investment amounts open their editor field at ${width}px`, async ({page}) => {
    await page.setViewportSize({width, height: 844});
    await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
    await page.goto('apps/main/');
    const original = await page.evaluate(() => localStorage.getItem('isf-workspace-v5'));
    for (const label of ['월 저축액', '월 투자액']) {
      const opener = page.getByRole('button', {name: new RegExp('^' + label.replace('액', '') + ' 금액 편집')});
      expect((await opener.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await opener.focus();
      await page.keyboard.press('Enter');
      const input = page.getByLabel(label, {exact: true});
      await expect(input).toBeFocused();
      const field = page.locator('.money-field').filter({has: input});
      await expect(field.getByRole('button', {name: '+10만', exact: true})).toBeVisible();
      const bounds = await input.boundingBox();
      expect(bounds!.y).toBeGreaterThanOrEqual(0);
      expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v5'))).toBe(original);
      if (width >= 768) {
        await page.getByLabel('월 실수령액', {exact: true}).focus();
        await opener.focus();
        await page.keyboard.press('Enter');
        await expect(input).toBeFocused();
      }
      await page.keyboard.press('Escape');
      await expect(opener).toBeFocused();
    }
    // General editing still starts at the usual close control, not the last shortcut.
    await page.getByRole('button', {name: '월 금액 편집', exact: true}).click();
    await expect(page.getByRole('button', {name: '편집기 닫기'})).toBeFocused();
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name: /^월 저축 금액 편집/}).click();
    await page.getByLabel('월 저축액', {exact: true}).fill('400000');
    if (width >= 768) {
      await page.getByRole('button', {name: /^월 투자 금액 편집/}).focus();
      await page.keyboard.press('Enter');
      await expect(page.getByLabel('월 투자액', {exact: true})).toBeFocused();
      await expect(page.getByLabel('월 저축액', {exact: true})).toHaveValue('400,000');
    }
    await page.getByRole('button', {name: '적용', exact: true}).click();
    await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem('isf-workspace-v5')!).main.applied.monthlySavingWon)).toBe(400000);
  });
}
