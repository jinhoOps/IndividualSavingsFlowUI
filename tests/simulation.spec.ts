import { expect, test, type Page } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 6, 30, 6),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

async function seedMain(page: Page) {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
  }, appliedMain);
}

test('starts from current Main and keeps Main read-only while changing projection', async ({ page }) => {
  await seedMain(page);
  await page.goto('apps/simulation/');
  await expect(page.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  await page.getByRole('button', { name: '없어요' }).click();
  await expect(page.getByRole('heading', { name: '20년 뒤 예상금액' })).toBeVisible();
  await expect(page.getByText('현재 계획', { exact: true })).toBeVisible();
  await expect(page.getByText('전부 저축', { exact: true })).toBeVisible();
  await expect(page.getByText(/백테스트나 금융 자문이 아닙니다/)).toBeVisible();

  await page.getByRole('button', { name: '연 기대수익률 13%' }).click();
  await page.getByRole('button', { name: '30년' }).click();
  await expect(page.getByRole('heading', { name: '30년 뒤 예상금액' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-main-v2')!))).toEqual(appliedMain);
});

for (const viewport of [
  { width: 390, height: 844, label: 'mobile' },
  { width: 768, height: 900, label: 'tablet' },
  { width: 1280, height: 900, label: 'desktop' },
]) {
  test(`${viewport.label} contains chart and exposes yearly detail`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedMain(page);
    await page.goto('apps/simulation/');
    await page.getByRole('button', { name: '없어요' }).click();
    await page.getByRole('slider', { name: '그래프 연도 상세' }).fill('10');
    await expect(page.getByText('현재 계획 총액')).toBeVisible();
    await expect(page.getByText('누적 납입원금')).toBeVisible();
    await page.getByRole('slider', { name: '그래프 연도 상세' }).press('Escape');
    await expect(page.getByText('현재 계획 총액')).toBeHidden();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('requires a nonzero Main savings or investment contribution', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-main-v2', JSON.stringify({
      ...fixture,
      monthlySavingWon: 0,
      monthlyInvestmentWon: 0,
    }));
  }, appliedMain);
  await page.goto('apps/simulation/');
  await expect(page.getByText('Main에서 월 저축·투자 금액을 먼저 정해주세요.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Main에서 설정하기' })).toBeVisible();
});
