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
const oldMainRaw = JSON.stringify({ ...mainFixture, monthlyInvestmentWon: 990_000 });
const oldPortfolioAppliedRaw = JSON.stringify({
  schemaVersion: 1,
  items: [{ id: 'old', name: '이전 키', shareUnits: 1_000_000, order: 0 }],
  cashShareUnits: 0,
  cashMode: 'automatic',
  syncedInvestmentWon: 990_000,
  appliedAt: 9,
  updatedAt: 9,
});
const oldPortfolioDraftRaw = '{old-portfolio-draft';

async function seedMain(page: Page, monthlyInvestmentWon: number): Promise<void> {
  await page.addInitScript(({ fixture, investment, seededOldMain, seededOldApplied, seededOldDraft }) => {
    if (sessionStorage.getItem('isf-portfolio-main-seeded') !== null) return;
    const stored = localStorage.getItem('isf-workspace-v1');
    const workspace = stored === null ? {
      schemaVersion: 1,
      revision: 1,
      updatedAt: fixture.updatedAt,
      main: { applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    } : JSON.parse(stored);
    workspace.main = {
      applied: { ...fixture, monthlyInvestmentWon: investment },
      setupProgress: null,
    };
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    localStorage.setItem('isf-main-v2', seededOldMain);
    localStorage.setItem('isf-portfolio-allocation-v1', seededOldApplied);
    localStorage.setItem('isf-portfolio-allocation-draft-v1', seededOldDraft);
    sessionStorage.setItem('isf-portfolio-main-seeded', 'true');
  }, {
    fixture: mainFixture,
    investment: monthlyInvestmentWon,
    seededOldMain: oldMainRaw,
    seededOldApplied: oldPortfolioAppliedRaw,
    seededOldDraft: oldPortfolioDraftRaw,
  });
}

async function seedAppliedPortfolio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('isf-portfolio-applied-seeded') !== null) return;
    const stored = localStorage.getItem('isf-workspace-v1');
    const workspace = stored === null ? {
      schemaVersion: 1,
      revision: 1,
      updatedAt: 1,
      main: { applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    } : JSON.parse(stored);
    workspace.locations = [{
      id: 'loc-isa',
      shortName: 'ISA',
      kind: 'brokerage',
      roles: ['investing'],
      createdAt: 1,
      updatedAt: 1,
    }];
    workspace.portfolio = { plans: [{
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [{ id: 'index', name: '인덱스', shareUnits: 600_000, order: 0 }],
      cashShareUnits: 400_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 200_000,
      appliedAt: 1,
      updatedAt: 1,
    }, {
      schemaVersion: 2,
      scope: { type: 'location', locationId: 'loc-isa' },
      items: [{ id: 'location-index', name: 'ISA 인덱스', shareUnits: 500_000, order: 0 }],
      cashShareUnits: 500_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 200_000,
      appliedAt: 1,
      updatedAt: 1,
    }], draft: null };
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    sessionStorage.setItem('isf-portfolio-applied-seeded', 'true');
  });
}

async function enterFirstSetupAllocation(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /매달 .*원을 어디에 투자할까요\?/ })).toBeVisible();
  await page.getByRole('button', { name: '배분 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
}

test('creates one allocation and revisits result-first', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.addInitScript(() => {
    localStorage.setItem('isf-step3-portfolios-v2', '{"legacy":"plans"}');
    localStorage.setItem('isf-step3-snapshots-v1', '{"legacy":"snapshots"}');
  });
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  const mainBefore = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).main
  ));
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByLabel('투자 대상 이름 1').fill('미국 인덱스');
  await page.getByLabel('미국 인덱스 금액').fill('120000');
  await page.getByLabel('미국 인덱스 금액').blur();
  await expect(page.getByRole('region', { name: '현금' })).toContainText('80,000원');
  await expect(page.getByRole('region', { name: '현금' })).toContainText('40%');
  await page.getByRole('button', { name: '다음' }).click();
  await page.getByRole('button', { name: '배분 시작' }).click();
  await expect(page.getByRole('button', { name: '배분 수정' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).portfolio.draft
  ))).toBeNull();
  await page.reload();
  await expect(page.getByRole('row', { name: /미국 인덱스.*120,000원.*60%/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => ({
    workspace: JSON.parse(localStorage.getItem('isf-workspace-v1')!),
    oldMain: localStorage.getItem('isf-main-v2'),
    oldApplied: localStorage.getItem('isf-portfolio-allocation-v1'),
    oldDraft: localStorage.getItem('isf-portfolio-allocation-draft-v1'),
    legacyPlans: localStorage.getItem('isf-step3-portfolios-v2'),
    legacySnapshots: localStorage.getItem('isf-step3-snapshots-v1'),
  }))).toMatchObject({
    workspace: {
      main: mainBefore,
      portfolio: {
        plans: [{
          scope: { type: 'aggregate' },
          items: [{ name: '미국 인덱스' }],
        }],
        draft: null,
      },
    },
    oldMain: oldMainRaw,
    oldApplied: oldPortfolioAppliedRaw,
    oldDraft: oldPortfolioDraftRaw,
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
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).portfolio.draft?.items[0]?.shareUnits
  ))).toBe(500_000);
  await page.reload();
  await expect(page.getByRole('heading', { name: '투자 배분 수정' })).toBeVisible();
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
  await expect(page.getByRole('dialog', { name: '투자 배분을 적용할까요?' })
    .getByRole('button', { name: '배분 적용' })).toBeDisabled();
  await page.getByRole('button', { name: '계속 수정' }).click();
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
  await expect(page.getByRole('heading', { name: /매달 .*원을 어디에 투자할까요\?/ })).toBeVisible();
  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return {
      plans: workspace.portfolio.plans,
      draft: workspace.portfolio.draft,
      oldApplied: localStorage.getItem('isf-portfolio-allocation-v1'),
      oldDraft: localStorage.getItem('isf-portfolio-allocation-draft-v1'),
    };
  })).toEqual({
    plans: [expect.objectContaining({ scope: { type: 'location', locationId: 'loc-isa' } })],
    draft: null,
    oldApplied: oldPortfolioAppliedRaw,
    oldDraft: oldPortfolioDraftRaw,
  });
});

test('explains duplicate names and blocks confirmation until corrected', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  await page.getByLabel('투자 대상 이름 1').fill('US INDEX');
  await page.getByLabel('투자 대상 이름 2').fill(' us   index ');

  await expect(page.getByLabel('투자 대상 이름 1'))
    .toHaveAccessibleDescription('같은 이름의 투자 대상이 이미 있습니다.');
  await expect(page.getByRole('button', { name: '다음' })).toBeDisabled();
});

test('puts a Main investment increase into cash', async ({ page }) => {
  await seedMain(page, 300_000);
  await seedAppliedPortfolio(page);
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
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);

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
    await expect(page.locator('.portfolio-table-wrap')).toBeVisible();
    const summary = page.locator('.portfolio-summary');
    await expect(summary).toHaveClass(/ui-surface/);
    expect(await summary.evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe('0px');
    for (const control of await page.locator('.portfolio-content button:visible, .portfolio-content input:visible').all()) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
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

test('contains the mobile editor, apply bar, and confirmation dialog', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '배분 수정' }).click();
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
  await assertContained(page.getByRole('dialog', { name: '투자 배분을 적용할까요?' }));
});

test('isolates applied editing as a sheet or panel and restores focus', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);

  for (const viewport of [
    { width: 390, mode: 'sheet' },
    { width: 768, mode: 'sheet' },
    { width: 1280, mode: 'panel' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: 900 });
    await page.goto('apps/portfolio/');
    const trigger = page.getByRole('button', { name: '배분 수정' });
    await trigger.click();
    const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
    await expect(editor).toHaveAttribute('data-presentation', viewport.mode);
    await expect(page.getByTestId('portfolio-result-controls')).toHaveAttribute('inert', '');
    await expect(page.getByRole('region', { name: '투자 위치' })).toHaveCount(0);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(editor).not.toBeVisible();
    await expect(trigger).toBeFocused();
  }
});

test('keeps the final mobile editor control above the save-error apply bar', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  await page.getByRole('button', { name: '배분 수정' }).click();
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'isf-workspace-v1') {
        throw new DOMException('Portfolio draft writes are blocked for this test', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    };
  });

  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  const applyBar = page.getByRole('complementary', { name: '배분 변경' });
  await expect(applyBar.getByRole('alert')).toContainText('저장하지 못했습니다');
  await page.locator('.portfolio-edit-surface').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });

  const finalControl = page.locator(
    '.portfolio-editor button:visible, .portfolio-editor input:visible',
  ).last();
  await finalControl.scrollIntoViewIfNeeded();
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
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  expect(await page.locator('.portfolio-editor__row').first().evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.split(' ').length,
  )).toBe(1);
});

test('keeps the final animated pointer tooltip inside the viewport gutter', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedAppliedPortfolio(page);
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');

  const segment = page.getByRole('button', { name: /인덱스.*120,000원.*60%/ });
  await segment.dispatchEvent('pointerover', { clientX: 389, clientY: 843, pointerType: 'mouse' });
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toBeVisible();
  await tooltip.evaluate(async (element) => {
    await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => undefined)));
  });

  const box = await tooltip.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(16);
  expect(box!.y).toBeGreaterThanOrEqual(16);
  expect(box!.x + box!.width).toBeLessThanOrEqual(374);
  expect(box!.y + box!.height).toBeLessThanOrEqual(828);
});

test('creates and preserves a contained shared investment location at required widths', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  const locationName = '해외투자12AB';
  const aggregateTask = page.getByRole('heading', { name: '투자금 200,000원' });
  const locationTask = page.getByRole('heading', { name: '투자 위치', exact: true });
  expect(await aggregateTask.evaluate((aggregate, location) => (
    Boolean(aggregate.compareDocumentPosition(location as Node) & Node.DOCUMENT_POSITION_FOLLOWING)
  ), await locationTask.elementHandle())).toBe(true);
  await page.getByLabel('짧은 이름').fill(locationName);
  await expect(page.getByText('8/8자')).toBeVisible();
  await page.getByLabel('형태').selectOption('brokerage');
  await page.getByLabel('기관 (선택)').fill('미래에셋');
  await page.getByRole('button', { name: '투자 위치 추가' }).click();

  await expect(page.getByText(locationName, { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '아직 배분하지 않음' })).toBeDisabled();
  await expect.poll(() => page.evaluate((name) => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return workspace.locations.find((location: { shortName: string }) => (
      location.shortName === name
    ));
  }, locationName)).toMatchObject({
    shortName: locationName,
    institution: { name: '미래에셋' },
    roles: ['investing'],
  });

  await page.reload();
  await expect(page.getByText(locationName, { exact: true })).toBeVisible();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole('region', { name: '투자 위치' })).toBeVisible();
    await expect(page.getByText(locationName, { exact: true })).toBeVisible();
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    for (const control of await page.locator(
      '.portfolio-locations button:visible, .portfolio-locations input:visible, .portfolio-locations select:visible',
    ).all()) {
      const box = await control.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  }

  await page.getByRole('button', { name: `${locationName} 보관하기` }).click();
  await expect(page.getByRole('button', { name: `${locationName} 보관하기` })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '투자 위치', exact: true })).toBeFocused();
});

test('returns keyboard focus to an investment-location rename trigger after cancel and save', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  const originalTrigger = page.getByRole('button', { name: 'ISA 이름 바꾸기' });
  await originalTrigger.focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: '취소' }).focus();
  await page.keyboard.press('Enter');
  await expect(originalTrigger).toBeFocused();

  await page.keyboard.press('Enter');
  await page.getByLabel('ISA 새 이름').fill('연금 ISA');
  await page.getByRole('button', { name: '이름 저장' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: '연금 ISA 이름 바꾸기' })).toBeFocused();
});

test('links an existing non-investing shared identity without duplicating its ID', async ({ page }) => {
  await page.addInitScript((fixture) => {
    localStorage.setItem('isf-workspace-v1', JSON.stringify({
      schemaVersion: 1,
      revision: 1,
      updatedAt: fixture.updatedAt,
      main: { applied: fixture, setupProgress: null },
      simulation: { draft: null },
      portfolio: {
        plans: [{
          schemaVersion: 2,
          scope: { type: 'aggregate' },
          items: [{ id: 'index', name: '인덱스', shareUnits: 600_000, order: 0 }],
          cashShareUnits: 400_000,
          cashMode: 'automatic',
          syncedInvestmentWon: 200_000,
          appliedAt: 1,
          updatedAt: 1,
        }],
        draft: null,
      },
      locations: [{
        id: 'shared-toss-isa',
        shortName: 'Toss ISA',
        kind: 'brokerage',
        roles: ['saving'],
        createdAt: 1,
        updatedAt: 1,
      }],
      accountMap: { applied: null, draft: null, instruments: [], flows: [] },
    }));
  }, mainFixture);
  await page.goto('apps/portfolio/');
  await page.getByLabel('짧은 이름').fill('toss isa');

  await page.getByRole('button', { name: '투자 위치 추가' }).click();
  await expect(page.getByText('Toss ISA 공유 위치를 투자 위치로 연결할 수 있습니다.'))
    .toBeVisible();
  const link = page.getByRole('button', { name: '기존 위치 연결' });
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  }
  await link.click();

  await expect(page.getByText('Toss ISA', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return workspace.locations;
  })).toEqual([expect.objectContaining({
    id: 'shared-toss-isa',
    roles: ['saving', 'investing'],
  })]);
});

test('confirms linked location archival with preservation as the accessible default', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  const archiveTrigger = page.getByRole('button', { name: 'ISA 보관하기' });
  await expect(page.getByRole('button', { name: '배분 데이터 있음' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '아직 배분하지 않음' })).toHaveCount(0);

  await archiveTrigger.click();

  const dialog = page.getByRole('dialog', { name: 'ISA 위치를 보관할까요?' });
  await expect(dialog.getByRole('radio', { name: 'Portfolio 데이터 유지' })).toBeChecked();
  await expect(dialog.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(archiveTrigger).toBeFocused();

  await archiveTrigger.click();
  await dialog.getByRole('button', { name: '보관' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'ISA 보관하기' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: '투자 위치', exact: true })).toBeFocused();
  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return {
      archivedAt: workspace.locations[0]?.archivedAt,
      scopes: workspace.portfolio.plans.map((plan: { scope: unknown }) => plan.scope),
    };
  })).toEqual({
    archivedAt: expect.any(Number),
    scopes: [
      { type: 'aggregate' },
      { type: 'location', locationId: 'loc-isa' },
    ],
  });
});

test('reconciles external location changes and contains stale controls at required widths', async ({ page, context }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  const external = await context.newPage();
  await external.goto('/');

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
      workspace.locations = [{
        id: 'loc-isa',
        shortName: 'ISA',
        kind: 'brokerage',
        roles: ['investing'],
        createdAt: 1,
        updatedAt: workspace.updatedAt + 1,
      }];
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    });
    await page.reload();

    await page.getByRole('button', { name: 'ISA 이름 바꾸기' }).click();
    const renameForm = page.locator('.portfolio-locations__rename');
    await expect(renameForm).toBeVisible();
    const renameBox = await renameForm.boundingBox();
    expect(renameBox).not.toBeNull();
    expect(renameBox!.x).toBeGreaterThanOrEqual(16);
    expect(renameBox!.x + renameBox!.width).toBeLessThanOrEqual(viewport.width - 16);
    await external.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
      workspace.revision += 1;
      workspace.updatedAt += 1;
      workspace.locations[0].shortName = '외부 ISA';
      workspace.locations[0].updatedAt += 1;
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    });
    await expect(page.getByLabel('외부 ISA 새 이름')).toHaveValue('외부 ISA');
    await renameForm.getByRole('button', { name: '취소' }).click();

    await page.getByRole('button', { name: '외부 ISA 보관하기' }).click();
    const dialog = page.getByRole('dialog', { name: '외부 ISA 위치를 보관할까요?' });
    await expect(dialog).toBeVisible();
    const dialogBox = await dialog.boundingBox();
    expect(dialogBox).not.toBeNull();
    expect(dialogBox!.x).toBeGreaterThanOrEqual(16);
    expect(dialogBox!.x + dialogBox!.width).toBeLessThanOrEqual(viewport.width - 16);
    for (const button of await dialog.getByRole('button').all()) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

    await external.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
      workspace.revision += 1;
      workspace.updatedAt += 1;
      workspace.locations[0].roles = ['saving'];
      workspace.locations[0].updatedAt += 1;
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    });
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('alert'))
      .toContainText('다른 화면에서 위치가 변경되어 작업을 닫았습니다.');
    await expect(page.getByRole('heading', { name: '투자 위치', exact: true })).toBeFocused();
  }

  await external.close();
});
