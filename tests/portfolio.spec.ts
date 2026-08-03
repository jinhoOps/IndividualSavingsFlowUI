import { expect, test, type Page } from '@playwright/test';

const mainFixture = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 7, 3, 6),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

async function seedMain(page: Page, monthlyInvestmentWon: number): Promise<void> {
  await page.addInitScript(({ fixture, investment }) => {
    localStorage.setItem('isf-main-v2', JSON.stringify({ ...fixture, monthlyInvestmentWon: investment }));
  }, { fixture: mainFixture, investment: monthlyInvestmentWon });
}

test('creates one allocation and revisits result-first', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByLabel('투자 대상 이름 1').fill('미국 인덱스');
  await page.getByLabel('미국 인덱스 금액').fill('120000');
  await page.getByLabel('미국 인덱스 금액').blur();
  await expect(page.getByRole('region', { name: '현금' })).toContainText('80,000원');
  await expect(page.getByRole('region', { name: '현금' })).toContainText('40%');
  await page.getByRole('button', { name: '적용' }).click();
  await page.getByRole('dialog', { name: '투자 배분 적용' })
    .getByRole('button', { name: '적용' }).click();
  await expect(page.getByText('한 달 투자금을 배분합니다')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('row', { name: /미국 인덱스.*120,000원.*60%/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Portfolio 사용 중.*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
});

test('puts a Main investment increase into cash', async ({ page }) => {
  await page.addInitScript(({ fixture }) => {
    localStorage.setItem('isf-main-v2', JSON.stringify({ ...fixture, monthlyInvestmentWon: 300_000 }));
    localStorage.setItem('isf-portfolio-allocation-v1', JSON.stringify({
      schemaVersion: 1,
      items: [{ id: 'index', name: '인덱스', shareUnits: 600_000, order: 0 }],
      cashShareUnits: 400_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 200_000,
      appliedAt: 1,
      updatedAt: 1,
    }));
  }, { fixture: mainFixture });
  await page.goto('apps/portfolio/');
  await expect(page.getByRole('row', { name: /인덱스.*120,000원.*40%/ })).toBeVisible();
  await expect(page.getByRole('row', { name: /현금.*180,000원.*60%/ })).toBeVisible();
});

test('gates zero investment and focuses Main investment editing', async ({ page }) => {
  await seedMain(page, 0);
  await page.goto('apps/portfolio/');
  await expect(page.getByTestId('portfolio-gated-content')).toHaveClass(/portfolio-content--blurred/);
  await page.getByRole('link', { name: 'Main에서 투자금 설정' }).click();
  await expect(page).toHaveURL(/apps\/main\/$/);
  await expect(page.getByLabel('월 투자액')).toBeFocused();
});

test('keeps donut, table and tooltip usable across required widths', async ({ page }) => {
  await page.addInitScript(({ fixture }) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    localStorage.setItem('isf-portfolio-allocation-v1', JSON.stringify({
      schemaVersion: 1,
      items: [{ id: 'index', name: '인덱스', shareUnits: 600_000, order: 0 }],
      cashShareUnits: 400_000,
      cashMode: 'automatic', syncedInvestmentWon: 200_000, appliedAt: 1, updatedAt: 1,
    }));
  }, { fixture: mainFixture });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto('apps/portfolio/');
    await expect(page.getByLabel('투자 배분 도넛')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    const segment = page.getByRole('button', { name: /인덱스.*120,000원.*60%/ });
    const donutBox = await page.getByLabel('투자 배분 도넛').boundingBox();
    expect(donutBox).not.toBeNull();
    await page.mouse.move(donutBox!.x + donutBox!.width * 0.5, donutBox!.y + donutBox!.height * 0.1);
    await expect(page.getByRole('tooltip')).toContainText('인덱스');
    await segment.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tooltip')).toContainText('현금');
  }
});
