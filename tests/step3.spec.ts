// @ts-nocheck
import { test, expect } from '@playwright/test';

const STEP1_WITH_ACCOUNT_FLOW_HANDOFF = {
  modelVersion: 10,
  incomes: [
    { id: 'income-salary', name: '월급', amount: 5000000 },
  ],
  expenseItems: [
    { id: 'expense-living', name: '생활비', amount: 1800000, group: 'fixed' },
  ],
  savingsItems: [
    { id: 'savings-home', name: '주택자금', amount: 900000 },
  ],
  investItems: [
    { id: 'invest-etf', name: 'ETF', amount: 800000 },
  ],
  monthlyExpense: 1800000,
  monthlySavings: 900000,
  monthlyInvest: 800000,
  accountFlowHandoff: {
    accounts: [
      { id: 'account-salary', name: '급여계좌', type: 'checking' },
      { id: 'account-living', name: '생활비계좌', type: 'checking' },
      { id: 'account-invest', name: '투자계좌', type: 'investment' },
    ],
    incomeAllocations: [
      {
        incomeId: 'income-salary',
        incomeName: '월급',
        allocations: [
          { accountId: 'account-salary', amount: 5000000 },
        ],
      },
    ],
    itemAccounts: [
      { itemId: 'expense-living', itemName: '생활비', category: 'expense', accountId: 'account-living' },
      { itemId: 'invest-etf', itemName: 'ETF', category: 'invest', accountId: 'account-invest' },
    ],
    transfers: [
      { fromAccountId: 'account-salary', toAccountId: 'account-invest', amount: 800000, memo: 'ETF 적립' },
    ],
    splitIncomeAccounts: true,
    surplusTransferAccountId: 'account-salary',
  },
};

const STEP1_WITHOUT_HANDOFF = {
  modelVersion: 10,
  incomes: [{ id: 'income-side', name: '부수입', amount: 1200000 }],
  expenseItems: [],
  savingsItems: [],
  investItems: [{ id: 'invest-small', name: '소액투자', amount: 200000 }],
  monthlyExpense: 0,
  monthlySavings: 0,
  monthlyInvest: 200000,
};

async function seedStep1LocalSnapshot(page, snapshot) {
  await page.addInitScript((source) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-step1-active', JSON.stringify(source));
    indexedDB.databases?.().then((databases) => {
      for (const database of databases) {
        if (database.name) indexedDB.deleteDatabase(database.name);
      }
    }).catch(() => {});
  }, snapshot);
}

test.describe('Step 3 Phase 10.7 Portfolio account-flow handoff boundary', () => {
  test('detects Step 1 accountFlowHandoff sidecar without rehydrating Step 1 primary account fields', async ({ page }) => {
    await seedStep1LocalSnapshot(page, STEP1_WITH_ACCOUNT_FLOW_HANDOFF);
    await page.goto('apps/portfolio/index.html');
    await page.waitForSelector('main');

    const connectorResult = await page.evaluate(async () => {
      const { Step1Connector } = await import('/IndividualSavingsFlowUI/apps/portfolio/modules/step1-connector.js');
      return Step1Connector.fetchAccountFlowHandoff();
    });

    expect(connectorResult).toMatchObject({
      available: true,
      counts: {
        accounts: 3,
        incomeAllocations: 1,
        itemAccounts: 2,
        transfers: 1,
      },
      labels: expect.arrayContaining(['급여계좌', '생활비계좌', '투자계좌']),
    });

    const status = page.locator('[data-account-flow-handoff-status]');
    await expect(status).toBeVisible();
    await expect(status).toContainText('계좌흐름도 데이터');
    await expect(status).toContainText('계좌 3개');
    await expect(status).toContainText('이체 1개');
    await expect(status).toContainText('Portfolio에서 관리');

    const sourceAfterPortfolioVisit = await page.evaluate(() => JSON.parse(localStorage.getItem('isf-step1-active') || '{}'));
    expect(sourceAfterPortfolioVisit.accounts).toBeUndefined();
    expect(sourceAfterPortfolioVisit.transfers).toBeUndefined();
    expect(sourceAfterPortfolioVisit.splitIncomeAccounts).toBeUndefined();
    expect(sourceAfterPortfolioVisit.incomes[0].allocations).toBeUndefined();
    expect(sourceAfterPortfolioVisit.expenseItems[0].accountId).toBeUndefined();
    expect(sourceAfterPortfolioVisit.accountFlowHandoff.accounts).toHaveLength(3);
  });

  test('reports an empty Portfolio handoff state when Step 1 has no sidecar', async ({ page }) => {
    await seedStep1LocalSnapshot(page, STEP1_WITHOUT_HANDOFF);
    await page.goto('apps/portfolio/index.html');
    await page.waitForSelector('main');

    const connectorResult = await page.evaluate(async () => {
      const { Step1Connector } = await import('/IndividualSavingsFlowUI/apps/portfolio/modules/step1-connector.js');
      return Step1Connector.fetchAccountFlowHandoff();
    });

    expect(connectorResult).toMatchObject({
      available: false,
      counts: {
        accounts: 0,
        incomeAllocations: 0,
        itemAccounts: 0,
        transfers: 0,
      },
      labels: [],
    });

    const status = page.locator('[data-account-flow-handoff-status]');
    await expect(status).toBeVisible();
    await expect(status).toContainText('연결된 계좌흐름도 데이터가 없습니다');
  });
});
