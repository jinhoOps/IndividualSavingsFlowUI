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
