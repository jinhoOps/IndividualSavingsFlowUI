import { expect, test } from '@playwright/test';

const appliedMainV2 = {
  schemaVersion: 2,
  updatedAt: 1,
  monthlyNetIncomeWon: 4_200_000,
  monthlyHousingWon: 900_000,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 700_000,
  monthlyInvestmentWon: 500_000,
};

test('React Main ignores v1-only data and leaves every legacy store untouched', async ({ page }) => {
  const legacy = {
    mainV1: JSON.stringify({
      schemaVersion: 1,
      updatedAt: 9_999_999_999_999,
      incomes: [{ id: 'salary', amountWon: 4_200_000 }],
      accounts: [{ id: 'salary-account', name: '급여통장' }],
    }),
    rebuildV1: JSON.stringify({
      modelVersion: 10,
      updatedAt: 9_999_999_999_999,
      monthlyInvest: 900_000,
    }),
  };
  await page.addInitScript((raw) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-main-v1', raw.mainV1);
    localStorage.setItem('isf-rebuild-v1', raw.rebuildV1);
  }, legacy);

  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    mainV1: localStorage.getItem('isf-main-v1'),
    rebuildV1: localStorage.getItem('isf-rebuild-v1'),
    mainV2: localStorage.getItem('isf-main-v2'),
  }))).toEqual({ ...legacy, mainV2: null });
});

test('React Main workspace save leaves legacy adapter records untouched', async ({ page }) => {
  const legacy = {
    mainV2: JSON.stringify(appliedMainV2),
    mainV1: JSON.stringify({ schemaVersion: 1, updatedAt: 10 }),
    rebuildV1: JSON.stringify({ modelVersion: 10, updatedAt: 10, monthlyInvest: 123_000 }),
  };
  await page.addInitScript(({ workspace, raw }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    localStorage.setItem('isf-main-v2', raw.mainV2);
    localStorage.setItem('isf-main-v1', raw.mainV1);
    localStorage.setItem('isf-rebuild-v1', raw.rebuildV1);
  }, {
    workspace: {
      schemaVersion: 1,
      revision: 1,
      updatedAt: appliedMainV2.updatedAt,
      main: { applied: appliedMainV2, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    },
    raw: legacy,
  });
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '월 투자 편집' }).click();
  await page.getByLabel('월 투자액').fill('650000');
  await page.getByRole('button', { name: '적용' }).click();

  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1') ?? '{}');
    return {
      investmentWon: workspace.main?.applied?.monthlyInvestmentWon,
      mainV2: localStorage.getItem('isf-main-v2'),
      mainV1: localStorage.getItem('isf-main-v1'),
      rebuildV1: localStorage.getItem('isf-rebuild-v1'),
      accountMap: localStorage.getItem('isf-account-map-v1'),
    };
  })).toEqual({
    investmentWon: 650_000,
    ...legacy,
    accountMap: null,
  });
});

test('active sanitizer repair still feeds the account-free total-income Sankey topology', async ({ page }) => {
  await page.goto('apps/simulation/');
  const result = await page.evaluate(async () => {
    const [{ sanitizeInputs }, { buildMonthlySnapshot }, { buildSankeyData }] = await Promise.all([
      import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js'),
      import('/IndividualSavingsFlowUI/apps/main/modules/calculator.js'),
      import('/IndividualSavingsFlowUI/apps/main/modules/sankey-builder.js'),
    ]);
    const inputs = sanitizeInputs({
      modelVersion: 10,
      splitIncomeAccounts: false,
      incomes: [{
        id: 'main',
        name: '급여',
        amount: 3_000_000,
        accountId: 'missing-income',
        allocations: [{ accountId: 'missing-income', amount: 1_000_000 }],
      }],
      accounts: [],
      expenseItems: [{ id: 'rent', name: '월세', amount: 900_000, group: '고정비', accountId: 'missing-expense' }],
      savingsItems: [{ id: 'saving', name: '적금', amount: 300_000, group: '저축', accountId: 'missing-saving' }],
      investItems: [{ id: 'invest', name: 'ETF', amount: 200_000, group: '투자', accountId: 'missing-invest' }],
    });
    const snapshot = buildMonthlySnapshot(inputs);
    const sankey = buildSankeyData(snapshot, 'group', {
      expense: 'detail',
      savings: 'detail',
      invest: 'detail',
    });
    return {
      repaired: {
        income: inputs.incomes[0].accountId,
        allocations: inputs.incomes[0].allocations,
        expense: inputs.expenseItems[0].accountId,
        savings: inputs.savingsItems[0].accountId,
        invest: inputs.investItems[0].accountId,
        correctionTypes: inputs.accountCorrections.map((correction: { itemType: string }) => correction.itemType),
      },
      totalIncomeNode: sankey.nodes.find((node: { id: string }) => node.id === 'total-income'),
      incomeToTotal: sankey.links.some((link: { source: string; target: string }) =>
        link.source === 'income-main' && link.target === 'total-income'
      ),
      totalToExpense: sankey.links.some((link: { source: string; target: string }) =>
        link.source === 'total-income' && link.target === 'expense-rent'
      ),
      accountNodeIds: sankey.nodes
        .filter((node: { id: string }) => node.id.startsWith('acc-'))
        .map((node: { id: string }) => node.id),
    };
  });

  expect(result.repaired).toMatchObject({
    income: 'acc-salary',
    allocations: [{ accountId: 'acc-salary', amount: 3_000_000 }],
    expense: 'acc-living',
    savings: 'acc-salary',
    invest: 'acc-stock',
  });
  expect(result.repaired.correctionTypes).toEqual(expect.arrayContaining(['income', 'expense', 'savings', 'invest']));
  expect(result.totalIncomeNode).toMatchObject({ id: 'total-income', label: '총수입', tone: 'income' });
  expect(result.incomeToTotal).toBe(true);
  expect(result.totalToExpense).toBe(true);
  expect(result.accountNodeIds).toEqual([]);
});
