import { test, expect } from '@playwright/test';

const STEP1_SOURCE = {
  version: 2,
  updatedAt: Date.now(),
  incomes: [],
  expenseItems: [],
  savingsItems: [],
  investItems: [],
  horizonYears: 18,
  annualIncomeGrowth: 0,
  annualExpenseGrowth: 0,
  annualSavingsYield: 0,
  annualInvestReturn: 0,
  annualDebtInterest: 0,
  startCash: 0,
  startSavings: 0,
  startInvest: 25000000,
  startDebt: 0,
  monthlyExpense: 0,
  monthlySavings: 0,
  monthlyInvest: 1750000,
  monthlyDebtPayment: 0,
};

test.describe('Step 2 Phase 08 storage and import contracts', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((source) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('isf-step1-active', JSON.stringify(source));
      indexedDB.databases?.().then((databases) => {
        for (const database of databases) {
          if (database.name) indexedDB.deleteDatabase(database.name);
        }
      }).catch(() => {});
    }, STEP1_SOURCE);
  });

  test('Phase 08 Step 1 import keeps Step 2 edits local and reset re-imports the source', async ({ page }) => {
    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#totalMonthlyInvestCapacity');

    await expect(page.locator('.current-step-label')).toHaveText('전략 선택 가이드');
    await expect(page.locator('#choiceJudgment h1')).toContainText('월 현금흐름');
    await expect(page.locator('#importStep1DataPrimary')).toBeVisible();
    await expect(page.locator('#resetStep2Simulation')).toBeVisible();
    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('1,750,000');
    await expect(page.locator('#totalInitialAsset')).toHaveValue('25,000,000');
    await expect(page.locator('#simHorizonYears')).toHaveValue('18');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Main에서 연동된 값');
      await dialog.accept();
    });
    await page.locator('#totalMonthlyInvestCapacity').fill('2250000');
    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('2,250,000');
    await page.locator('#simHorizonYears').fill('7');
    await expect(page.locator('#simHorizonYears')).toHaveValue('7');

    const step1AfterEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-step1-active') || '{}'));
    expect(step1AfterEdit.monthlyInvest).toBe(1750000);
    expect(step1AfterEdit.startInvest).toBe(25000000);

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Step 1 원본값');
      await dialog.accept();
    });
    await page.locator('#resetStep2Simulation').click();

    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('1,750,000');
    await expect(page.locator('#totalInitialAsset')).toHaveValue('25,000,000');
    await expect(page.locator('#simHorizonYears')).toHaveValue('18');
  });

  test('Phase 08 storage falls back to LocalStorage for save list load and delete when the bridge fails', async ({ page }) => {
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#totalMonthlyInvestCapacity');

    const result = await page.evaluate(async () => {
      const [{ state }, { featureController }] = await Promise.all([
        import('/IndividualSavingsFlowUI/apps/simulation/modules/state.js'),
        import('/IndividualSavingsFlowUI/apps/simulation/modules/feature-controllers.js'),
      ]);

      const failingHub = {
        saveStep2Entry: async () => { throw new Error('IDB_BLOCKED_SAVE'); },
        listStep2Entries: async () => { throw new Error('IDB_BLOCKED_LIST'); },
        getStep2EntryById: async () => { throw new Error('IDB_BLOCKED_LOAD'); },
        deleteStep2Entry: async () => { throw new Error('IDB_BLOCKED_DELETE'); },
        triggerAutoBackup: async () => ({ created: false }),
      };
      window.IsfStorageHub = failingHub;
      window.IsfHubStorage = failingHub;

      state.draft.totalInitialAsset = 12300000;
      state.draft.totalMonthlyInvestCapacity = 890000;
      state.draft.dividendSim = {
        yield: 4.2,
        growth: 3.1,
        capitalGrowth: 5.5,
        years: 15,
        isDrip: false,
        presetName: 'SCHD 테스트',
      };
      state.currentSimulationId = '';

      await featureController.saveCurrent();
      const savedId = state.currentSimulationId;
      await featureController.refreshList();
      const listAfterSave = state.simulations.map((entry) => ({
        id: entry.id,
        name: entry.name,
        totalInitialAsset: entry.totalInitialAsset,
        totalMonthlyInvestCapacity: entry.totalMonthlyInvestCapacity,
        years: entry.dividendSim?.years,
      }));

      state.draft.totalInitialAsset = 1;
      state.draft.totalMonthlyInvestCapacity = 1;
      await featureController.loadById(savedId, { skipConfirm: true });
      const loadedDraft = {
        id: state.currentSimulationId,
        totalInitialAsset: state.draft.totalInitialAsset,
        totalMonthlyInvestCapacity: state.draft.totalMonthlyInvestCapacity,
        years: state.draft.dividendSim?.years,
        presetName: state.draft.dividendSim?.presetName,
      };

      await featureController.deleteById(savedId);
      await featureController.refreshList();

      return {
        savedId,
        listAfterSave,
        loadedDraft,
        listAfterDelete: state.simulations,
        fallbackRaw: localStorage.getItem('isf-step2-simulations-fallback-v1'),
      };
    });

    expect(dialogs).toEqual([]);
    expect(result.savedId).toMatch(/^ds-/);
    expect(result.listAfterSave).toHaveLength(1);
    expect(result.listAfterSave[0].id).toBe(result.savedId);
    expect(result.listAfterSave[0].name).toMatch(/SCHD|15년/);
    expect(result.listAfterSave[0].totalInitialAsset).toBe(12300000);
    expect(result.listAfterSave[0].totalMonthlyInvestCapacity).toBe(890000);
    expect(result.listAfterSave[0].years).toBe(15);
    expect(result.loadedDraft).toMatchObject({
      id: result.savedId,
      totalInitialAsset: 12300000,
      totalMonthlyInvestCapacity: 890000,
      years: 15,
      presetName: 'SCHD 테스트',
    });
    expect(result.listAfterDelete).toHaveLength(0);
    expect(result.fallbackRaw).toBe('[]');
  });
});

test.describe('Step 2 Phase 08 strategy comparison contracts', () => {
  test('Phase 08 strategy assumptions expose conservative groups benchmarks examples and ranges', async ({ page }) => {
    await page.goto('apps/simulation/index.html');

    const contract = await page.evaluate(async () => {
      const assumptions = await import('/IndividualSavingsFlowUI/apps/simulation/modules/assumptions.js');
      return {
        groups: assumptions.STRATEGY_GROUPS,
        benchmarkOptions: assumptions.getBenchmarkOptions(),
        dividendGrowthExamples: assumptions.getDividendGrowthExamples(),
        coveredCallExamples: assumptions.getCoveredCallExamples(),
        resolved: assumptions.getStrategyAssumptions({ benchmarkKey: 'sp500', coveredCallKey: 'divo' }),
      };
    });

    expect(contract.groups.map((group) => group.key)).toEqual([
      'indexGrowth',
      'dividendGrowth',
      'coveredCallMonthlyIncome',
    ]);
    expect(contract.benchmarkOptions.map((option) => option.label)).toEqual(
      expect.arrayContaining(['Nasdaq', 'S&P 500']),
    );
    expect(contract.benchmarkOptions.map((option) => option.evidenceKey)).toEqual(
      expect.arrayContaining(['qqq', 'spy']),
    );
    expect(contract.dividendGrowthExamples.map((example) => example.label)).toContain('SCHD');
    expect(contract.coveredCallExamples.map((example) => example.label)).toEqual(
      expect.arrayContaining(['JEPI', 'QQQI', 'DIVO']),
    );
    expect(contract.resolved.benchmark.label).toBe('S&P 500');
    expect(contract.resolved.coveredCall.label).toBe('DIVO');
    expect(contract.resolved.copy.disclaimer).toContain('보수 예시');

    const examplesByLabel = Object.fromEntries(
      contract.coveredCallExamples.map((example) => [example.label, example]),
    );

    expect(examplesByLabel.JEPI.defaults).toMatchObject({
      cashFlowYield: 8.0,
      distributionGrowth: 0.0,
      capitalGrowth: 3.0,
      isDrip: false,
    });
    expect(examplesByLabel.JEPI.displayRanges).toMatchObject({
      cashFlowYield: '7-9%',
      distributionGrowth: '측정 불가/변동',
      capitalGrowth: '2-4%',
    });

    expect(examplesByLabel.QQQI.defaults).toMatchObject({
      cashFlowYield: 11.5,
      distributionGrowth: 0.0,
      capitalGrowth: 6.5,
      isDrip: false,
    });
    expect(examplesByLabel.QQQI.displayRanges).toMatchObject({
      cashFlowYield: '11-12%',
      distributionGrowth: '측정 불가/변동',
      capitalGrowth: '5-8%',
    });

    expect(examplesByLabel.DIVO.defaults).toMatchObject({
      cashFlowYield: 4.75,
      distributionGrowth: 5.0,
      capitalGrowth: 6.0,
      isDrip: false,
    });
    expect(examplesByLabel.DIVO.displayRanges).toMatchObject({
      cashFlowYield: '4.5-5%',
      distributionGrowth: '4-6%',
      capitalGrowth: '5-7%',
    });

    for (const example of contract.coveredCallExamples) {
      expect(typeof example.defaults.cashFlowYield).toBe('number');
      expect(typeof example.defaults.distributionGrowth).toBe('number');
      expect(typeof example.defaults.capitalGrowth).toBe('number');
      expect(typeof example.displayRanges.cashFlowYield).toBe('string');
    }
  });

  test('Phase 08 strategy comparison returns Won asset paths cash flow and numeric percent values', async ({ page }) => {
    await page.goto('apps/simulation/index.html');

    const result = await page.evaluate(async () => {
      const { calculateStrategyComparison } = await import('/IndividualSavingsFlowUI/apps/simulation/modules/calculator.js');
      return calculateStrategyComparison({
        totalInitialAsset: 50000000,
        totalMonthlyInvestCapacity: 1000000,
        dividendSim: {
          years: 10,
          selectedBenchmark: 'sp500',
          coveredCallExample: 'qqqi',
          yield: 3.5,
          growth: 5.0,
          capitalGrowth: 4.0,
          isDrip: true,
        },
      });
    });

    expect(result.selectedBenchmark).toBe('sp500');
    expect(result.selectedCoveredCall).toBe('qqqi');
    expect(result.rows).toHaveLength(10);

    const first = result.rows[0];
    const final = result.final;
    expect(first.principal).toBe(62000000);
    expect(final.principal).toBe(170000000);

    for (const row of result.rows) {
      expect(Number.isInteger(row.principal)).toBe(true);
      expect(Object.keys(row.finalAssets)).toEqual(['index', 'schd', 'coveredCall']);
      expect(Object.keys(row.monthlyCashFlowAfterTax)).toEqual(['index', 'schd', 'coveredCall']);
      expect(Object.keys(row.benchmarkDelta)).toEqual(['index', 'schd', 'coveredCall']);
      expect(row.benchmarkDelta.index).toBe(0);
      expect(Number.isInteger(row.finalAssets.index)).toBe(true);
      expect(Number.isInteger(row.finalAssets.schd)).toBe(true);
      expect(Number.isInteger(row.finalAssets.coveredCall)).toBe(true);
      expect(Number.isInteger(row.monthlyCashFlowAfterTax.coveredCall)).toBe(true);
    }

    expect(final.strategies.index.label).toBe('S&P 500');
    expect(final.strategies.schd.label).toBe('SCHD');
    expect(final.strategies.coveredCall.label).toBe('QQQI');
    expect(final.finalAssets.index).toBeGreaterThan(final.finalAssets.coveredCall);
    expect(final.monthlyCashFlowAfterTax.coveredCall).toBeGreaterThan(final.monthlyCashFlowAfterTax.index);
    expect(final.benchmarkDelta.coveredCall).toBeLessThan(0);

    for (const strategy of Object.values(final.strategies)) {
      expect(typeof strategy.dividendYieldPercent).toBe('number');
      expect(typeof strategy.cashFlowYieldPercent).toBe('number');
      expect(typeof strategy.dividendGrowthPercent).toBe('number');
      expect(typeof strategy.capitalGrowthPercent).toBe('number');
      expect(Number.isInteger(strategy.finalAsset)).toBe(true);
      expect(Number.isInteger(strategy.monthlyCashFlowAfterTax)).toBe(true);
    }
  });

  test('Phase 08 strategy defaults remain editable numeric assumptions', async ({ page }) => {
    await page.goto('apps/simulation/index.html');

    const result = await page.evaluate(async () => {
      const { calculateStrategyComparison } = await import('/IndividualSavingsFlowUI/apps/simulation/modules/comparison-calculator.js');
      const draft = {
        totalInitialAsset: 30000000,
        totalMonthlyInvestCapacity: 700000,
        dividendSim: {
          years: 12,
          selectedBenchmark: 'nasdaq',
          coveredCallExample: 'jepi',
          yield: 3.5,
          growth: 5.0,
          capitalGrowth: 4.0,
          isDrip: true,
        },
      };
      const base = calculateStrategyComparison(draft);
      const edited = calculateStrategyComparison(draft, {
        coveredCallOverrides: {
          cashFlowYield: 6.0,
          distributionGrowth: 0.5,
          capitalGrowth: 2.5,
          isDrip: false,
        },
      });
      const selectedCoveredCallEdit = calculateStrategyComparison({
        ...draft,
        dividendSim: {
          ...draft.dividendSim,
          strategyKey: 'coveredCallMonthlyIncome',
          yield: 6.0,
          growth: 0.5,
          capitalGrowth: 2.5,
          isDrip: false,
        },
      });
      return {
        base: base.final.strategies.coveredCall,
        edited: edited.final.strategies.coveredCall,
        selectedCoveredCallEdit: selectedCoveredCallEdit.final.strategies.coveredCall,
        selectedCoveredCallSchd: selectedCoveredCallEdit.final.strategies.schd,
      };
    });

    expect(result.base.label).toBe('JEPI');
    expect(result.base.cashFlowYieldPercent).toBe(8.0);
    expect(result.base.distributionGrowthPercent).toBe(0.0);
    expect(result.base.capitalGrowthPercent).toBe(3.0);
    expect(result.base.displayRanges).toMatchObject({
      cashFlowYield: '7-9%',
      distributionGrowth: '측정 불가/변동',
      capitalGrowth: '2-4%',
    });

    expect(result.edited.cashFlowYieldPercent).toBe(6.0);
    expect(result.edited.distributionGrowthPercent).toBe(0.5);
    expect(result.edited.capitalGrowthPercent).toBe(2.5);
    expect(result.edited.monthlyCashFlowAfterTax).not.toBe(result.base.monthlyCashFlowAfterTax);
    expect(result.edited.finalAsset).not.toBe(result.base.finalAsset);
    expect(result.selectedCoveredCallEdit.cashFlowYieldPercent).toBe(6.0);
    expect(result.selectedCoveredCallEdit.distributionGrowthPercent).toBe(0.5);
    expect(result.selectedCoveredCallEdit.capitalGrowthPercent).toBe(2.5);
    expect(result.selectedCoveredCallSchd.cashFlowYieldPercent).toBe(3.5);
    expect(result.selectedCoveredCallSchd.capitalGrowthPercent).toBe(7.0);
  });
});

test.describe('Step 2 Phase 08 first-screen mobile UI flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((source) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('isf-step1-active', JSON.stringify(source));
    }, STEP1_SOURCE);
  });

  test('Phase 08 first screen preserves required order and KPI labels across desktop tablet and mobile', async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 820 },
      { width: 768, height: 920 },
      { width: 390, height: 900 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('apps/simulation/index.html');
      await page.waitForSelector('#strategyComparisonCards .comparison-card');

      const labels = await page.locator('#simKpiGrid .kpi-label').allTextContents();
      expect(labels.join(' / ')).toContain('최종 예상 자산');
      expect(labels.join(' / ')).toContain('예상 월 배당/현금흐름');
      expect(labels.join(' / ')).toContain('대비 차이');

      const order = await page.evaluate(() => {
        const ids = [
          'choiceJudgment',
          'primaryInputsPanel',
          'simKpiGrid',
          'simChartSvg',
          'strategyComparisonCards',
          'detailSection',
        ];
        return ids.map((id) => {
          const element = document.getElementById(id);
          return { id, top: element?.getBoundingClientRect().top ?? -1 };
        });
      });
      for (let i = 1; i < order.length; i += 1) {
        expect(order[i].top).toBeGreaterThan(order[i - 1].top);
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    }
  });

  test('Phase 08 warning uses only totalInitialAsset below 50M and not high monthly investment', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#dividendWarningBanner');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Main에서 연동된 값');
      await dialog.accept();
    });
    await page.locator('#totalInitialAsset').fill('49999999');
    await page.locator('#totalMonthlyInvestCapacity').fill('10000000');
    await expect(page.locator('#dividendWarningBanner')).toBeVisible();

    await page.locator('#totalInitialAsset').fill('50000000');
    await expect(page.locator('#dividendWarningBanner')).toBeHidden();
  });

  test('Phase 08 chart cards details and touch tooltip stay stable on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#simChartSvg polyline.strategy-line');

    const chartBox = await page.locator('#simChartSvg').boundingBox();
    expect(chartBox?.width || 0).toBeGreaterThan(240);
    expect(chartBox?.height || 0).toBeGreaterThan(90);
    await expect(page.locator('#simChartSvg text', { hasText: '지수/성장' })).toBeVisible();
    await expect(page.locator('#simChartSvg text', { hasText: 'SCHD' })).toBeVisible();
    await expect(page.locator('#simChartSvg text', { hasText: '커버드콜' })).toBeVisible();

    const firstKpiBefore = await page.locator('#simKpiGrid .kpi-value').first().textContent();
    const chartTopBefore = await page.locator('.sim-chart-wrap').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top + window.scrollY;
    });
    await page.locator('[data-strategy-card="coveredCallMonthlyIncome"]').click();
    const firstKpiAfter = await page.locator('#simKpiGrid .kpi-value').first().textContent();
    const chartTopAfter = await page.locator('.sim-chart-wrap').evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top + window.scrollY;
    });
    expect(firstKpiAfter).not.toBe(firstKpiBefore);
    expect(Math.abs(chartTopAfter - chartTopBefore)).toBeLessThan(32);

    await page.locator('#simChartSvg rect').nth(2).dispatchEvent('touchstart');
    await expect(page.locator('#simChartTooltip')).toBeVisible();
    await expect(page.locator('#simChartTooltip')).toContainText('월');

    await expect(page.locator('#detailSection')).not.toHaveAttribute('open', '');
    await page.locator('#detailSection summary').click();
    await expect(page.locator('#detailSection')).toHaveAttribute('open', '');
    const detailOverflow = await page.locator('#detailSection .table-wrap').evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(detailOverflow).toBe(true);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);

    await page.screenshot({ path: 'test-results/phase08-step2-mobile-390.png', fullPage: true });
  });

  test('Phase 08 tablet screenshot captures first-screen comparison flow', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 920 });
    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#strategyComparisonCards .comparison-card');
    await page.screenshot({ path: 'test-results/phase08-step2-mobile-768.png', fullPage: true });
  });

  test('Phase 08 DataHub save list load and delete works through visible controls with fallback status', async ({ page }) => {
    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'confirm') await dialog.accept();
      else await dialog.dismiss();
    });

    await page.goto('apps/simulation/index.html');
    await page.waitForSelector('#saveStep2Simulation');
    await page.evaluate(() => {
      const failingHub = {
        saveStep2Entry: async () => { throw new Error('IDB_BLOCKED_SAVE'); },
        listStep2Entries: async () => { throw new Error('IDB_BLOCKED_LIST'); },
        getStep2EntryById: async () => { throw new Error('IDB_BLOCKED_LOAD'); },
        deleteStep2Entry: async () => { throw new Error('IDB_BLOCKED_DELETE'); },
        triggerAutoBackup: async () => ({ created: false }),
      };
      window.IsfStorageHub = failingHub;
      window.IsfHubStorage = failingHub;
    });

    await page.locator('[data-strategy-card="coveredCallMonthlyIncome"]').click();
    await page.locator('#saveStep2Simulation').click();
    await expect(page.locator('#statusIndicator')).toContainText('임시 저장 모드로 저장됨');

    await page.locator('#appLauncherBtn').click();
    await page.locator('#headerDataHubBtn').click();
    await page.locator('data-hub-modal .tab-btn', { hasText: '시뮬레이션 목록' }).click();
    await expect(page.locator('data-hub-modal .simulation-name')).toContainText(/JEPI|커버드콜|월 현금흐름/);

    const savedName = await page.locator('data-hub-modal .simulation-name').first().textContent();
    await page.locator('#totalInitialAsset').fill('64000000');
    await page.locator('data-hub-modal .btn-select').first().click();
    await expect(page.locator('#totalInitialAsset')).not.toHaveValue('64,000,000');

    await page.locator('#appLauncherBtn').click();
    await page.locator('#headerDataHubBtn').click();
    await page.locator('data-hub-modal .tab-btn', { hasText: '시뮬레이션 목록' }).click();
    await expect(page.locator('data-hub-modal .simulation-name').first()).toHaveText(savedName || '');
    await page.locator('data-hub-modal .btn-delete').first().click();
    await expect(page.locator('data-hub-modal #tab-simulations .empty')).toContainText('저장된 시뮬레이션이 없습니다.');
  });
});
