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
      items: [{
        id: 'index', name: '인덱스', shareUnits: 600_000, order: 0,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
      cashShareUnits: 400_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 200_000,
      appliedAt: 1,
      updatedAt: 1,
    }, {
      schemaVersion: 2,
      scope: { type: 'location', locationId: 'loc-isa' },
      items: [{
        id: 'location-index', name: 'ISA 인덱스', shareUnits: 500_000, order: 0,
        classification: 'growth', classificationOrigin: 'automatic',
      }],
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

async function seedSourceVisualPortfolio(page: Page): Promise<void> {
  await page.addInitScript(({ fixture }) => {
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
      applied: { ...fixture, monthlyInvestmentWon: 800_000 },
      setupProgress: null,
    };
    workspace.portfolio = { plans: [{
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [{
        id: 'global-index', name: '글로벌 인덱스', shareUnits: 500_000, order: 1,
        classification: 'growth', classificationOrigin: 'automatic',
      }, {
        id: 'bond', name: '채권', shareUnits: 250_000, order: 2,
        classification: 'stable', classificationOrigin: 'automatic',
      }, {
        id: 'gold', name: '금', shareUnits: 150_000, order: 0,
        classification: 'stable', classificationOrigin: 'automatic',
      }],
      cashShareUnits: 100_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 800_000,
      appliedAt: 1,
      updatedAt: 1,
    }], draft: null };
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
  }, { fixture: mainFixture });
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
  const targetSheet = page.getByRole('dialog', { name: '투자 대상 추가' });
  await targetSheet.getByLabel('투자 대상 이름').fill('미국 인덱스');
  await targetSheet.getByLabel('금액').fill('120000');
  await targetSheet.getByRole('button', { name: '완료' }).click();
  await expect(page.getByRole('region', { name: '현금' })).toContainText('80,000원');
  await expect(page.getByRole('region', { name: '현금' })).toContainText('40%');
  await page.getByRole('button', { name: '배분 확인' }).click();
  const review = page.getByRole('region', { name: '배분 검토' });
  await expect(review).toContainText('120,000원');
  await expect(review).toContainText('60%');
  await page.getByRole('button', { name: '이대로 시작' }).click();
  await expect(page.getByRole('button', { name: '배분 수정' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '안정 40%' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v1')!).portfolio.draft
  ))).toBeNull();
  await page.reload();
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /미국 인덱스.*60%/ }))
    .toBeVisible();
  await expect(page.locator('.portfolio-summary')).not.toContainText('120,000원');
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
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /인덱스.*60%/ }))
    .toBeVisible();
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
  let targetSheet = page.getByRole('dialog', { name: '투자 대상 추가' });
  await targetSheet.getByLabel('투자 대상 이름').fill('US INDEX');
  await targetSheet.getByLabel('금액').fill('50000');
  await targetSheet.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  targetSheet = page.getByRole('dialog', { name: '투자 대상 추가' });
  await targetSheet.getByLabel('투자 대상 이름').fill(' us   index ');
  await targetSheet.getByLabel('금액').fill('50000');

  await expect(targetSheet.getByLabel('투자 대상 이름'))
    .toHaveAccessibleDescription('같은 이름의 투자 대상이 이미 있습니다.');
  await expect(targetSheet.getByRole('button', { name: '완료' })).toBeDisabled();
});

test('puts a Main investment increase into cash', async ({ page }) => {
  await seedMain(page, 300_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  const summary = page.locator('.portfolio-summary');
  await expect(page.getByRole('heading', { name: '안정 60%' })).toBeVisible();
  await expect(summary.getByRole('listitem').filter({ hasText: /현금.*60%/ })).toBeVisible();
  await expect(summary.getByRole('listitem').filter({ hasText: /인덱스.*40%/ })).toBeVisible();
  await expect(summary).not.toContainText('원');
});

test('shows the source-state summary first and keeps view preferences separate', async ({ page }) => {
  await seedMain(page, 800_000);
  await seedSourceVisualPortfolio(page);
  await page.goto('apps/portfolio/');

  const summary = page.locator('.portfolio-summary');
  const summaryHeading = summary.getByRole('heading', { name: '안정 50%' });
  await expect(summaryHeading).toBeVisible();
  await expect(summaryHeading).not.toContainText('원');
  await expect(summary.getByText('글로벌 인덱스에 50%를 배분해요')).toBeVisible();
  const summaryRows = summary.getByRole('listitem');
  await expect(summaryRows).toHaveCount(4);
  for (const row of await summaryRows.all()) {
    await expect(row).not.toContainText('원');
  }

  await page.getByRole('button', { name: '관리 메뉴' }).click();
  await page.getByRole('switch', { name: '금액 보기' }).check();
  await expect(page.getByRole('heading', { name: '이번 달 투자금 800,000원' })).toBeVisible();
  await page.getByRole('radio', { name: '입력순' }).check();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('isf-portfolio-view-preferences-v1')))
    .toContain('"sortMode":"input"');
});

test('gates zero investment and focuses Main investment editing', async ({ page }) => {
  await seedMain(page, 0);
  await page.goto('apps/portfolio/');
  const frame = page.getByTestId('portfolio-page-frame');
  await expect(frame).toHaveClass(/app-content-frame/);
  await expect(frame.locator('.portfolio-content--blurred')).toHaveAttribute('inert');
  const link = frame.getByRole('link', { name: 'Main에서 투자금 설정' });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/apps\/main\/$/);
  await expect(page.getByLabel('월 투자액')).toBeFocused();
});

test('keeps the summary-first ratio list usable across required widths', async ({ page }) => {
  await seedMain(page, 800_000);
  await seedSourceVisualPortfolio(page);
  await page.addInitScript(() => {
    localStorage.removeItem('isf-portfolio-view-preferences-v1');
  });

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 900 },
    { width: 1280, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('apps/portfolio/');
    const frame = page.getByTestId('portfolio-page-frame');
    const frameBox = await frame.boundingBox();
    expect(frameBox).not.toBeNull();
    expect(frameBox!.x).toBeGreaterThanOrEqual(16);
    expect(frameBox!.width).toBeLessThanOrEqual(768);
    expect(Math.abs((viewport.width - frameBox!.width) / 2 - frameBox!.x)).toBeLessThan(1);
    const summary = page.locator('.portfolio-summary');
    await expect(summary).toHaveClass(/ui-surface/);
    await expect(page.getByRole('heading', { name: '안정 50%' })).toBeVisible();
    const summaryBox = await summary.boundingBox();
    expect(summaryBox).not.toBeNull();
    for (const [name, ratio] of [['글로벌 인덱스', '50%'], ['채권', '25%'], ['금', '15%'], ['현금', '10%']]) {
      const row = summary.getByRole('listitem').filter({ hasText: new RegExp(`${name}.*${ratio}`) });
      await expect(row).toBeVisible();
      const rowBox = await row.boundingBox();
      expect(rowBox).not.toBeNull();
      expect(rowBox!.x).toBeGreaterThanOrEqual(summaryBox!.x);
      expect(rowBox!.x + rowBox!.width).toBeLessThanOrEqual(summaryBox!.x + summaryBox!.width);
    }
    expect(await summary.locator('.portfolio-allocation-list')
      .evaluate((element) => getComputedStyle(element).borderRadius)).not.toBe('0px');
    const edit = page.getByRole('button', { name: '배분 수정' });
    const editBox = await edit.boundingBox();
    expect(editBox).not.toBeNull();
    expect(editBox!.width).toBeGreaterThanOrEqual(44);
    expect(editBox!.height).toBeGreaterThanOrEqual(44);
    const editIcon = edit.locator('img');
    await expect(editIcon).toHaveAttribute('src', '/IndividualSavingsFlowUI/icons/portfolio-edit.svg');
    expect(await editIcon.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0);
    await edit.focus();
    await expect(edit).toBeFocused();
    expect(await edit.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe('none');
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
    expect(await summary.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    if (viewport.width === 390) {
      const hero = summary.locator('.portfolio-summary__hero');
      const list = summary.locator('.portfolio-allocation-list');
      const [heroBox, listBox] = await Promise.all([hero.boundingBox(), list.boundingBox()]);
      expect(heroBox).not.toBeNull();
      expect(listBox).not.toBeNull();
      expect(listBox!.y - (heroBox!.y + heroBox!.height)).toBeGreaterThanOrEqual(24);
      expect(await summary.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe('rgba(0, 0, 0, 0)');
      expect(await list.evaluate((element) => getComputedStyle(element).backgroundColor))
        .toBe('rgb(255, 255, 255)');
      expect(Number.parseInt(await page.getByRole('heading', { name: '안정 50%' })
        .evaluate((element) => getComputedStyle(element).fontWeight), 10)).toBeGreaterThanOrEqual(700);
      const rows = summary.getByRole('listitem');
      await expect(rows).toHaveCount(4);
      for (const row of await rows.all()) {
        const rowBox = await row.boundingBox();
        expect(rowBox).not.toBeNull();
        expect(rowBox!.height).toBeGreaterThanOrEqual(100);
        expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(viewport.height);
      }
    }
    if (viewport.width === 1280) {
      expect(summaryBox!.width).toBeGreaterThanOrEqual(767);
      expect(summaryBox!.width).toBeLessThanOrEqual(768);
    }
    const fill = summary.locator('.portfolio-allocation-row__fill').first();
    const track = summary.locator('.portfolio-allocation-row__track').first();
    const [fillBox, trackBox] = await Promise.all([fill.boundingBox(), track.boundingBox()]);
    expect(fillBox).not.toBeNull();
    expect(trackBox).not.toBeNull();
    expect(fillBox!.width / trackBox!.width).toBeCloseTo(0.5, 1);

    await page.getByRole('button', { name: '관리 메뉴' }).click();
    const inputSort = page.getByRole('radio', { name: '입력순' });
    await inputSort.focus();
    await inputSort.check();
    await expect(inputSort).toBeFocused();
    await expect.poll(async () => summary.getByRole('listitem').evaluateAll((rows) => (
      rows.map((row) => row.querySelector('h2')?.textContent)
    ))).toEqual(['금', '글로벌 인덱스', '채권', '현금']);
    for (const row of await summary.getByRole('listitem').all()) {
      expect(await row.evaluate((element) => getComputedStyle(element).transform)).toBe('none');
    }
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
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

test('reflows a long Korean target name at a 200% desktop-zoom equivalent width', async ({ page }) => {
  await page.setViewportSize({ width: 640, height: 900 });
  await seedMain(page, 800_000);
  await page.addInitScript(({ fixture }) => {
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
      applied: { ...fixture, monthlyInvestmentWon: 800_000 },
      setupProgress: null,
    };
    workspace.portfolio = { plans: [{
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [{
        id: 'long-name',
        name: '전 세계 소형주 가치주 지수를 따르는 장기 투자 대상',
        shareUnits: 900_000,
        order: 0,
        classification: 'growth',
        classificationOrigin: 'user',
      }],
      cashShareUnits: 100_000,
      cashMode: 'automatic',
      syncedInvestmentWon: 800_000,
      appliedAt: 1,
      updatedAt: 1,
    }], draft: null };
    localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
  }, { fixture: mainFixture });
  await page.goto('apps/portfolio/');

  const row = page.locator('.portfolio-allocation-row').first();
  const name = row.locator('.portfolio-allocation-row__name');
  const ratio = row.locator('.portfolio-allocation-row__ratio');
  const [nameBox, ratioBox] = await Promise.all([name.boundingBox(), ratio.boundingBox()]);
  expect(nameBox).not.toBeNull();
  expect(ratioBox).not.toBeNull();
  expect(nameBox!.x + nameBox!.width).toBeLessThanOrEqual(ratioBox!.x);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  expect(await row.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
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

test('contains the focused target sheet at 768px', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  const sheet = page.getByRole('dialog', { name: '투자 대상 추가' });
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(768);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
});

test('protects dirty mobile target input and reuses the sheet for editing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  let sheet = page.getByRole('dialog', { name: '투자 대상 추가' });
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(390);
  expect(await sheet.evaluate((dialog) => dialog.matches(':modal'))).toBe(true);
  const quickNames = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'];
  const quickTargetY = new Set<number>();
  for (const name of quickNames) {
    const quickFill = sheet.getByRole('button', { name, exact: true });
    await expect(quickFill).toBeVisible();
    const quickFillBox = await quickFill.boundingBox();
    expect(quickFillBox).not.toBeNull();
    expect(quickFillBox!.height).toBeGreaterThanOrEqual(44);
    quickTargetY.add(Math.round(quickFillBox!.y));
  }
  expect(quickTargetY.size).toBeGreaterThan(1);
  await sheet.getByRole('button', { name: '미국 국채', exact: true }).click();
  await expect(sheet.getByLabel('투자 대상 이름')).toHaveValue('미국 국채');
  await expect(sheet.getByLabel('금액')).toBeFocused();
  expect(await sheet.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await sheet.getByLabel('투자 대상 이름').fill('미국 인덱스');

  await page.mouse.click(10, 100);
  let discard = page.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: '계속 입력' }).click();
  await expect(sheet.getByLabel('투자 대상 이름')).toHaveValue('미국 인덱스');

  await page.mouse.click(10, 100);
  discard = page.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
  await discard.getByRole('button', { name: '버리기' }).click();
  await expect(sheet).not.toBeVisible();

  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  sheet = page.getByRole('dialog', { name: '투자 대상 추가' });
  await sheet.getByLabel('투자 대상 이름').fill('미국 인덱스');
  await sheet.getByLabel('금액').fill('120000');
  await sheet.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '미국 인덱스 편집, 120,000원, 60%' }).click();

  const editSheet = page.getByRole('dialog', { name: '투자 대상 수정' });
  await expect(editSheet).toHaveClass(/portfolio-item-sheet/);
  await expect(editSheet.getByRole('button', { name: '투자 대상 삭제' })).toBeVisible();
  await expect(editSheet.getByRole('button', { name: 'S&P 500', exact: true })).toHaveCount(0);
  await expect(editSheet.getByRole('button', { name: '취소' })).toBeVisible();
  await expect(editSheet.getByRole('button', { name: '완료' })).toBeVisible();
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  await editSheet.getByRole('button', { name: '투자 대상 삭제' }).click();
  await expect(editSheet).not.toBeVisible();
  await expect(page.getByRole('button', { name: '미국 인덱스 편집, 120,000원, 60%' })).toHaveCount(0);
});

for (const viewport of [
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
]) {
  test(`contains target shortcuts at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await seedMain(page, 200_000);
    await page.goto('apps/portfolio/');
    await enterFirstSetupAllocation(page);
    await page.getByRole('button', { name: '투자 대상 추가' }).click();

    const sheet = page.getByRole('dialog', { name: '투자 대상 추가' });
    for (const name of ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물']) {
      const quickFillBox = await sheet.getByRole('button', { name, exact: true }).boundingBox();
      expect(quickFillBox).not.toBeNull();
      expect(quickFillBox!.height).toBeGreaterThanOrEqual(44);
    }
    await expect(sheet.getByRole('button', { name: '취소' })).toBeVisible();
    await expect(sheet.getByRole('button', { name: '완료' })).toBeVisible();
    expect(await sheet.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  });
}
test('does not expose account or custody management and preserves dormant location data', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  const preservedBefore = await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return {
      locations: workspace.locations,
      locationPlans: workspace.portfolio.plans.filter(
        (plan: { scope: { type: string } }) => plan.scope.type === 'location',
      ),
    };
  });
  await expect(page.getByText(/투자 위치/)).toHaveCount(0);
  await expect(page.getByText(/계좌·보관처/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /위치|계좌|보관처/ })).toHaveCount(0);

  await page.getByRole('button', { name: '배분 수정' }).click();
  await page.getByLabel('인덱스 금액').fill('100000');
  await page.getByLabel('인덱스 금액').blur();
  await page.getByRole('button', { name: '적용' }).click();
  await page.getByRole('dialog', { name: '투자 배분을 적용할까요?' })
    .getByRole('button', { name: '배분 적용' }).click();
  await expect(page.getByRole('button', { name: '배분 수정' })).toBeVisible();

  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return workspace.portfolio.plans.find(
      (plan: { scope: { type: string } }) => plan.scope.type === 'aggregate',
    )?.items[0].shareUnits;
  })).toBe(500_000);

  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v1')!);
    return {
      locations: workspace.locations,
      locationPlans: workspace.portfolio.plans.filter(
        (plan: { scope: { type: string } }) => plan.scope.type === 'location',
      ),
    };
  })).toEqual(preservedBefore);
});
