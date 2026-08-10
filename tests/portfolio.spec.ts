import { expect, test, type Locator, type Page } from '@playwright/test';

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
    localStorage.setItem('isf-portfolio-allocation-v2', JSON.stringify({
      schemaVersion: 2,
      items: [{
        id: 'index', name: '인덱스', shareUnits: 600_000, order: 0,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
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
  await expect(page.getByRole('heading', { name: '안정 40%' })).toBeVisible();
  await page.reload();
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /미국 인덱스.*60%/ }))
    .toBeVisible();
  await expect(page.locator('.portfolio-summary')).not.toContainText('120,000원');
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => ({
    main: localStorage.getItem('isf-main-v2'),
    applied: localStorage.getItem('isf-portfolio-allocation-v2'),
    legacyPlans: localStorage.getItem('isf-step3-portfolios-v2'),
    legacySnapshots: localStorage.getItem('isf-step3-snapshots-v1'),
  }))).toEqual({
    main: mainBefore,
    applied: expect.stringContaining('"schemaVersion":2'),
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
  await expect.poll(() => page.evaluate(() => localStorage.getItem('isf-portfolio-allocation-draft-v2')))
    .toContain('500000');
  await page.reload();
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  await expect(page.getByLabel('인덱스 금액')).toHaveValue('100000');

  await page.getByRole('button', { name: '취소' }).click();
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /인덱스.*60%/ }))
    .toBeVisible();
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
  await expect(page.getByRole('heading', { name: '안정 100%' })).toBeVisible();
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /현금.*100%/ }))
    .toBeVisible();
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
    localStorage.setItem('isf-portfolio-allocation-v2', JSON.stringify({
      schemaVersion: 2,
      items: [{
        id: 'index', name: '인덱스', shareUnits: 600_000, order: 0,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
      cashShareUnits: 400_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 200_000,
      appliedAt: 1,
      updatedAt: 1,
    }));
  }, { fixture: mainFixture });
  await page.goto('apps/portfolio/');
  const summary = page.locator('.portfolio-summary');
  await expect(page.getByRole('heading', { name: '안정 60%' })).toBeVisible();
  await expect(summary.getByRole('listitem').filter({ hasText: /현금.*60%/ })).toBeVisible();
  await expect(summary.getByRole('listitem').filter({ hasText: /인덱스.*40%/ })).toBeVisible();
  await expect(summary).not.toContainText('원');
});

test('gates zero investment and focuses Main investment editing', async ({ page }) => {
  await seedMain(page, 0);
  await page.goto('apps/portfolio/');
  await expect(page.getByTestId('portfolio-gated-content')).toHaveClass(/portfolio-content--blurred/);
  await page.getByRole('link', { name: 'Main에서 투자금 설정' }).click();
  await expect(page).toHaveURL(/apps\/main\/$/);
  await expect(page.getByLabel('월 투자액')).toBeFocused();
});

test('keeps the summary-first ratio list usable across required widths', async ({ page }) => {
  await page.addInitScript(({ fixture }) => {
    localStorage.setItem('isf-main-v2', JSON.stringify(fixture));
    localStorage.setItem('isf-portfolio-allocation-v2', JSON.stringify({
      schemaVersion: 2,
      items: [{
        id: 'index', name: '인덱스', shareUnits: 600_000, order: 0,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
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
    const summary = page.locator('.portfolio-summary');
    await expect(summary).toHaveClass(/ui-surface/);
    await expect(page.getByRole('heading', { name: '안정 40%' })).toBeVisible();
    await expect(summary.getByRole('listitem').filter({ hasText: /인덱스.*60%/ })).toBeVisible();
    await expect(summary.getByRole('listitem').filter({ hasText: /현금.*40%/ })).toBeVisible();
    await expect(page.getByLabel('투자 배분 도넛')).toHaveCount(0);
    await expect(page.getByRole('table')).toHaveCount(0);
    await expect(page.getByRole('tooltip')).toHaveCount(0);
    expect(await summary.evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe('0px');
    const edit = page.getByRole('button', { name: '배분 수정' });
    const editBox = await edit.boundingBox();
    expect(editBox).not.toBeNull();
    expect(editBox!.width).toBeGreaterThanOrEqual(44);
    expect(editBox!.height).toBeGreaterThanOrEqual(44);
    await edit.focus();
    await expect(edit).toBeFocused();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    expect(await summary.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const fill = summary.locator('.portfolio-allocation-row__fill').first();
    const track = summary.locator('.portfolio-allocation-row__track').first();
    const [fillBox, trackBox] = await Promise.all([fill.boundingBox(), track.boundingBox()]);
    expect(fillBox).not.toBeNull();
    expect(trackBox).not.toBeNull();
    expect(fillBox!.width / trackBox!.width).toBeCloseTo(0.6, 1);
  }
});

test('contains the mobile editor, apply bar, and confirmation dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  const rowBox = await page.locator('.portfolio-editor__row').first().boundingBox();
  expect(rowBox).not.toBeNull();
  expect(rowBox!.x).toBeGreaterThanOrEqual(16);
  expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(374);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

  const assertContained = async (locator: Locator) => {
    const box = await locator.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(16);
    expect(box!.x + box!.width).toBeLessThanOrEqual(374);
  };

  await assertContained(page.getByRole('complementary', { name: '배분 변경' }));
  await page.getByRole('button', { name: '적용' }).click();
  await assertContained(page.getByRole('dialog', { name: '투자 배분 적용' }));
});

test('keeps the final mobile editor control above the save-error apply bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'isf-portfolio-allocation-draft-v2') {
        throw new DOMException('Portfolio draft writes are blocked for this test', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    };
  });

  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  const applyBar = page.getByRole('complementary', { name: '배분 변경' });
  await expect(applyBar.getByRole('alert')).toContainText('저장하지 못했습니다');
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));

  const finalControl = page.locator(
    '.portfolio-editor button:visible, .portfolio-editor input:visible',
  ).last();
  const finalControlBox = await finalControl.boundingBox();
  const applyBarBox = await applyBar.boundingBox();
  expect(finalControlBox).not.toBeNull();
  expect(applyBarBox).not.toBeNull();
  expect(finalControlBox!.y + finalControlBox!.height).toBeLessThanOrEqual(applyBarBox!.y);
});

test('uses a single editor column at 768px', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  expect(await page.locator('.portfolio-editor__row').first().evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )).toBe(1);
});
