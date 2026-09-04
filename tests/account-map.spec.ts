import { expect, test, type Page } from '@playwright/test';

const storageKey = 'isf-workspace-v4';
const now = Date.UTC(2026, 8, 5, 6);
test.use({ hasTouch: true });
const main = {
  schemaVersion: 2 as const,
  updatedAt: now,
  monthlyNetIncomeWon: 3_100_000,
  monthlyHousingWon: 0,
  monthlyLivingWon: 900_000,
  monthlySavingWon: 0,
  monthlyInvestmentWon: 1_000_000,
};

function workspace(withMain = true) {
  return {
    schemaVersion: 4 as const,
    revision: 1,
    updatedAt: now,
    main: { applied: withMain ? main : null, setupProgress: null },
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [
      location('salary', '급여통장', 'bank', ['income']),
      location('living', '생활비통장', 'bank', ['spending']),
      location('brokerage', '증권계좌', 'brokerage', ['investing']),
    ],
    accountMap: {
      applied: withMain ? {
        schemaVersion: 3 as const,
        sourceMainUpdatedAt: now,
        customPurposes: [],
        links: [
          link('income', 'system:income', 'salary', 3_100_000),
          link('living', 'system:living', 'living', 900_000),
          link('investing', 'system:investing', 'brokerage', 1_000_000),
        ],
        transfers: [
          transfer('salary-living', 'salary', 'living', { kind: 'fixed', monthlyAmountWon: 900_000 }),
          transfer('living-brokerage', 'living', 'brokerage', { kind: 'sweep' }),
        ],
        setupCompletedAt: now,
        updatedAt: now,
      } : null,
      draft: null,
    },
  };
}

function location(id: string, shortName: string, kind: 'bank' | 'brokerage', roles: string[]) {
  return { id, shortName, institution: { name: `${shortName} 기관` }, kind, roles, createdAt: now, updatedAt: now };
}

function link(id: string, purposeId: string, locationId: string, monthlyAmountWon: number) {
  return { id, purposeId, locationId, monthlyAmountWon, remainder: false, status: 'active' as const, createdAt: now, updatedAt: now };
}

function transfer(id: string, sourceLocationId: string, targetLocationId: string, allocation: { kind: 'fixed'; monthlyAmountWon: number } | { kind: 'sweep' }) {
  return { id, sourceLocationId, targetLocationId, allocation, status: 'active' as const, createdAt: now, updatedAt: now };
}

async function seed(page: Page, value: ReturnType<typeof workspace>) {
  await page.addInitScript(({ key, document }) => localStorage.setItem(key, JSON.stringify(document)), { key: storageKey, document: value });
}

async function storedProtectedSlices(page: Page) {
  return await page.evaluate((key) => {
    const value = JSON.parse(localStorage.getItem(key)!);
    return { main: value.main, simulation: value.simulation, portfolio: value.portfolio };
  }, storageKey);
}

test('requires a Main basis without creating Account Map state', async ({ page }) => {
  const value = workspace(false);
  await seed(page, value);
  await page.goto('apps/account-map/');

  await expect(page.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
  expect(await storedProtectedSlices(page)).toEqual({ main: value.main, simulation: value.simulation, portfolio: value.portfolio });
});

test('keeps the V3 completed flow map contained, touch-sized, and readable at supported widths', async ({ page }) => {
  await seed(page, workspace());
  for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 900 }, { width: 1280, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/account-map/');

    await expect(page.getByRole('heading', { name: '계좌별 월 계획 흐름' }).first()).toBeVisible();
    await expect(page.getByRole('table', { name: '계좌 흐름 읽기 표' })).toContainText('급여통장');
    await expect(page.locator('[data-account-flow-edge-amount]')).toHaveCount(0);
    const salary = page.getByRole('button', { name: /계좌 급여통장/ });
    const salaryBox = await salary.boundingBox();
    expect(salaryBox?.width).toBeGreaterThanOrEqual(44);
    expect(salaryBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await salary.click();
    const detail = page.getByLabel('급여통장 월 계획 흐름');
    await expect(detail).toBeVisible();
    expect(await page.locator('[data-account-flow-edge-amount]').count()).toBeGreaterThan(0);
    const [detailBox, canvasBox] = await Promise.all([detail.boundingBox(), page.locator('.account-flow-canvas').boundingBox()]);
    expect(detailBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    expect(detailBox!.x).toBeGreaterThanOrEqual(canvasBox!.x);
    expect(detailBox!.x + detailBox!.width).toBeLessThanOrEqual(canvasBox!.x + canvasBox!.width);
    expect(detailBox!.y).toBeGreaterThanOrEqual(canvasBox!.y);
    expect(detailBox!.y + detailBox!.height).toBeLessThanOrEqual(canvasBox!.y + canvasBox!.height);
  }
});

test('uses first activation for pinning, then explicit actions for the account and typed transfer editors', async ({ page }) => {
  const value = workspace();
  const before = { main: value.main, simulation: value.simulation, portfolio: value.portfolio };
  await seed(page, value);
  await page.goto('apps/account-map/');

  const salary = page.getByRole('button', { name: /계좌 급여통장/ });
  await salary.focus();
  await expect(page.getByLabel('급여통장 월 계획 흐름')).toContainText('미리 보기');
  await expect(page.getByRole('button', { name: '계좌 정보 편집' })).toHaveCount(0);
  await salary.click();
  const detail = page.getByLabel('급여통장 월 계획 흐름');
  await detail.getByRole('button', { name: '계좌 정보 편집' }).click();
  await expect(page.getByRole('dialog', { name: '급여통장 상세' })).toBeVisible();
  await page.getByRole('button', { name: '닫기' }).click();

  await detail.getByRole('button', { name: '연결 추가' }).click();
  const editor = page.getByRole('dialog', { name: '계좌 흐름 편집' });
  await expect(editor.getByRole('button', { name: '닫기' })).toBeFocused();
  await editor.getByRole('combobox', { name: '받는 계좌' }).selectOption('brokerage');
  await editor.getByRole('textbox', { name: '월 이체 금액' }).fill('110000');
  await editor.getByRole('button', { name: '저장' }).click();
  await expect(editor).toHaveCount(0);

  expect(await storedProtectedSlices(page)).toEqual(before);
  const transfers = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.applied.transfers, storageKey);
  expect(transfers).toEqual(expect.arrayContaining([
    expect.objectContaining({ sourceLocationId: 'salary', targetLocationId: 'brokerage', allocation: { kind: 'fixed', monthlyAmountWon: 110_000 } }),
  ]));
});

test('clears a pinned flow from Escape and does not convert an edge or account state into a real balance', async ({ page }) => {
  await seed(page, workspace());
  await page.goto('apps/account-map/');
  await page.getByRole('button', { name: /계좌 생활비통장/ }).click();

  await expect(page.getByLabel('생활비통장 월 계획 흐름')).toContainText('남은 금액 전부 · 계획상 0원');
  await expect(page.getByText('월 계획 기준이며 실제 잔액·거래와 다를 수 있습니다.').first()).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('생활비통장 월 계획 흐름')).toHaveCount(0);
});
