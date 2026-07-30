import { expect, test } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: 10,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

test('connects Main through Simulation readiness to Portfolio readiness', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
  await page.goto('apps/main/');

  await expect(page.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
  await page.getByRole('button', { name: 'Simulation으로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/simulation\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();

  await page.reload();
  await expect(page.getByText('월 투자 가능액 110만 원')).toBeVisible();
  await page.getByRole('button', { name: 'Portfolio로 이어가기' }).click();
  await expect(page).toHaveURL(/\/apps\/portfolio\/$/);
  await expect(page.getByRole('status')).toContainText('연결되었습니다');
});

test('requires Main input before journey navigation', async ({ page }) => {
  await page.goto('apps/main/');

  await expect(page.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeDisabled();
});

test('recovers from missing and malformed journey storage', async ({ page }) => {
  await page.goto('apps/simulation/');
  await expect(page.getByRole('link', { name: 'Main으로 이동' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('isf-journey-snapshot-v1', '{broken'));
  await page.reload();
  await expect(page.getByText('연결 정보를 확인하지 못했습니다')).toBeVisible();
});

test('legacy app DOM is absent from product routes', async ({ page }) => {
  for (const app of ['simulation', 'portfolio', 'account-map']) {
    await page.goto(`apps/${app}/`);
    await expect(page.locator('app-header, data-hub-modal, #strategyCardGroup, #portfolioCreator, #accountMapCanvas')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /준비 중$/ })).toBeVisible();
  }
});

test.describe('mobile app journey', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('keeps launcher and keyboard journey handoff usable without horizontal overflow', async ({ page }) => {
    await page.addInitScript((fixture) => {
      localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    }, appliedMain);
    await page.goto('apps/main/');

    const launcher = page.locator('.journey-launcher summary');
    const launcherBox = await launcher.boundingBox();
    expect(launcherBox).not.toBeNull();
    expect(launcherBox!.height).toBeGreaterThanOrEqual(44);
    await launcher.tap();
    const simulationLink = page.getByRole('link', { name: 'Simulation 준비 중' });
    const simulationLinkBox = await simulationLink.boundingBox();
    expect(simulationLinkBox).not.toBeNull();
    expect(simulationLinkBox!.height).toBeGreaterThanOrEqual(44);
    const action = page.getByRole('button', { name: 'Simulation으로 이어가기' });
    const box = await action.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await simulationLink.tap();
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    await page.getByRole('link', { name: 'Main으로 이동' }).tap();
    await expect(page).toHaveURL(/\/apps\/main\/$/);
    await action.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/apps\/simulation\/$/);
    const portfolioAction = page.getByRole('button', { name: 'Portfolio로 이어가기' });
    await portfolioAction.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/apps\/portfolio\/$/);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
});
