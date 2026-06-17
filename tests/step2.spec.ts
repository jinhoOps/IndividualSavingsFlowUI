import { test, expect } from '@playwright/test';

const STEP1_SOURCE = {
  version: 2,
  updatedAt: Date.now(),
  incomes: [],
  expenseItems: [],
  savingsItems: [],
  investItems: [],
  horizonYears: 10,
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

    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('1750000');
    await expect(page.locator('#totalInitialAsset')).toHaveValue('25000000');

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Main에서 연동된 값');
      await dialog.accept();
    });
    await page.locator('#totalMonthlyInvestCapacity').fill('2250000');
    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('2250000');

    const step1AfterEdit = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-step1-active') || '{}'));
    expect(step1AfterEdit.monthlyInvest).toBe(1750000);
    expect(step1AfterEdit.startInvest).toBe(25000000);

    await page.evaluate(async () => {
      const { featureController } = await import('/IndividualSavingsFlowUI/apps/simulation/modules/feature-controllers.js');
      await featureController.reset();
    });

    await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('1750000');
    await expect(page.locator('#totalInitialAsset')).toHaveValue('25000000');
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
