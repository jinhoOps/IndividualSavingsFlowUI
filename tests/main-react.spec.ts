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

const connectedWorkspaceV1 = {
  ...appliedWorkspaceV1,
  revision: 7,
  updatedAt: 700,
  simulation: {
    draft: {
      schemaVersion: 2 as const,
      source: {
        monthlySavingsWon: appliedMainV2.monthlySavingWon,
        monthlyInvestmentWon: appliedMainV2.monthlyInvestmentWon,
        mainUpdatedAt: appliedMainV2.updatedAt,
      },
      initialInvestmentWon: 2_000_000,
      years: 20,
      expectedAnnualReturnPercent: 8,
      baseRatePercent: 2.5,
      inflationOffsetPercentPoints: -0.5,
      amountMode: 'nominal' as const,
      updatedAt: 200,
    },
  },
  portfolio: {
    plans: [
      {
        schemaVersion: 2 as const,
        scope: { type: 'aggregate' as const },
        items: [{
          id: 'asset-us', name: '미국 인덱스', shareUnits: 700_000, order: 0,
          classification: 'growth' as const, classificationOrigin: 'automatic' as const,
        }],
        cashShareUnits: 300_000,
        cashMode: 'automatic' as const,
        syncedInvestmentWon: appliedMainV2.monthlyInvestmentWon,
        appliedAt: 300,
        updatedAt: 300,
      },
      {
        schemaVersion: 2 as const,
        scope: { type: 'location' as const, locationId: 'loc-isa' },
        items: [{
          id: 'asset-bond', name: '국채', shareUnits: 400_000, order: 0,
          classification: 'stable' as const, classificationOrigin: 'automatic' as const,
        }],
        cashShareUnits: 600_000,
        cashMode: 'automatic' as const,
        syncedInvestmentWon: appliedMainV2.monthlyInvestmentWon,
        appliedAt: 301,
        updatedAt: 301,
      },
    ],
    draft: null,
  },
  locations: [{
    id: 'loc-isa',
    shortName: 'ISA',
    institution: { id: 'bank-1', name: '미래은행' },
    kind: 'brokerage' as const,
    roles: ['saving' as const, 'investing' as const],
    createdAt: 10,
    updatedAt: 20,
  }],
};

const emptyAccountMapV2 = {
  applied: null,
  draft: null,
  legacyPhaseA: { instruments: [], flows: [] },
};

const releaseGateAccountMapV2 = {
  applied: {
    schemaVersion: 1 as const,
    sourceMainUpdatedAt: appliedMainV2.updatedAt,
    customPurposes: [{
      id: 'custom:trip' as const,
      parentId: 'system:living' as const,
      name: '여행',
      targetMonthlyWon: 100_000,
      archivedAt: 650,
      createdAt: 500,
      updatedAt: 650,
    }],
    links: [
      {
        id: 'saving-isa',
        purposeId: 'system:saving' as const,
        locationId: 'loc-isa',
        monthlyAmountWon: appliedMainV2.monthlySavingWon,
        remainder: true,
        status: 'active' as const,
        createdAt: 500,
        updatedAt: 600,
      },
      {
        id: 'investing-isa',
        purposeId: 'system:investing' as const,
        locationId: 'loc-isa',
        monthlyAmountWon: appliedMainV2.monthlyInvestmentWon,
        remainder: true,
        status: 'active' as const,
        createdAt: 500,
        updatedAt: 600,
      },
      {
        id: 'trip-suspended',
        purposeId: 'custom:trip' as const,
        locationId: 'loc-isa',
        monthlyAmountWon: 100_000,
        remainder: false,
        status: 'suspended' as const,
        suspendedReason: 'user' as const,
        createdAt: 500,
        updatedAt: 650,
      },
      {
        id: 'living-suspended',
        purposeId: 'system:living' as const,
        locationId: 'loc-isa',
        monthlyAmountWon: 50_000,
        remainder: false,
        status: 'suspended' as const,
        suspendedReason: 'user' as const,
        createdAt: 501,
        updatedAt: 650,
      },
    ],
    layout: 'account' as const,
    setupCompletedAt: 500,
    updatedAt: 650,
  },
  draft: null,
  legacyPhaseA: { instruments: [], flows: [] },
};

const releaseGateWorkspaceV2 = {
  ...connectedWorkspaceV1,
  schemaVersion: 2 as const,
  portfolio: {
    ...connectedWorkspaceV1.portfolio,
    draft: {
      schemaVersion: 2 as const,
      scope: { type: 'aggregate' as const },
      items: [{ id: 'asset-us', name: '미국 인덱스', shareUnits: 600_000, order: 0 }],
      cashShareUnits: 400_000,
      cashMode: 'automatic' as const,
      syncedInvestmentWon: appliedMainV2.monthlyInvestmentWon,
      updatedAt: 650,
      inputMode: 'amount' as const,
      isApplicable: true,
    },
  },
  accountMap: releaseGateAccountMapV2,
};

const invalidFutureSourceWorkspace = {
  ...releaseGateWorkspaceV2,
  accountMap: {
    ...releaseGateWorkspaceV2.accountMap,
    applied: {
      ...releaseGateWorkspaceV2.accountMap.applied,
      sourceMainUpdatedAt: appliedMainV2.updatedAt + 1,
    },
  },
};

const invalidSynchronizedCapacityWorkspace = {
  ...releaseGateWorkspaceV2,
  accountMap: {
    ...releaseGateWorkspaceV2.accountMap,
    applied: {
      ...releaseGateWorkspaceV2.accountMap.applied,
      customPurposes: [{
        id: 'custom:excess',
        parentId: 'system:living',
        name: '초과 목적',
        targetMonthlyWon: appliedMainV2.monthlyLivingWon + 1,
        createdAt: 500,
        updatedAt: 650,
      }],
      links: releaseGateWorkspaceV2.accountMap.applied.links.filter(({ purposeId }) => purposeId !== 'custom:trip'),
    },
  },
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

async function pressTab(page: Page, count: number) {
  for (let index = 0; index < count; index += 1) {
    await page.keyboard.press('Tab');
  }
}

async function expectDashboardSummary(page: Page, amounts: {
  consumption: string;
  remaining: string;
  saving: string;
  investment: string;
}) {
  const summary = page.getByRole('region', { name: '월 자금 구성 요약' });
  await expect(summary).toBeVisible();
  await expect(summary.locator('.cashflow-donut__center strong > [aria-hidden="true"]')).toHaveText('15.6%');
  await expect(summary.getByText('저축·투자', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '월 실수령액 편집' })).toHaveCount(0);
  await expect(page.locator('details.allocation-details')).not.toHaveAttribute('open');
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText(amounts.consumption);
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText(amounts.remaining);
  await expect(page.getByRole('button', { name: '월 저축 편집' })).toContainText(amounts.saving);
  await expect(page.getByRole('button', { name: '월 투자 편집' })).toContainText(amounts.investment);
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
    const chartRect = chart.getBoundingClientRect();
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

  await page.getByRole('button', { name: '월 소비 편집' }).click();
  const editor = viewport.width < 768
    ? page.getByRole('dialog')
    : page.locator('div.fixed.inset-y-0.right-0');
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
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).main.applied.monthlyNetIncomeWon
  ))).toBe(3_200_000);
  await expect.poll(() => page.evaluate((keys) => Object.fromEntries(
    keys.map((key) => [key, localStorage.getItem(key)]),
  ), Object.keys(seededOldMainRecords))).toEqual(seededOldMainRecords);
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
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월평균 생활비').fill('1000000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 180만 원 · 수입의 56.3%');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 저축액').fill('300000');
  await page.getByLabel('월 투자액').fill('200000');
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 230만 원 · 수입의 71.9%');
  await page.getByRole('button', { name: '다음' }).click();

  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveCount(0);
  await expect(page.locator('.allocation-bar__visual-track')).toBeVisible();
  await expect(page.getByRole('button', { name: '소비 · 180만 원 · 56.3%' })).toBeVisible();
  await expect(page.getByRole('button', { name: /저축 (상세 정보|· 30만 원 · 9\.4%)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /투자 (상세 정보|· 20만 원 · 6\.3%)/ })).toBeVisible();
  await expect(page.getByRole('button', { name: '남는 돈 · 90만 원 · 28.1%' })).toBeVisible();
  await expect(page.getByTestId('allocation-visual-stage')).toHaveClass(/app-wide-visual/);
  const reviewTable = page.getByRole('table', { name: '월 자금 항목' });
  await expect(reviewTable).not.toHaveClass(/app-wide-visual/);
  const reviewWidths = await page.getByTestId('allocation-visual-stage').evaluate((stage) => ({
    stage: stage.getBoundingClientRect().width,
    table: stage.parentElement?.querySelector('table')?.getBoundingClientRect().width ?? 0,
  }));
  expect(reviewWidths.stage).toBeGreaterThan(reviewWidths.table);
  await expect(reviewTable.getByRole('row', { name: /소비.*180만 원.*56\.3%/ })).toBeVisible();
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
    const raw = localStorage.getItem('isf-workspace-v1');
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
    accountMap: emptyAccountMapV2,
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
      localStorage.setItem('isf-workspace-v1', JSON.stringify({
        ...workspace,
        main: {
          applied: setupKind === 'restart' ? workspace.main.applied : null,
          setupProgress: {
            kind: setupKind,
            step: 'review',
            draft: reviewDraft,
            savedAt: Date.now(),
          },
        },
      }));
    }, { workspace: appliedWorkspaceV1, reviewDraft: draft, setupKind: kind });
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
  const expectOverflowGeometry = async (
    draft: typeof appliedMainV2,
    clipped: boolean,
  ) => {
    const geometry = await page.locator('.allocation-bar__segments').evaluate((element) => {
      const extension = element.querySelector<HTMLElement>('.cashflow-bar__clip')!
        .getBoundingClientRect();
      const track = element.querySelector<HTMLElement>('.allocation-bar__visual-track')!
        .getBoundingClientRect();
      const base = element.getBoundingClientRect();
      return {
        actualOverflowRatio: (track.width - base.width) / base.width,
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
    expect(geometry.clipped).toBe(clipped);
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
    expect(Math.max(...start.opacities)).toBeLessThan(0.1);
    await capture(viewport.width, 'start');

    await page.clock.runFor(130);
    const middle = await readAssemblyState();
    expect(middle.scaleX).toBeGreaterThan(0.1);
    expect(middle.scaleX).toBeLessThan(1);
    expect(Math.min(...middle.opacities)).toBeLessThan(1);
    await capture(viewport.width, 'mid');

    await page.clock.runFor(1_200);
    const final = await readAssemblyState();
    expect(final.scaleX).toBeCloseTo(1, 3);
    expect(final.opacities).toEqual(final.opacities.map(() => 1));
    await capture(viewport.width, 'final');

    await showReview(slightDeficit);
    await page.clock.runFor(1_200);
    await expectOverflowGeometry(slightDeficit, true);
    await capture(viewport.width, 'deficit-slight');

    await showReview(clippedDeficit);
    const clippedStart = await readAssemblyState();
    expect(clippedStart.scaleX).toBeLessThan(0.1);
    expect(clippedStart.overflowLabelOpacity ?? 1).toBeLessThan(0.1);
    await capture(viewport.width, 'deficit-clipped-start');

    await page.clock.runFor(130);
    const clippedMiddle = await readAssemblyState();
    expect(clippedMiddle.scaleX).toBeGreaterThan(0.1);
    expect(clippedMiddle.scaleX).toBeLessThan(1);
    expect(clippedMiddle.overflowLabelOpacity ?? 1).toBeLessThan(1);
    await capture(viewport.width, 'deficit-clipped-mid');

    await page.clock.runFor(1_200);
    const clippedFinal = await readAssemblyState();
    expect(clippedFinal.overflowLabelOpacity).toBe(1);
    await expectOverflowGeometry(clippedDeficit, true);
    await capture(viewport.width, 'deficit-clipped');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await showReview(appliedMainV2);
    const reduced = await readAssemblyState();
    expect(reduced.scaleX).toBeCloseTo(1, 3);
    expect(reduced.opacities).toEqual(reduced.opacities.map(() => 1));
    await capture(viewport.width, 'reduced-motion');
  }

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.setViewportSize({ width: 1280, height: 900 });
  await showReview(appliedMainV2, 'restart');
  await expect(page.getByTestId('allocation-visual-stage')).toHaveClass(/app-wide-visual/);
  await expect(page.getByRole('table', { name: '월 자금 항목' })).not.toHaveClass(/app-wide-visual/);
});

test('live dashboard keeps the donut, cards, Simulation, details, and editor contained at required viewports', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspaceV1);

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

  test('keeps a compact legend and reveals touched ring details', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
    }, appliedWorkspaceV1);
    await page.goto('apps/main/');

    const donut = page.getByRole('region', { name: '월 수입 배분' });
    const legendLayout = await donut.locator('.cashflow-donut__legend-button').evaluateAll((buttons) => (
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        const label = button.querySelector('span:first-child')!.getBoundingClientRect();
        const percentage = button.querySelector('span:last-child')!.getBoundingClientRect();
        const amount = button.querySelector<HTMLElement>('.cashflow-donut__legend-amount')!;
        return {
          height: rect.height,
          oneLine: Math.abs(label.top - percentage.top) <= 1,
          amountDisplay: getComputedStyle(amount).display,
        };
      })
    ));

    expect(legendLayout).toHaveLength(4);
    for (const item of legendLayout) {
      expect(item.height).toBeGreaterThanOrEqual(44);
      expect(item.oneLine).toBe(true);
      expect(item.amountDisplay).toBe('none');
    }

    const chart = donut.getByRole('img', { name: /소비 56\.3%.*여윳돈 28\.1%/ });
    const chartBox = await chart.boundingBox();
    expect(chartBox).not.toBeNull();
    const center = donut.locator('.cashflow-donut__center');
    for (const allocation of [
      { id: 'consumption', label: '소비', amount: '180만 원', percentage: '56.3%', x: 89.2, y: 57.8 },
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
      await expect(donut.getByRole('tooltip')).toHaveText(
        `${allocation.label} · ${allocation.amount} · ${allocation.percentage}`,
      );
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
    await expect(center.getByText('저축·투자', { exact: true })).toBeVisible();
    await expect(donut.locator('.cashflow-donut__segment--active')).toHaveCount(0);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await page.setViewportSize({ width: 768, height: 900 });
    for (const amount of await donut.locator('.cashflow-donut__legend-amount').all()) {
      await expect(amount).toBeVisible();
    }

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
    await expect(donut.getByRole('tooltip')).toHaveText('저축 · 30만 원 · 9.4%');
    await expect(donut.getByRole('button', { name: '투자 · 20만 원 · 6.3%' }))
      .toHaveAttribute('aria-pressed', 'true');
    await expect(donut.locator('circle.cashflow-donut__segment--saving'))
      .toHaveClass(/cashflow-donut__segment--active/);
    await saving.evaluate((button) => button.blur());
    await expect(center.getByText('6.3%', { exact: true })).toBeVisible();
    await expect(center.getByText('투자', { exact: true })).toBeVisible();

    await page.setViewportSize({ width: 1280, height: 900 });
    await saving.hover();
    await expect(center.getByText('9.4%', { exact: true })).toBeVisible();
    await expect(donut.getByRole('tooltip')).toHaveText('저축 · 30만 원 · 9.4%');
  });
});

test('live dashboard removes donut circle transitions when reduced motion is requested', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspaceV1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('apps/main/');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();

  await expect(page.getByRole('region', { name: '월 자금 구성 요약' })).toBeVisible();
  const chart = page.getByRole('img', { name: /소비 56\.3%/ });
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

  test('formats money and reveals the live percentage by tap', async ({ page }) => {
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
    const meter = page.getByRole('progressbar', { name: '수입 대비 현재 계획' });
    await expect(meter).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
    await meter.hover();
    await expect(page.getByRole('tooltip')).toHaveText('현재 계획 80만 원 · 수입의 25.0%');
    await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    const meterBox = await meter.boundingBox();
    expect(meterBox).not.toBeNull();
    expect(meterBox!.height).toBeGreaterThanOrEqual(44);
    await meter.tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    await meter.tap();
    await expect(page.getByRole('tooltip')).toBeVisible();
    await page.getByRole('heading', { name: '주거비로 매달 얼마가 나가나요?' }).tap();
    await expect(page.getByRole('tooltip')).toHaveCount(0);
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
      '소비0원0.0%',
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
      '소비 상세 정보',
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
      ['소비 상세 정보', '소비 · 50만 원 · 5.0%'],
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

test('complete Phase-B backup round-trips atomically in the contained mobile confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(({ workspace, oldRecords }) => {
    if (sessionStorage.getItem('isf-backup-roundtrip-seeded') === null) {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
      for (const [key, raw] of Object.entries(oldRecords)) localStorage.setItem(key, raw);
      sessionStorage.setItem('isf-backup-roundtrip-seeded', 'true');
    }
    const originalSetItem = Storage.prototype.setItem;
    Object.defineProperty(window, '__workspaceWrites', { configurable: true, value: 0, writable: true });
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'isf-workspace-v1') {
        (window as typeof window & { __workspaceWrites: number }).__workspaceWrites += 1;
      }
      originalSetItem.call(this, key, value);
    };
  }, { workspace: releaseGateWorkspaceV2, oldRecords: seededOldMainRecords });
  await page.goto('apps/main/');

  const trigger = page.getByRole('button', { name: '관리 메뉴' });
  await trigger.click();
  await expect(page.getByText(/모든 앱 데이터를 한 번에 백업하고 복원/)).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: '백업 내보내기' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  expect(downloadPath).not.toBeNull();
  const exportedText = await readFile(downloadPath!, 'utf8');
  const exported = JSON.parse(exportedText);
  expect(Object.keys(exported).sort()).toEqual(['exportedAt', 'format', 'formatVersion', 'workspace']);
  expect(exported).toMatchObject({
    format: 'isf-workspace-backup',
    formatVersion: 1,
    workspace: {
      schemaVersion: 2,
      revision: releaseGateWorkspaceV2.revision,
      main: releaseGateWorkspaceV2.main,
      simulation: releaseGateWorkspaceV2.simulation,
      portfolio: releaseGateWorkspaceV2.portfolio,
      locations: releaseGateWorkspaceV2.locations,
      accountMap: releaseGateWorkspaceV2.accountMap,
    },
  });
  for (const excluded of ['isf-main-v2', 'save-lease', 'trophy', '트로피']) {
    expect(exportedText).not.toContain(excluded);
  }

  const mutatedWorkspace = {
    ...appliedWorkspaceV1,
    revision: 10,
    updatedAt: 1_000,
    main: {
      applied: { ...appliedMainV2, monthlyNetIncomeWon: 6_000_000, updatedAt: 1_000 },
      setupProgress: null,
    },
  };
  const mutatedRaw = JSON.stringify(mutatedWorkspace);
  await page.evaluate((raw) => {
    localStorage.setItem('isf-workspace-v1', raw);
    (window as typeof window & { __workspaceWrites: number }).__workspaceWrites = 0;
  }, mutatedRaw);
  await page.reload();
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('370만 원');

  await trigger.click();
  const input = page.getByLabel('백업 가져오기');
  await expect(input).toHaveAttribute('type', 'file');
  await input.focus();
  await expect(input.locator('..')).toHaveCSS('box-shadow', /rgba?\(/);
  await input.setInputFiles({
    name: 'workspace-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(exportedText),
  });
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: '모든 앱 데이터를 이 백업으로 바꿀까요?' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  const containment = await dialog.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.left >= 0
      && bounds.top >= 0
      && bounds.right <= window.innerWidth
      && bounds.bottom <= window.innerHeight
      && document.documentElement.scrollWidth <= window.innerWidth;
  });
  expect(containment).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v1'))).toBe(mutatedRaw);

  await dialog.getByRole('button', { name: '백업으로 바꾸기' }).click();

  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('90만 원');
  await expect(page.getByRole('status').filter({ hasText: '모든 앱 데이터를 백업에서 복원했습니다.' })).toBeVisible();
  await expect(trigger).toBeFocused();
  const durable = await page.evaluate(() => ({
    raw: localStorage.getItem('isf-workspace-v1'),
    old: Object.fromEntries(Object.keys(localStorage)
      .filter((key) => key !== 'isf-workspace-v1' && key.startsWith('isf-'))
      .map((key) => [key, localStorage.getItem(key)])),
    writes: (window as typeof window & { __workspaceWrites: number }).__workspaceWrites,
  }));
  const restored = JSON.parse(durable.raw!);
  expect(restored.revision).toBe(11);
  expect(restored.main).toEqual(releaseGateWorkspaceV2.main);
  expect(restored.simulation).toEqual(releaseGateWorkspaceV2.simulation);
  expect(restored.portfolio).toEqual(releaseGateWorkspaceV2.portfolio);
  expect(restored.locations).toEqual(releaseGateWorkspaceV2.locations);
  expect(restored.accountMap).toEqual(releaseGateWorkspaceV2.accountMap);
  expect(durable.writes).toBe(1);
  expect(durable.old).toEqual(seededOldMainRecords);
});

for (const restoreCase of [
  {
    name: 'empty Main',
    main: { applied: null, setupProgress: null },
    heading: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.',
  },
  {
    name: 'initial setup progress',
    main: {
      applied: null,
      setupProgress: {
        kind: 'initial' as const,
        step: 'housing' as const,
        draft: { ...appliedMainV2, updatedAt: 101 },
        savedAt: 600,
      },
    },
    heading: '주거비로 매달 얼마가 나가나요?',
  },
  {
    name: 'restart setup progress',
    main: {
      applied: appliedMainV2,
      setupProgress: {
        kind: 'restart' as const,
        step: 'living' as const,
        draft: { ...appliedMainV2, monthlyLivingWon: 1_100_000, updatedAt: 101 },
        savedAt: 600,
      },
    },
    heading: '그 밖의 생활비는 보통 얼마인가요?',
  },
] as const) {
  test(`canonical backup restores ${restoreCase.name} with persistent status and setup focus`, async ({ page }) => {
    const importedWorkspace = { ...connectedWorkspaceV1, main: restoreCase.main };
    await page.addInitScript((workspace) => {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    }, connectedWorkspaceV1);
    await page.goto('apps/main/');

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    await page.getByLabel('백업 가져오기').setInputFiles({
      name: `${restoreCase.name.replaceAll(' ', '-')}.json`,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'isf-workspace-backup',
        formatVersion: 1,
        exportedAt: 900,
        workspace: importedWorkspace,
      })),
    });
    await page.getByRole('dialog').getByRole('button', { name: '백업으로 바꾸기' }).click();

    const heading = page.getByRole('heading', { name: restoreCase.heading });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(page.getByTestId('workspace-backup-status')).toContainText('모든 앱 데이터를 백업에서 복원했습니다.');
    await expect(page.getByRole('status').filter({ hasText: '모든 앱 데이터를 백업에서 복원했습니다.' })).toBeVisible();
    await expect(page.getByRole('button', { name: '관리 메뉴' })).toHaveCount(0);

    await expect.poll(() => page.evaluate(() => {
      const raw = localStorage.getItem('isf-workspace-v1');
      if (raw === null) return null;
      const workspace = JSON.parse(raw);
      return {
        revision: workspace.revision,
        main: workspace.main,
        simulation: workspace.simulation,
        portfolio: workspace.portfolio,
        locations: workspace.locations,
        accountMap: workspace.accountMap,
      };
    })).toEqual({
      revision: 8,
      main: importedWorkspace.main,
      simulation: importedWorkspace.simulation,
      portfolio: importedWorkspace.portfolio,
      locations: importedWorkspace.locations,
      accountMap: emptyAccountMapV2,
    });
  });
}

test('invalid, old, reference, duplicate, and capacity backups retain the exact raw workspace', async ({ page }) => {
  await page.addInitScript(({ workspace, oldRecords }) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    for (const [key, raw] of Object.entries(oldRecords)) localStorage.setItem(key, raw);
  }, { workspace: connectedWorkspaceV1, oldRecords: seededOldMainRecords });
  await page.goto('apps/main/');
  const raw = JSON.stringify(connectedWorkspaceV1);
  const trigger = page.getByRole('button', { name: '관리 메뉴' });
  const referenceWorkspace = { ...connectedWorkspaceV1, locations: [] };
  const duplicateWorkspace = {
    ...connectedWorkspaceV1,
    locations: [
      ...connectedWorkspaceV1.locations,
      { ...connectedWorkspaceV1.locations[0], id: 'loc-duplicate', shortName: ' isa ' },
    ],
  };
  const capacityWorkspace = {
    ...connectedWorkspaceV1,
    locations: [
      ...connectedWorkspaceV1.locations,
      ...Array.from({ length: 11 }, (_, index) => ({
        id: `loc-income-${index}`,
        shortName: `L${index}`,
        kind: 'bank',
        roles: ['income'],
        createdAt: 10,
        updatedAt: 20,
      })),
    ],
  };
  const envelope = (workspace: unknown) => JSON.stringify({
    format: 'isf-workspace-backup',
    formatVersion: 1,
    exportedAt: 900,
    workspace,
  });
  const failures = [
    ['malformed.json', '{bad', '백업 JSON을 읽을 수 없습니다.'],
    ['old-main.json', JSON.stringify(appliedMainV2), '새 전체 workspace 백업 파일만 가져올 수 있습니다.'],
    ['schema.json', envelope({
      ...connectedWorkspaceV1,
      main: {
        applied: { ...appliedMainV2, monthlyNetIncomeWon: -1 },
        setupProgress: null,
      },
    }), '백업의 앱 데이터가 올바르지 않습니다.'],
    ['reference.json', envelope(referenceWorkspace), '백업의 앱 연결 정보가 올바르지 않습니다.'],
    ['duplicate.json', envelope(duplicateWorkspace), '백업의 앱 연결 정보가 올바르지 않습니다.'],
    ['capacity.json', envelope(capacityWorkspace), '백업의 앱 연결 정보가 올바르지 않습니다.'],
  ] as const;

  for (const [name, contents, expectedMessage] of failures) {
    await trigger.click();
    await page.getByLabel('백업 가져오기').setInputFiles({
      name,
      mimeType: 'application/json',
      buffer: Buffer.from(contents),
    });
    await expect(page.getByRole('alert')).toContainText(expectedMessage);
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => localStorage.getItem('isf-workspace-v1'))).toBe(raw);
    expect(await page.evaluate((keys) => Object.fromEntries(
      keys.map((key) => [key, localStorage.getItem(key)]),
    ), Object.keys(seededOldMainRecords))).toEqual(seededOldMainRecords);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
});

for (const invalidImport of [
  { name: 'future source timestamp', filename: 'future-source.json', workspace: invalidFutureSourceWorkspace },
  { name: 'synchronized custom-purpose excess', filename: 'synchronized-capacity.json', workspace: invalidSynchronizedCapacityWorkspace },
] as const) {
  test(`invalid ${invalidImport.name} import performs zero workspace writes and retains raw bytes`, async ({ page }) => {
    await page.addInitScript((workspace) => {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    }, connectedWorkspaceV1);
    await page.goto('apps/main/');
    const raw = JSON.stringify(connectedWorkspaceV1);
    await page.evaluate(() => {
      const originalSetItem = Storage.prototype.setItem;
      Object.defineProperty(window, '__invalidImportWrites', { configurable: true, value: 0, writable: true });
      Storage.prototype.setItem = function setItem(key: string, value: string) {
        if (key === 'isf-workspace-v1') {
          (window as typeof window & { __invalidImportWrites: number }).__invalidImportWrites += 1;
        }
        originalSetItem.call(this, key, value);
      };
    });

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    await page.getByLabel('백업 가져오기').setInputFiles({
      name: invalidImport.filename,
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        format: 'isf-workspace-backup',
        formatVersion: 1,
        exportedAt: 900,
        workspace: invalidImport.workspace,
      })),
    });

    await expect(page.getByRole('alert')).toContainText('백업의 앱 데이터가 올바르지 않습니다.');
    const result = await page.evaluate(() => ({
      raw: localStorage.getItem('isf-workspace-v1'),
      writes: (window as typeof window & { __invalidImportWrites: number }).__invalidImportWrites,
    }));
    expect(result.raw).toBe(raw);
    expect(result.writes).toBe(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
}

test('backup import has a matching accessible name and visible keyboard focus ring', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspaceV1);
  await page.goto('apps/main/');

  const trigger = page.getByRole('button', { name: '관리 메뉴' });
  await trigger.click();
  const input = page.getByLabel('백업 가져오기');
  await expect(input).toHaveAttribute('type', 'file');
  await input.focus();
  const label = input.locator('..');
  await expect(label).toHaveCSS('box-shadow', /rgba?\(/);
  await expect(page.getByLabel('JSON 백업 파일')).toHaveCount(0);
  await input.setInputFiles({
    name: 'main-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(appliedMainV2)),
  });
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('alert')).toContainText('새 전체 workspace 백업 파일만');
});

test('keyboard-only user completes the full quick setup', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');

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
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('90만 원');
});

test('interrupted setup reloads at housing with its v2 draft intact', async ({ page }) => {
  await clearBrowserStorage(page);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 실수령액').fill('3200000');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByLabel('월 주거 고정비').fill('800000');

  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-workspace-v1');
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
  await expect(page.getByRole('progressbar', { name: '수입 대비 현재 계획' })).toHaveAttribute('aria-valuetext', '현재 계획 80만 원 · 수입의 25.0%');
  await expect(page.getByText(/^월 수입 \d/)).toHaveCount(0);
});

test('dashboard edit persists only the v2 scalar plan', async ({ page }) => {
  await page.addInitScript((fixture) => {
    if (localStorage.getItem('isf-workspace-v1') === null) {
      localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
    }
  }, appliedWorkspaceV1);
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '월 소비 편집' }).click();
  await page.getByLabel('월평균 생활비').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('190만 원');
  await expect(page.getByRole('button', { name: '남는 돈 편집' })).toContainText('80만 원');

  await page.reload();

  await expect(page.getByRole('button', { name: '월 소비 편집' })).toContainText('190만 원');
  await expect.poll(() => page.evaluate(() => {
    const raw = localStorage.getItem('isf-workspace-v1');
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
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspaceV1);
  await page.goto('apps/main/');
  await page.clock.pauseAt(new Date('2026-08-12T00:01:00Z'));
  await page.getByText('자세히 보기', { exact: true }).click();

  await page.getByRole('button', { name: '월 투자 편집' }).click();
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
    localStorage.setItem('isf-workspace-v1', JSON.stringify(fixture));
  }, appliedWorkspaceV1);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '월 소비 편집' }).click();

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
