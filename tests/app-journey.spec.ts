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
    const seedMarker = 'isf-test-journey-fixture-seeded';
    if (sessionStorage.getItem(seedMarker) !== null) return;
    sessionStorage.setItem(seedMarker, 'true');

    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    localStorage.setItem('isf-journey-snapshot-v1', JSON.stringify({
      monthlySavingWon: 900_000,
      monthlyInvestmentWon: 900_000,
    }));
    localStorage.setItem('isf-simulation-compound-v1', JSON.stringify({
      schemaVersion: 2,
      source: {
        monthlySavingsWon: 100_000,
        monthlyInvestmentWon: 100_000,
        mainUpdatedAt: fixture.updatedAt - 1,
      },
      initialInvestmentWon: 10_000_000,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: fixture.updatedAt - 1,
    }));
  }, appliedMain);
  await page.goto('apps/main/');
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBeNull();
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect.poll(() => page.evaluate(
    () => localStorage.getItem('isf-journey-snapshot-v1'),
  )).toBeNull();
  await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
  await expect(page.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
  await expect(page.getByRole('link', { name: /Simulation 사용 중.*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
});

test('revisits Simulation at the result and refreshes only its Main source', async ({ page }) => {
  const previousSource = {
    monthlySavingsWon: 100_000,
    monthlyInvestmentWon: 100_000,
    mainUpdatedAt: appliedMain.updatedAt - 1,
  };
  await page.addInitScript(({ main, source }) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(main));
    localStorage.setItem('isf-simulation-compound-v1', JSON.stringify({
      schemaVersion: 2,
      source,
      initialInvestmentWon: 10_000_000,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: source.mainUpdatedAt,
    }));
  }, { main: appliedMain, source: previousSource });

  await page.goto('apps/simulation/');
  await expect(page.getByRole('heading', { name: /이대로 20년 유지하면/ })).toBeVisible();
  await expect(page.getByText(/월 저축 30만 원 · 투자 20만 원/)).toBeVisible();
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }))
    .toHaveCount(0);

  const stored = await page.evaluate(() => JSON.parse(
    localStorage.getItem('isf-simulation-compound-v1')!,
  ));
  expect(stored.source.monthlySavingsWon).toBe(300_000);
  expect(stored.initialInvestmentWon).toBe(10_000_000);
});

test('keeps detailed Portfolio and readiness-only Account Map isolated', async ({ page }) => {
  await page.addInitScript((fixture) => localStorage.setItem('isf-main-v2', JSON.stringify(fixture)), appliedMain);
  await page.goto('apps/portfolio/');
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  await expect(page.getByText('Portfolio 사용 중')).toBeVisible();
  await page.goto('apps/account-map/');
  await expect(page.getByRole('heading', { name: 'Account Map 준비 중' })).toBeVisible();
  await expect(page.locator('app-header, data-hub-modal, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
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
