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
  await expect(summary.locator('.cashflow-allocation__ratio strong')).toHaveText('15.6%');
  await expect(summary.getByText('저축·투자 비중', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toHaveCount(0);
  await expect(page.getByText('자세히 보기', { exact: true })).toHaveCount(0);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 지출' })).toContainText(amounts.consumption);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '남는 돈' })).toContainText(amounts.remaining);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 저축' })).toContainText(amounts.saving);
  await expect(page.locator('.cashflow-metric').filter({ hasText: '월 투자' })).toContainText(amounts.investment);
  await expect(page.getByRole('table', { name: '월 자금 항목' })).toHaveCount(0);
}

async function expectResponsiveDashboardFlow(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await page.goto('apps/main/');

  const summary = page.getByRole('region', { name: '월 자금 구성 요약' });
  await expect(summary.getByRole('img')).toBeVisible();
  await expect(page.locator('.main-journey-entry')).toHaveAttribute('data-revealed', 'false');
  await expect(page.getByText('자세히 보기', { exact: true })).toHaveCount(0);
  const layout = await summary.evaluate(element => {
    const chart = element.querySelector('.cashflow-allocation__chart')!.getBoundingClientRect();
    const rows = element.querySelector('.cashflow-summary')!.getBoundingClientRect();
    return {
      chartHeight: chart.height, chartWidth: chart.width,
      chartBeforeRows: chart.bottom <= rows.top,
      targets: [...element.querySelectorAll('button')].map(item => item.getBoundingClientRect().height),
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  expect(layout.chartHeight).toBe(32);
  expect(layout.chartWidth).toBeGreaterThan(290);
  expect(layout.chartBeforeRows).toBe(true);
  expect(layout.overflow).toBe(false);
  for (const height of layout.targets) expect(height).toBeGreaterThanOrEqual(44);

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
  await expect(page.getByRole('button', { name: '미래 성장 보기' })).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: '미래 성장 보기' })).toBeEnabled();
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

test('live dashboard keeps allocation, rows, and editor contained at required viewports', async ({ page }) => {
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

test.describe('mobile cashflow allocation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('keeps exact figures visible and highlights allocations from touch and keyboard', async ({ page }) => {
    await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
    await page.goto('apps/main/');
    const summary = page.getByRole('region', { name: '월 수입 배분' });
    for (const [id, name] of [['consumption', '지출'], ['saving', '저축'], ['investment', '투자'], ['remaining', '여윳돈']]) {
      const row = summary.getByRole('button', { name: new RegExp('^' + name + ' ·') });
      await row.tap();
      await expect(row).toHaveAttribute('aria-pressed', 'true');
      await expect(summary.locator(`[data-segment="${id}"]`)).toHaveAttribute('data-active', 'true');
    }
    await summary.getByRole('button', { name: /^저축 ·/ }).focus();
    await expect(summary.locator('[data-segment="saving"]')).toHaveAttribute('data-active', 'true');
    await expect(summary.locator('.cashflow-metric__value')).toHaveCount(4);
    await expect(summary.locator('.cashflow-allocation__ratio strong')).toHaveText('15.6%');
    await expect(summary.getByRole('tooltip')).toHaveCount(0);
  });
});

test('live dashboard removes allocation transitions when reduced motion is requested', async ({ page }) => {
  await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('apps/main/');
  const transition = await page.locator('[data-segment="saving"]').evaluate(element => ({
    duration: getComputedStyle(element).transitionDuration, property: getComputedStyle(element).transitionProperty,
  }));
  expect(transition).toEqual({ duration: '0s', property: 'none' });
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

test('dashboard deficit shows all allocations and the income threshold after editing', async ({ page }, testInfo) => {
  await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '월 금액 편집' }).click();
  await page.getByLabel('월 투자액').fill('1500000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('img', { name: /월수입/ })).toHaveAccessibleName(/투자 46.9%.*40만 원 초과/);
  await expect(page.locator('[data-segment="remaining"]')).toHaveCount(0);
  await expect(page.getByText('기준선: 월수입 100%')).toBeVisible();
  await expect(page.locator('.cashflow-metric[data-deficit="true"]')).toContainText('-40만 원');
  await page.getByRole('button', { name: '편집기 닫기' }).click();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await expect.poll(() => page.locator('.cashflow-allocation__chart').evaluate(element => {
      const chart = element.getBoundingClientRect();
      const last = element.querySelector('[data-segment="investment"]')!.getBoundingClientRect();
      return Math.abs(chart.right - last.right) < 1 && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`main-deficit-${width}.png`) });
  }
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

for (const width of [390, 768, 1280]) {
  test(`Main allocation and bottom discovery at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
    await page.goto('apps/main/');
    const entry = page.locator('.main-journey-entry');
    await expect(entry).toHaveAttribute('data-revealed', 'false');
    await expect(page.locator('.cashflow-allocation__ratio strong')).toHaveText('15.6%');
    await expect(page.locator('.cashflow-allocation__split strong')).toHaveText('60 : 40');
    await expect(page.getByRole('region', { name: '월 자금 구성 요약' })).not.toContainText('320만 원');
    await expect(page.locator('.allocation-details')).toHaveCount(0);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`main-allocation-${width}.png`) });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect.poll(() => page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 4)).toBe(true);
    // Arriving at the end alone does not expose the next app.
    await expect(entry).toHaveAttribute('data-revealed', 'false');
    await page.mouse.move(width / 2, 400);
    await page.mouse.wheel(0, 90);
    await expect(entry).toHaveAttribute('data-revealed', 'true');
    await expect(page).toHaveURL(/apps\/main\/$/);
    const next = page.getByRole('button', { name: '미래 성장 보기' });
    await expect(next).toBeInViewport();
    await expect.poll(() => next.evaluate(element => {
      const bounds = element.getBoundingClientRect();
      const dock = document.querySelector('.main-dashboard__edit-dock')!.getBoundingClientRect();
      return bounds.height >= 44 && (innerWidth >= 768 || bounds.bottom <= dock.top) && document.documentElement.scrollWidth <= innerWidth;
    })).toBe(true);
    await expect.poll(() => entry.evaluate(element => getComputedStyle(element.firstElementChild!).opacity)).toBe('1');
    await page.mouse.move(0, 0);
    await page.screenshot({ fullPage: true, path: testInfo.outputPath(`main-discovered-${width}.png`) });
    await next.click();
    await expect(page).toHaveURL(/apps\/simulation\/$/);
  });
}

test('Main bottom entry is reachable by Tab with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '월 금액 편집' }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: '미래 성장 보기' })).toBeFocused();
  await expect(page.locator('.main-journey-entry')).toHaveAttribute('data-revealed', 'true');
  await expect(page.getByRole('button', { name: '미래 성장 보기' })).toBeInViewport();
});

test.describe('Main bottom touch discovery', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('upward swipe at the bottom reveals without navigating', async ({ page }) => {
    await page.addInitScript(fixture => localStorage.setItem('isf-workspace-v5', JSON.stringify(fixture)), appliedWorkspaceV5);
    await page.goto('apps/main/');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const session = await page.context().newCDPSession(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 180, y: 680 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 180, y: 590 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('.main-journey-entry')).toHaveAttribute('data-revealed', 'true');
    await expect(page).toHaveURL(/apps\/main\/$/);
    await expect(page.getByRole('button', { name: '미래 성장 보기' })).toBeInViewport();
  });
});
