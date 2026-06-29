// @ts-nocheck
import { test, expect } from '@playwright/test';

const MAIN_STORAGE_KEY = 'isf-rebuild-v1';
const ACCOUNT_MAP_STORAGE_KEY = 'isf-account-map-v1';

function createSeedMainInputs() {
  return {
    modelVersion: 10,
    accounts: [
      { id: 'acc-salary', name: '급여계좌' },
      { id: 'acc-living', name: '생활비계좌' },
      { id: 'acc-stock', name: '투자계좌' },
      { id: 'acc-cma', name: 'CMA' },
    ],
    incomes: [
      {
        id: 'income-main',
        name: '급여',
        amount: 4000000,
        accountId: 'acc-salary',
        allocations: [
          { accountId: 'acc-salary', amount: 1200000 },
          { accountId: 'acc-living', amount: 1800000 },
          { accountId: 'acc-stock', amount: 1000000 },
        ],
      },
      {
        id: 'income-side',
        name: '부수입',
        amount: 300000,
        accountId: 'acc-cma',
      },
    ],
    transfers: [
      { id: 'transfer-living', sourceAccountId: 'acc-salary', targetAccountId: 'acc-living', amount: 500000, label: '생활비 자동이체' },
    ],
    expenseItems: [
      { id: 'telecom', name: '통신비', amount: 60000, group: '생활비-고정비-통신비', accountId: 'acc-living' },
      { id: 'insurance', name: '보험료', amount: 120000, group: '생활비-고정비-보험', accountId: 'acc-living' },
      { id: 'food', name: '식비', amount: 500000, group: '변동비', accountId: 'acc-living', actualSpent: 100000 },
      { id: 'travel', name: '여행', amount: 200000, group: '자유소비-여행', accountId: 'acc-living' },
    ],
    savingsItems: [
      { id: 'saving-youth', name: '청년적금', amount: 300000, group: '저축', annualRate: 3.2, accountId: 'acc-salary' },
    ],
    investItems: [
      { id: 'invest-isa', name: 'ISA', amount: 400000, group: '투자', accountId: 'acc-stock' },
    ],
    monthlyExpense: 880000,
    monthlySavings: 300000,
    monthlyInvest: 400000,
    surplusTransferAccountId: 'acc-stock',
  };
}

test.describe('Account Map route and draft import', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seed) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('isf-rebuild-v1', JSON.stringify(seed));
    }, createSeedMainInputs());
  });

  test('loads as a dedicated route and imports a page-owned draft from Main data', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto('apps/account-map/index.html');
    await expect(page.locator('app-header')).toContainText('Account Map');
    await expect(page.locator('#accountMapTitle')).toContainText('계좌 흐름 맵');
    await page.locator('#importMainData').click();

    await expect(page.locator('#accountMapSummary')).toContainText('4개 계좌');
    await expect(page.locator('#accountMapSummary')).toContainText('6개 관계');
    await expect(page.locator('#accountMapCandidates')).toContainText('통신비');
    await expect(page.locator('#accountMapCandidates')).toContainText('추천');
    await expect(page.locator('#accountMapCanvas')).toContainText('급여계좌');

    const persisted = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), ACCOUNT_MAP_STORAGE_KEY);
    expect(persisted.source).toMatchObject({ type: 'main', storageKey: MAIN_STORAGE_KEY });
    expect(persisted.accounts.map((account: { id: string }) => account.id)).toEqual(['acc-salary', 'acc-living', 'acc-stock', 'acc-cma']);
    expect(persisted.relationships.map((relationship: { type: string }) => relationship.type)).toEqual(expect.arrayContaining([
      'income-deposit',
      'auto-transfer',
      'savings-transfer',
      'investment-transfer',
    ]));
    expect(persisted.relationships.some((relationship: { sourceRef: { collection: string; id: string } }) =>
      relationship.sourceRef.collection === 'expenseItems' && relationship.sourceRef.id === 'food'
    )).toBe(false);
    expect(errors).toEqual([]);
  });

  test('buildAccountMapDraftFromMain derives relationship scope without mutating Main data', async ({ page }) => {
    await page.goto('apps/account-map/index.html');

    const result = await page.evaluate(async (seed) => {
      const { buildAccountMapDraftFromMain } = await import('/IndividualSavingsFlowUI/apps/account-map/modules/draft-builder.js');
      const draft = buildAccountMapDraftFromMain(seed);
      const savedMain = JSON.parse(localStorage.getItem('isf-rebuild-v1') || '{}');
      return { draft, savedMain };
    }, createSeedMainInputs());

    expect(result.draft.accounts).toHaveLength(4);
    expect(result.draft.relationships.filter((relationship: { type: string }) => relationship.type === 'income-deposit')).toHaveLength(4);
    expect(result.draft.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'rel-transfer-transfer-living',
        type: 'auto-transfer',
        sourceAccountId: 'acc-salary',
        targetAccountId: 'acc-living',
        confidence: 'confirmed',
        sourceRef: { collection: 'transfers', id: 'transfer-living' },
      }),
      expect.objectContaining({
        id: 'rel-savings-saving-youth',
        type: 'savings-transfer',
        sourceAccountId: 'acc-salary',
        confidence: 'recommended',
      }),
      expect.objectContaining({
        id: 'rel-invest-invest-isa',
        type: 'investment-transfer',
        sourceAccountId: 'acc-stock',
      }),
    ]));
    expect(result.draft.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'candidate-expense-telecom', label: '통신비', recommended: true }),
      expect.objectContaining({ id: 'candidate-expense-insurance', label: '보험료', recommended: true }),
    ]));
    expect(result.draft.relationships.map((relationship: { sourceRef: { id: string } }) => relationship.sourceRef?.id)).not.toContain('food');
    expect(result.draft.relationships.map((relationship: { sourceRef: { id: string } }) => relationship.sourceRef?.id)).not.toContain('travel');
    expect(result.savedMain).toEqual(createSeedMainInputs());
  });
});
