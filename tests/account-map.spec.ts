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
    splitIncomeAccounts: true,
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

function createUnsafeMainInputs() {
  const seed = createSeedMainInputs();
  seed.accounts[0] = { id: 'acc-unsafe"><img src=x onerror=alert(1)>', name: '<img src=x onerror=alert(1)>급여' };
  seed.incomes[0].allocations = [{ accountId: seed.accounts[0].id, amount: 4000000 }];
  seed.incomes[0].name = '<script>income()</script>';
  seed.transfers[0] = {
    id: 'transfer-unsafe"><svg onload=alert(1)>',
    sourceAccountId: seed.accounts[0].id,
    targetAccountId: 'acc-living',
    amount: 500000,
    label: '<b>생활비 자동이체</b>',
  };
  seed.expenseItems[0] = {
    id: 'telecom"><img src=x onerror=alert(1)>',
    name: '<u>통신비</u>',
    amount: 60000,
    group: '생활비-고정비-통신비',
    accountId: 'acc-living',
    paymentDay: '<img src=x onerror=alert(1)>25일',
    memo: '<script>memo()</script>',
  };
  return seed;
}

test.describe('Account Map route and draft import', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript((seed) => {
      if (sessionStorage.getItem('__accountMapSeeded') === '1') return;
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('isf-rebuild-v1', JSON.stringify(seed));
      sessionStorage.setItem('__accountMapSeeded', '1');
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
    await expect(page.locator('#accountMapSummary')).toContainText('7개 관계');
    await expect(page.locator('#accountMapCandidates')).toContainText('통신비');
    await expect(page.locator('#accountMapCandidates')).toContainText('추천');
    await expect(page.locator('#accountMapCanvas svg.account-map-svg')).toBeVisible();
    await expect(page.locator('[data-account-map-select="account"][data-account-id="acc-salary"]')).toBeVisible();
    await expect(page.locator('.account-map-svg__edge-chip[data-relationship-id="rel-transfer-transfer-living"]')).toBeVisible();
    await expect(page.locator('#accountMapCanvas')).toContainText('transfer');
    await expect(page.locator('#accountMapCanvas')).not.toContainText('500,000');
    await expect(page.locator('#accountMapCanvas')).not.toContainText('500000');
    await expect(page.locator('#accountMapCanvas [role="tab"], #accountMapCanvas button')).toHaveCount(0);
    await expect(page.locator('#accountMapCanvas')).not.toContainText(/필터|전체|이체만|카드만/);
    const nodeColors = await page.locator('[data-account-map-select="account"][data-account-id="acc-salary"]').evaluate((node) => {
      const rect = node.querySelector('rect');
      const text = node.querySelector('text');
      return {
        fill: rect?.getAttribute('fill') || window.getComputedStyle(rect as Element).fill,
        stroke: rect?.getAttribute('stroke') || window.getComputedStyle(rect as Element).stroke,
        textFill: text?.getAttribute('fill') || window.getComputedStyle(text as Element).fill,
      };
    });
    expect(nodeColors.fill).not.toMatch(/^(#000|#000000|black|rgb\(0,\s*0,\s*0\))$/i);
    expect(nodeColors.stroke).not.toMatch(/^(#000|#000000|black|rgb\(0,\s*0,\s*0\))$/i);
    expect(nodeColors.textFill).toBe('#102220');

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

  test('stays independent from Portfolio modules on the Account Map route', async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on('request', (request) => requestedUrls.push(request.url()));

    await page.goto('apps/account-map/index.html');
    await expect(page.locator('app-header')).toContainText('Account Map');

    expect(requestedUrls.some((url) => url.includes('/apps/portfolio/app.js'))).toBe(false);
    expect(requestedUrls.some((url) => url.includes('/src/entries/step3.ts'))).toBe(false);
    expect(requestedUrls.some((url) => url.includes('/src/entries/account-map.ts'))).toBe(true);
  });

  test('reveals exact relationship details only after selection and saves relationship edits locally', async ({ page }) => {
    await page.goto('apps/account-map/index.html');
    await page.locator('#importMainData').click();

    await expect(page.locator('#accountMapDetail')).not.toContainText('500,000원');
    await page.locator('.account-map-svg__edge-chip[data-relationship-id="rel-transfer-transfer-living"]').click();

    await expect(page.locator('#accountMapDetail')).toContainText('생활비 자동이체');
    await expect(page.locator('#accountMapDetail')).toContainText('500,000원');
    await page.locator('[data-relationship-field="paymentDay"]').fill('25일');
    await page.locator('[data-relationship-field="memo"]').fill('월급 다음날 이체');

    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) || '{}'), ACCOUNT_MAP_STORAGE_KEY);
    const edited = saved.relationships.find((relationship: { id: string }) => relationship.id === 'rel-transfer-transfer-living');
    expect(edited).toMatchObject({ paymentDay: '25일', memo: '월급 다음날 이체' });

    await page.reload();
    await page.locator('.account-map-svg__edge-chip[data-relationship-id="rel-transfer-transfer-living"]').click();
    await expect(page.locator('[data-relationship-field="paymentDay"]')).toHaveValue('25일');
    await expect(page.locator('[data-relationship-field="memo"]')).toHaveValue('월급 다음날 이체');
  });

  test('shows account linked relationships without exposing an ordinary Step 1 editor', async ({ page }) => {
    await page.goto('apps/account-map/index.html');
    await page.locator('#importMainData').click();
    await page.locator('[data-account-id="acc-living"]').first().click();

    await expect(page.locator('#accountMapDetail')).toContainText('생활비계좌');
    await expect(page.locator('#accountMapDetail')).toContainText('들어오는 관계');
    await expect(page.locator('#accountMapDetail')).toContainText('나가는 관계');
    await expect(page.locator('#accountMapDetail')).not.toContainText('수입 추가');
    await expect(page.locator('#accountMapDetail')).not.toContainText('지출 추가');
    await expect(page.locator('#accountMapDetail')).not.toContainText('저축 추가');
  });

  test('accepts and excludes fixed-expense candidates without mutating Main data', async ({ page }) => {
    await page.goto('apps/account-map/index.html');
    await page.locator('#importMainData').click();

    await page.locator('[data-candidate-id="candidate-expense-telecom"] [data-candidate-action="accept"]').click();
    await expect(page.locator('#accountMapSummary')).toContainText('5개 계좌');
    await expect(page.locator('#accountMapSummary')).toContainText('8개 관계');
    await expect(page.locator('#accountMapSummary')).toContainText('1개 확인 필요');
    await expect(page.locator('#accountMapDetail')).toContainText('통신비');
    await expect(page.locator('#accountMapDetail')).toContainText('60,000원');

    await page.locator('[data-candidate-id="candidate-expense-insurance"] [data-candidate-action="exclude"]').click();
    await expect(page.locator('#accountMapSummary')).toContainText('0개 확인 필요');

    const result = await page.evaluate((keys) => ({
      main: JSON.parse(localStorage.getItem(keys.main) || '{}'),
      accountMap: JSON.parse(localStorage.getItem(keys.accountMap) || '{}'),
    }), { main: MAIN_STORAGE_KEY, accountMap: ACCOUNT_MAP_STORAGE_KEY });
    expect(result.main).toEqual(createSeedMainInputs());
    expect(result.accountMap.relationships).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'rel-candidate-telecom',
        type: 'utility-payment',
        label: '통신비',
        amount: 60000,
        sourceRef: { collection: 'expenseItems', id: 'telecom' },
      }),
    ]));
    expect(result.accountMap.candidates.map((candidate: { id: string }) => candidate.id)).toEqual([]);
  });

  test('renders imported unsafe text as text, not markup', async ({ page }) => {
    await page.goto('apps/account-map/index.html');
    await page.evaluate((seed) => {
      if (window.IsfStorageHub?.saveLocal) {
        window.IsfStorageHub.saveLocal('isf-rebuild-v1', seed);
      } else {
        localStorage.setItem('isf-rebuild-v1', JSON.stringify(seed));
      }
      localStorage.removeItem('isf-account-map-v1');
    }, createUnsafeMainInputs());
    await page.locator('#importMainData').click();

    await expect(page.locator('#accountMapCanvas')).toContainText('<img src=x onerror=alert(1)>급여');
    await expect(page.locator('#accountMapCandidates')).toContainText('<u>통신비</u>');
    await expect(page.locator('#accountMapCandidates img')).toHaveCount(0);
    await expect(page.locator('#accountMapCandidates script')).toHaveCount(0);
    await page.locator('[data-candidate-action="accept"]').first().click();
    await expect(page.locator('#accountMapDetail')).toContainText('<u>통신비</u>');
    await page.locator('[data-relationship-field="memo"]').fill('<script>memo()</script>');
    await expect(page.locator('[data-relationship-field="memo"]')).toHaveValue('<script>memo()</script>');
    await expect(page.locator('#accountMapDetail img')).toHaveCount(0);
    await expect(page.locator('#accountMapDetail script')).toHaveCount(0);
  });

  test('keeps the map visible in the first mobile viewport with a compact summary', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('apps/account-map/index.html');
    await page.locator('#importMainData').click();

    const metrics = await page.evaluate(() => {
      const summary = document.querySelector('#accountMapSummary')?.getBoundingClientRect();
      const canvas = document.querySelector('#accountMapCanvas')?.getBoundingClientRect();
      return {
        summaryHeight: summary?.height || 0,
        canvasTop: canvas?.top || 9999,
        canvasBottom: canvas?.bottom || 9999,
        viewportHeight: window.innerHeight,
      };
    });
    expect(metrics.summaryHeight).toBeLessThanOrEqual(40);
    expect(metrics.canvasTop).toBeLessThan(metrics.viewportHeight);
    expect(metrics.canvasBottom).toBeGreaterThan(220);
    await expect(page.locator('#accountMapCanvas svg.account-map-svg')).toBeVisible();
  });
});
