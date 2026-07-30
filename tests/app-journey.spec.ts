import { expect, test } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 6, 30, 6),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

test('connects Main directly to the detailed Simulation', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  await page.goto('apps/main/');
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Simulation 사용 중.*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
});

test('keeps Portfolio and Account Map as isolated readiness routes', async ({ page }) => {
  for (const app of ['portfolio', 'account-map'] as const) {
    await page.goto(`apps/${app}/`);
    await expect(page.getByRole('heading', { name: new RegExp('준비 중$') })).toBeVisible();
    await expect(page.locator('app-header, data-hub-modal, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
  }
});

test('contains launcher and current route at mobile, tablet, and desktop widths', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/simulation/');
    await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
    if (viewport.width < 768) {
      await page.locator('.journey-launcher summary').click();
    }
    await expect(page.getByRole('link', { name: /Simulation 사용 중.*현재 위치/ }))
      .toHaveAttribute('aria-current', 'page');
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('legacy Simulation DOM is absent from the supported route', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  await page.goto('apps/simulation/');
  await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup')).toHaveCount(0);
});
