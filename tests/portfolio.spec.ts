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

async function seedAppliedPortfolio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem('isf-portfolio-allocation-v1', JSON.stringify({
      schemaVersion: 1,
      items: [{ id: 'index', name: '인덱스', shareUnits: 600_000, order: 0 }],
      cashShareUnits: 400_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 200_000,
      appliedAt: 1,
      updatedAt: 1,
    }));
  });
}

test('creates one allocation and revisits result-first', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.addInitScript(() => {
    localStorage.setItem('isf-step3-portfolios-v2', '{"legacy":"plans"}');
    localStorage.setItem('isf-step3-snapshots-v1', '{"legacy":"snapshots"}');
  });
  await page.goto('apps/portfolio/');
  const mainBefore = await page.evaluate(() => localStorage.getItem('isf-main-v2'));
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
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => ({
    main: localStorage.getItem('isf-main-v2'),
    legacyPlans: localStorage.getItem('isf-step3-portfolios-v2'),
    legacySnapshots: localStorage.getItem('isf-step3-snapshots-v1'),
  }))).toEqual({
    main: mainBefore,
    legacyPlans: '{"legacy":"plans"}',
    legacySnapshots: '{"legacy":"snapshots"}',
  });
});

test('resumes and cancels a draft, validates manual cash, and confirms reset', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  await page.getByRole('button', { name: '배분 수정' }).click();
  await page.getByLabel('인덱스 금액').fill('100000');
  await page.getByLabel('인덱스 금액').blur();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('isf-portfolio-allocation-draft-v1')))
    .toContain('500000');
  await page.reload();
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  await expect(page.getByLabel('인덱스 금액')).toHaveValue('100000');

  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.getByRole('row', { name: /인덱스.*120,000원.*60%/ })).toBeVisible();
  await page.getByRole('button', { name: '배분 수정' }).click();
  await page.getByLabel('인덱스 금액').fill('100000');
  await page.getByLabel('인덱스 금액').blur();
  await page.getByLabel('현금 금액').fill('70000');
  await page.getByLabel('현금 금액').blur();
  await expect(page.getByText('현금 직접 배분 중')).toBeVisible();
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('dialog', { name: '투자 배분 적용' })
    .getByRole('button', { name: '적용' })).toBeDisabled();
  await page.getByRole('button', { name: '확인 취소' }).click();
  await expect(page.getByRole('button', { name: '적용' })).toBeFocused();
  await page.getByRole('button', { name: '현금 자동 배분 켜기' }).click();
  await page.getByRole('button', { name: '취소' }).click();

  const management = page.getByRole('button', { name: '관리 메뉴' });
  await management.click();
  await page.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }).click();
  const resetDialog = page.getByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' });
  await expect(resetDialog.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(management).toBeFocused();
  await management.click();
  await page.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }).click();
  await page.getByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' })
    .getByRole('button', { name: '초기화' }).click();
  await expect(page.getByRole('row', { name: /현금.*200,000원.*100%/ })).toBeVisible();
});

test('explains duplicate names and blocks confirmation until corrected', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByLabel('투자 대상 이름 1').fill('US INDEX');
  await page.getByLabel('투자 대상 이름 2').fill(' us   index ');

  await expect(page.getByLabel('투자 대상 이름 1'))
    .toHaveAccessibleDescription('같은 이름의 투자 대상이 이미 있습니다.');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByRole('dialog', { name: '투자 배분 적용' })
    .getByRole('button', { name: '적용' })).toBeDisabled();
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
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('apps/portfolio/');
    await expect(page.getByLabel('투자 배분 도넛')).toBeVisible();
    await expect(page.getByRole('table')).toBeVisible();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    const segment = page.getByRole('button', { name: /인덱스.*120,000원.*60%/ });
    const donutBox = await page.getByLabel('투자 배분 도넛').boundingBox();
    expect(donutBox).not.toBeNull();
    await segment.dispatchEvent('pointerover', {
      clientX: viewport.width - 1,
      clientY: viewport.height - 1,
      pointerType: 'mouse',
    });
    await expect(page.getByRole('tooltip')).toContainText('인덱스');
    const tooltipBox = await page.getByRole('tooltip').boundingBox();
    expect(tooltipBox).not.toBeNull();
    const tooltipMetrics = await page.getByRole('tooltip').evaluate((element) => ({
      style: element.getAttribute('style'),
      offsetWidth: (element as HTMLElement).offsetWidth,
      offsetHeight: (element as HTMLElement).offsetHeight,
      viewport: { width: innerWidth, height: innerHeight },
    }));
    expect(tooltipBox!.x).toBeGreaterThanOrEqual(16);
    expect(tooltipBox!.y).toBeGreaterThanOrEqual(16);
    expect(tooltipBox!.x + tooltipBox!.width, JSON.stringify(tooltipMetrics)).toBeLessThanOrEqual(viewport.width - 16);
    expect(tooltipBox!.y + tooltipBox!.height, JSON.stringify(tooltipMetrics)).toBeLessThanOrEqual(viewport.height - 16);
    expect(await segment.evaluate((element) => parseFloat(getComputedStyle(element).transitionDuration))).toBeLessThanOrEqual(0.01);
    expect(await page.getByRole('tooltip').evaluate((element) => parseFloat(getComputedStyle(element).animationDuration))).toBeLessThanOrEqual(0.01);
    await segment.dispatchEvent('pointerdown', { pointerType: 'touch' });
    await expect(page.getByRole('tooltip')).toContainText('인덱스');
    await segment.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tooltip')).toContainText('현금');
  }
});
