import { expect, test } from '@playwright/test';

const currentMain = {
  schemaVersion: 1,
  updatedAt: 1,
  incomes: [{ id: 'salary', name: '급여', amountWon: 4_200_000, allocations: [{ accountId: 'salary-account', amountWon: 4_200_000 }] }],
  expenses: [{ id: 'living', name: '생활비', amountWon: 1_800_000 }],
  savings: [{ id: 'deposit', name: '적금', amountWon: 700_000 }],
  investments: [{ id: 'etf', name: 'ETF', amountWon: 500_000 }],
  accounts: [{ id: 'salary-account', name: '급여통장', kind: 'income' }],
};

async function seedCurrentMain(page: Parameters<typeof test>[0]['page']) {
  await page.addInitScript((data) => {
    if (localStorage.getItem('isf-main-v1') === null) {
      localStorage.setItem('isf-main-v1', JSON.stringify(data));
    }
  }, currentMain);
}

test('new user completes setup and sees summary', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('수입 이름').fill('급여');
  await page.getByLabel('월 금액').fill('4200000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('생활비 이름').fill('생활비');
  await page.getByLabel('월 금액').fill('1800000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('월 저축 금액').fill('700000');
  await page.getByLabel('월 투자 금액').fill('500000');
  await page.getByRole('button', { name: '다음' }).click();

  await page.getByLabel('계좌 이름').fill('급여통장');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '계획 적용' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByText('투자 가능액')).toBeVisible();
});

test('apply persists edits and cancel restores the last applied value', async ({ page }) => {
  await seedCurrentMain(page);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: /수입 편집/ }).click();
  await page.getByLabel('급여 월 금액').fill('5000000');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('status')).toHaveText('저장됨');
  await page.reload();
  await expect(page.getByRole('button', { name: '수입 편집' })).toContainText('500만 원');

  await page.getByRole('button', { name: /수입 편집/ }).click();
  await page.getByLabel('급여 월 금액').fill('6000000');
  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('button', { name: '수입 편집' })).toContainText('500만 원');
  await page.getByRole('button', { name: /수입 편집/ }).click();
  await expect(page.getByLabel('급여 월 금액')).toHaveValue('5,000,000');
});

test('keeps the editable draft when saving the updated plan fails', async ({ page }) => {
  await page.addInitScript((data) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-main-v1', JSON.stringify(data));
    const setItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItemWithMainFailure(key, value) {
      if (key === 'isf-main-v1') throw new DOMException('Storage quota exceeded.', 'QuotaExceededError');
      return setItem.call(this, key, value);
    };
  }, currentMain);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: /수입 편집/ }).click();
  await page.getByLabel('급여 월 금액').fill('5000000');
  await page.getByRole('button', { name: '적용' }).click();

  await expect(page.getByRole('status')).toHaveText('저장에 실패했습니다');
  await expect(page.getByLabel('급여 월 금액')).toHaveValue('5,000,000');
  await expect(page.getByRole('button', { name: '수입 편집' })).toContainText('420만 원');
  await expect.poll(async () => page.evaluate(() => {
    const stored = localStorage.getItem('isf-main-v1');
    return stored === null ? null : JSON.parse(stored).incomes[0].amountWon;
  })).toBe(4_200_000);
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: /수입 편집/ }).click();
  await expect(page.getByLabel('급여 월 금액')).toHaveValue('4,200,000');
  await page.reload();
  await expect(page.getByRole('button', { name: '수입 편집' })).toContainText('420만 원');
});

test('cancels restart setup without replacing the current plan', async ({ page }) => {
  await seedCurrentMain(page);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: '처음부터 다시 설정' }).click();
  await expect(page.getByRole('heading', { name: '내 자금 계획을 시작합니다' })).toBeVisible();
  await page.getByRole('button', { name: '취소' }).click();

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수입 편집' })).toContainText('420만 원');
});

test('resumes an unfinished setup at its saved step', async ({ page }) => {
  await page.addInitScript((draft) => {
    localStorage.clear();
    localStorage.setItem('isf-main-v1-setup-progress', JSON.stringify({ step: 'expense', draft }));
  }, {
    schemaVersion: 1,
    updatedAt: 0,
    incomes: [{ id: 'salary', name: '급여', amountWon: 4_200_000, allocations: [] }],
    expenses: [],
    savings: [],
    investments: [],
    accounts: [],
  });

  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '월 생활비를 알려주세요' })).toBeVisible();
});

test('opens a legacy isf-rebuild-v1 fixture as the converted dashboard', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem('isf-rebuild-v1', JSON.stringify({
      incomes: [{ id: 'salary', name: '급여', amount: 4_200_000, allocations: [] }],
      expenseItems: [{ id: 'living', name: '생활비', amount: 1_800_000 }],
      savingsItems: [],
      investItems: [],
      accounts: [],
    }));
  });

  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  await expect(page.getByRole('button', { name: '수입 편집' })).toContainText('420만 원');
});

test('does not overflow horizontally at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedCurrentMain(page);
  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
  expect(await page.locator('html').evaluate((element) => element.scrollWidth <= window.innerWidth)).toBe(true);
});
