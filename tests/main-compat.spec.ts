import { expect, test, type Page } from '@playwright/test';

const currentMain = {
  schemaVersion: 1,
  updatedAt: 1,
  incomes: [{ id: 'salary', name: '급여', amountWon: 4_200_000, allocations: [{ accountId: 'salary-account', amountWon: 4_200_000 }] }],
  expenses: [{ id: 'living', name: '생활비', amountWon: 1_800_000, accountId: 'salary-account' }],
  savings: [{ id: 'deposit', name: '적금', amountWon: 700_000, accountId: 'salary-account' }],
  investments: [{ id: 'etf', name: 'ETF', amountWon: 500_000, accountId: 'salary-account' }],
  accounts: [{ id: 'salary-account', name: '급여통장', kind: 'income' }],
};

const metadataLegacyMain = {
  modelVersion: 10,
  version: 2,
  updatedAt: 1,
  accounts: [
    { id: 'acc-salary', name: '급여계좌', type: 'income', bankCode: 'BANK-A' },
    { id: 'acc-living', name: '생활비계좌', type: 'spending', color: '#0f766e' },
  ],
  splitIncomeAccounts: false,
  surplusTransferAccountId: 'acc-salary',
  incomes: [{
    id: 'salary',
    name: '급여',
    amount: 4_200_000,
    accountId: 'acc-salary',
    allocations: [{ accountId: 'acc-salary', amount: 4_200_000 }],
  }],
  expenseItems: [{
    id: 'rent',
    name: '월세',
    amount: 900_000,
    group: '고정비',
    accountId: 'acc-living',
    paymentDay: '25일',
    memo: '임대인 자동이체',
  }],
  savingsItems: [],
  investItems: [],
  transfers: [{
    id: 'transfer-living',
    sourceAccountId: 'acc-salary',
    targetAccountId: 'acc-living',
    amount: 500_000,
    label: '생활비 자동이체',
    paymentDay: '2일',
    memo: '월급 다음날',
    transferMeta: { schedule: 'monthly' },
  }],
  relationships: [{
    id: 'rel-candidate-rent',
    type: 'utility-payment',
    sourceAccountId: 'acc-living',
    targetAccountId: 'merchant-rent',
    label: '월세',
    amount: 900_000,
    paymentDay: '25일',
    memo: '관계 메모',
    confidence: 'confirmed',
    sourceRef: { collection: 'expenseItems', id: 'rent' },
    relationshipMeta: { lane: 'external', order: 2 },
  }],
  monthlyExpense: 900_000,
  monthlySavings: 0,
  monthlyInvest: 0,
};

async function saveReactMain(page: Page, investmentWon = 600_000) {
  await page.addInitScript((data) => {
    if (localStorage.getItem('isf-main-v1') === null) {
      localStorage.setItem('isf-main-v1', JSON.stringify(data));
    }
  }, currentMain);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '투자 편집' }).click();
  await page.getByLabel('ETF 월 금액').fill(String(investmentWon));
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('status')).toHaveText('저장됨');
}

test('React Main save feeds the Simulation connector', async ({ page }) => {
  await saveReactMain(page, 610_000);

  await page.goto('apps/simulation/');

  await expect(page.locator('#totalMonthlyInvestCapacity')).toHaveValue('610,000');
});

test('React Main save feeds the Portfolio connector', async ({ page }) => {
  await saveReactMain(page, 620_000);
  await page.goto('apps/portfolio/');

  const source = await page.evaluate(async () => {
    const { Step1Connector } = await import('/IndividualSavingsFlowUI/apps/portfolio/modules/step1-connector.js');
    return Step1Connector.fetchLatestSnapshot();
  });

  expect(source).toEqual({ investCapacity: 620_000 });
});

test('React Main save feeds the Account Map connector', async ({ page }) => {
  await saveReactMain(page, 630_000);
  await page.goto('apps/account-map/');
  await page.locator('#importMainData').click();

  await expect(page.locator('#accountMapSummary')).toContainText('1개 계좌');
  const imported = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-account-map-v1') ?? '{}'));
  expect(imported).toMatchObject({
    source: { type: 'main', storageKey: 'isf-rebuild-v1' },
    accounts: [{ id: 'salary-account', name: '급여통장' }],
  });
  expect(imported.relationships).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'income-deposit', amount: 4_200_000 }),
    expect.objectContaining({ type: 'investment-transfer', amount: 630_000 }),
  ]));
});

test('React Main preserves arbitrary account roles through the Account Map connector', async ({ page }) => {
  await page.addInitScript((data) => {
    if (sessionStorage.getItem('__arbitraryRoleCompatSeeded') === '1') return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-main-v1', JSON.stringify(data));
    sessionStorage.setItem('__arbitraryRoleCompatSeeded', '1');
  }, {
    schemaVersion: 1,
    updatedAt: 1,
    incomes: [{
      id: 'salary',
      name: '급여',
      amountWon: 4_200_000,
      accountId: 'paycheck-wallet',
      allocations: [{ accountId: 'paycheck-wallet', amountWon: 4_200_000 }],
    }],
    expenses: [],
    savings: [],
    investments: [{ id: 'etf', name: 'ETF', amountWon: 500_000, accountId: 'brokerage-wallet' }],
    accounts: [
      { id: 'paycheck-wallet', name: '급여 지갑', kind: 'income' },
      { id: 'brokerage-wallet', name: '증권 지갑', kind: 'investment' },
    ],
  });
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '투자 편집' }).click();
  await page.getByLabel('ETF 월 금액').fill('600000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('status')).toHaveText('저장됨');

  await page.goto('apps/account-map/');
  await page.locator('#importMainData').click();

  await expect(page.locator('#accountMapSummary')).toContainText('2개 계좌');
  const accounts = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-account-map-v1') ?? '{}').accounts);
  expect(accounts).toEqual([
    expect.objectContaining({ id: 'paycheck-wallet', role: 'income' }),
    expect.objectContaining({ id: 'brokerage-wallet', role: 'investment' }),
  ]);
});

test('active legacy sanitizer accepts the React compatibility projection without unit inflation', async ({ page }) => {
  await saveReactMain(page, 640_000);
  await page.goto('apps/simulation/');

  const sanitized = await page.evaluate(async () => {
    const projection = JSON.parse(localStorage.getItem('isf-rebuild-v1') ?? '{}');
    const { sanitizeInputs } = await import('/IndividualSavingsFlowUI/apps/main/modules/input-sanitizer.js');
    return sanitizeInputs(projection);
  });

  expect(sanitized).toMatchObject({
    modelVersion: 10,
    monthlyExpense: 1_800_000,
    monthlySavings: 700_000,
    monthlyInvest: 640_000,
  });
  expect(sanitized.incomes[0].amount).toBe(4_200_000);
});

test('legacy metadata survives a React edit through the Account Map import envelope', async ({ page }) => {
  await page.addInitScript((legacy) => {
    if (sessionStorage.getItem('__mainCompatMetadataSeeded') === '1') return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-rebuild-v1', JSON.stringify(legacy));
    sessionStorage.setItem('__mainCompatMetadataSeeded', '1');
  }, metadataLegacyMain);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '생활비 편집' }).click();
  await page.getByLabel('월세 월 금액').fill('1100000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('status')).toHaveText('저장됨');
  const projection = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-rebuild-v1') ?? '{}'));
  expect(projection.expenseItems).toEqual([
    expect.objectContaining({
      id: 'rent',
      amount: 1_100_000,
      paymentDay: '25일',
      memo: '임대인 자동이체',
    }),
  ]);

  await page.goto('apps/account-map/');
  const envelope = await page.evaluate(async () => {
    const { resolveLatestMainInputs } = await import('/IndividualSavingsFlowUI/apps/account-map/modules/step1-connector.js');
    return resolveLatestMainInputs();
  });
  expect(envelope?.data.accounts).toEqual([
    expect.objectContaining({ id: 'acc-salary', bankCode: 'BANK-A' }),
    expect.objectContaining({ id: 'acc-living', color: '#0f766e' }),
  ]);
  expect(envelope?.data.expenseItems).toEqual([
    expect.objectContaining({
      id: 'rent',
      amount: 1_100_000,
      paymentDay: '25일',
      memo: '임대인 자동이체',
    }),
  ]);
  expect(envelope?.data.transfers).toEqual([
    expect.objectContaining({
      id: 'transfer-living',
      paymentDay: '2일',
      memo: '월급 다음날',
      transferMeta: { schedule: 'monthly' },
    }),
  ]);
  expect(envelope?.data.relationships).toEqual([
    expect.objectContaining({
      id: 'rel-candidate-rent',
      relationshipMeta: { lane: 'external', order: 2 },
    }),
  ]);

  await page.locator('#importMainData').click();
  await expect(page.locator('#accountMapSummary')).toContainText('2개 계좌');
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-account-map-v1') ?? '{}'));
  expect(draft.accounts).toEqual([
    expect.objectContaining({ id: 'acc-salary', bankCode: 'BANK-A' }),
    expect.objectContaining({ id: 'acc-living', color: '#0f766e' }),
  ]);
  expect(draft.relationships).toEqual(expect.arrayContaining([
    expect.objectContaining({
      id: 'rel-transfer-transfer-living',
      amount: 500_000,
      paymentDay: '2일',
      memo: '월급 다음날',
    }),
    expect.objectContaining({
      id: 'rel-candidate-rent',
      amount: 1_100_000,
      paymentDay: '25일',
      memo: '관계 메모',
      relationshipMeta: { lane: 'external', order: 2 },
    }),
  ]));
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
