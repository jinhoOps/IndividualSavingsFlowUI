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
          transfer('salary-brokerage', 'salary', 'brokerage', { kind: 'fixed', monthlyAmountWon: 1_000_000 }),
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

function staleWorkspace() {
  const value = workspace();
  if (value.accountMap.applied === null) throw new Error('completed map fixture required');
  value.accountMap.applied.sourceMainUpdatedAt = now - 1;
  return value;
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
    const table = page.getByRole('table', { name: '계좌 흐름 읽기 표' });
    await expect(table).toContainText('급여통장');
    await expect(table).toContainText('생활비통장');
    await expect(table).toContainText('증권계좌');
    await expect(table).toContainText('고정 금액 · 900,000원');
    await expect(table).toContainText('고정 금액 · 1,000,000원');
    await expect(table).toContainText('남은 금액 전부 · 계획상 0원');
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

    await page.getByRole('button', { name: /계좌 생활비통장/ }).click();
    const livingDetail = page.getByLabel('생활비통장 월 계획 흐름');
    await expect(livingDetail).toContainText('들어오는 흐름');
    await expect(livingDetail).toContainText('다른 계좌로 보내는 흐름');
    await expect(livingDetail).toContainText('남은 금액 전부 · 계획상 0원');
  }
});

test('uses hover, keyboard pinning, and explicit actions for the account and typed transfer editors', async ({ page }) => {
  const value = workspace();
  const before = { main: value.main, simulation: value.simulation, portfolio: value.portfolio };
  await seed(page, value);
  await page.goto('apps/account-map/');

  const salary = page.getByRole('button', { name: /계좌 급여통장/ });
  await salary.hover();
  await expect(page.getByLabel('급여통장 월 계획 흐름')).toContainText('미리 보기');
  await salary.focus();
  await expect(page.getByLabel('급여통장 월 계획 흐름')).toContainText('미리 보기');
  await expect(page.getByRole('button', { name: '계좌 정보 편집' })).toHaveCount(0);
  await page.keyboard.press('Enter');
  const detail = page.getByLabel('급여통장 월 계획 흐름');
  await expect(detail).toContainText('다른 계좌로 보내는 흐름');
  await detail.getByRole('button', { name: '계좌 정보 편집' }).click();
  await expect(page.getByRole('dialog', { name: '급여통장 상세' })).toBeVisible();
  await page.getByRole('button', { name: '닫기' }).click();

  await detail.getByRole('button', { name: '흐름 편집' }).first().click();
  const editor = page.getByRole('dialog', { name: '계좌 흐름 편집' });
  await expect(editor.getByRole('button', { name: '닫기' })).toBeFocused();
  await editor.getByRole('textbox', { name: '월 이체 금액' }).fill('110000');
  await editor.getByRole('button', { name: '저장' }).click();
  await expect(editor).toHaveCount(0);

  expect(await storedProtectedSlices(page)).toEqual(before);
  const transfers = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).accountMap.applied.transfers, storageKey);
  expect(transfers).toEqual(expect.arrayContaining([
    expect.objectContaining({ id: 'salary-brokerage', sourceLocationId: 'salary', targetLocationId: 'brokerage', allocation: { kind: 'fixed', monthlyAmountWon: 110_000 } }),
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

test('keeps Account Map mounted while the Main overlay saves, handles dirty dismissal, and confirms the refreshed basis without changing transfers', async ({ page }) => {
  const value = staleWorkspace();
  const transfersBefore = structuredClone(value.accountMap.applied?.transfers);
  await seed(page, value);
  await page.goto('apps/account-map/');

  const editMain = page.getByRole('button', { name: 'Main 금액 수정' });
  await expect(page.getByRole('status')).toContainText('확인 필요');
  await editMain.click();
  const overlay = page.getByRole('dialog', { name: '월 자금 계획 편집' });
  await expect(overlay).toBeVisible();
  await expect(page.getByTestId('account-map-journey-background')).toHaveAttribute('inert', '');
  await expect(overlay.getByLabel('월 실수령액')).toBeFocused();
  await overlay.getByLabel('월평균 생활비').fill('1100000');

  page.once('dialog', (dialog) => dialog.dismiss());
  await page.keyboard.press('Escape');
  await expect(overlay).toBeVisible();
  await expect(overlay.getByLabel('월평균 생활비')).toHaveValue('1,100,000');

  page.once('dialog', (dialog) => dialog.accept());
  await page.goBack();
  await expect(overlay).toHaveCount(0);
  await expect(editMain).toBeFocused();

  await editMain.click();
  const savingOverlay = page.getByRole('dialog', { name: '월 자금 계획 편집' });
  await savingOverlay.getByLabel('월평균 생활비').fill('1100000');
  await savingOverlay.getByRole('button', { name: '적용' }).click();
  await expect(savingOverlay).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '계좌별 월 계획 흐름' }).first()).toBeVisible();
  await expect(page.getByRole('status')).toContainText('확인 필요');

  await page.getByRole('button', { name: '현재 Main 기준으로 확인' }).click();
  await expect(page.getByRole('button', { name: '현재 Main 기준으로 확인' })).toHaveCount(0);
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(stored.accountMap.applied.sourceMainUpdatedAt).toBe(stored.main.applied.updatedAt);
  expect(stored.accountMap.applied.transfers).toEqual(transfersBefore);
});

test('keeps the Main overlay draft visible when its save fails', async ({ page }) => {
  const value = staleWorkspace();
  const mainBefore = structuredClone(value.main);
  const transfersBefore = structuredClone(value.accountMap.applied?.transfers);
  await seed(page, value);
  await page.goto('apps/account-map/');
  await page.evaluate((key) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(storageKey, raw) {
      if (storageKey === key) throw new DOMException('blocked Main save', 'QuotaExceededError');
      return originalSetItem.call(this, storageKey, raw);
    };
  }, storageKey);

  await page.getByRole('button', { name: 'Main 금액 수정' }).click();
  const overlay = page.getByRole('dialog', { name: '월 자금 계획 편집' });
  await overlay.getByLabel('월평균 생활비').fill('1100000');
  await overlay.getByRole('button', { name: '적용' }).click();
  await expect(overlay.getByRole('alert').first()).toContainText('저장하지 못했습니다. 초안은 그대로 보존되어 있습니다.');
  await expect(overlay.getByLabel('월평균 생활비')).toHaveValue('1,100,000');
  const stored = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)!), storageKey);
  expect(stored.main).toEqual(mainBefore);
  expect(stored.accountMap.applied.transfers).toEqual(transfersBefore);
});
