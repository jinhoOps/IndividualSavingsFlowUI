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

test('React Main ignores retired standalone data and leaves each record untouched', async ({ page }) => {
  const retiredRaw = {
    mainV1: JSON.stringify({
      schemaVersion: 1,
      updatedAt: 9_999_999_999_999,
      incomes: [{ id: 'salary', amountWon: 4_200_000 }],
      accounts: [{ id: 'salary-account', name: '급여통장' }],
    }),
    mainV2: JSON.stringify(appliedMainV2),
    rebuildV1: JSON.stringify({
      modelVersion: 10,
      updatedAt: 9_999_999_999_999,
      monthlyInvest: 900_000,
    }),
    journeyV1: null,
  };
  expect(JSON.parse(retiredRaw.mainV2)).toEqual(appliedMainV2);
  await page.addInitScript((raw) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-main-v1', raw.mainV1);
    localStorage.setItem('isf-main-v2', raw.mainV2);
    localStorage.setItem('isf-rebuild-v1', raw.rebuildV1);
  }, retiredRaw);

  await page.goto('apps/main/');

  await expect(page.getByRole('heading', { name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => ({
    mainV1: localStorage.getItem('isf-main-v1'),
    mainV2: localStorage.getItem('isf-main-v2'),
    rebuildV1: localStorage.getItem('isf-rebuild-v1'),
    journeyV1: localStorage.getItem('isf-journey-snapshot-v1'),
  }))).toEqual(retiredRaw);
});

test('React Main workspace save leaves retired standalone records untouched', async ({ page }) => {
  const retiredRaw = {
    mainV2: JSON.stringify(appliedMainV2),
    mainV1: JSON.stringify({ schemaVersion: 1, updatedAt: 10 }),
    rebuildV1: JSON.stringify({ modelVersion: 10, updatedAt: 10, monthlyInvest: 123_000 }),
    journeyV1: null,
  };
  const retiredWorkspaceRaw = JSON.stringify({
    schemaVersion: 1,
    revision: 1,
    updatedAt: appliedMainV2.updatedAt,
    main: { applied: appliedMainV2, setupProgress: null },
    simulation: { draft: null },
    portfolio: { plans: [], draft: null },
    locations: [],
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  });
  await page.addInitScript(({ workspaceRaw, raw }) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('isf-workspace-v1', workspaceRaw);
    localStorage.setItem('isf-main-v2', raw.mainV2);
    localStorage.setItem('isf-main-v1', raw.mainV1);
    localStorage.setItem('isf-rebuild-v1', raw.rebuildV1);
  }, {
    workspaceRaw: retiredWorkspaceRaw,
    raw: retiredRaw,
  });
  await page.goto('apps/main/');

  await page.getByRole('button', { name: '월 투자 편집' }).click();
  await page.getByLabel('월 투자액').fill('650000');
  await page.getByRole('button', { name: '적용' }).click();

  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v3') ?? '{}');
    return workspace.main?.applied?.monthlyInvestmentWon;
  })).toEqual(650_000);
  await expect.poll(() => page.evaluate(() => ({
    workspaceV1: localStorage.getItem('isf-workspace-v1'),
    mainV1: localStorage.getItem('isf-main-v1'),
    mainV2: localStorage.getItem('isf-main-v2'),
    rebuildV1: localStorage.getItem('isf-rebuild-v1'),
    journeyV1: localStorage.getItem('isf-journey-snapshot-v1'),
  }))).toEqual({ workspaceV1: retiredWorkspaceRaw, ...retiredRaw });
});
