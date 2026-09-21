import { expect, test, type Locator, type Page } from '@playwright/test';

for (const entry of ['setup', 'edit']) {
  test(`replaces stale cash input when a sample fills the ${entry} draft`, async ({ page }) => {
    await seedMain(page, 200_000);
    if (entry === 'edit') await seedAppliedPortfolio(page);
    await page.goto('apps/portfolio/');
    if (entry === 'edit') await page.getByRole('button', { name: '인덱스', exact: true }).click();
    else await enterFirstSetupAllocation(page);
    await page.getByRole('button', { name: /현금.*남은 금액 자동 배분/ }).click();
    await page.getByLabel('현금 금액').fill('900000');
    await page.getByLabel('현금 금액').blur();
    await expect(page.getByLabel('현금 금액')).toHaveAttribute('aria-invalid', 'true');
    await page.getByRole('button', { name: '샘플로 구성하기', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '샘플로 구성하기' });
    await picker.getByRole('button', { name: 'VOO 70 · 금 30' }).click();
    await picker.getByRole('button', { name: '이 구성으로 초안 채우기' }).click();
    if (entry === 'edit') await picker.getByRole('button', { name: '초안 바꾸기' }).click();
    await expect(page.getByRole('button', { name: entry === 'edit' ? '적용' : '배분 확인', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });
}

test('opens a requested return preset without changing the draft', async ({ page }) => {
  await seedMain(page, 800_000);
  await page.goto('apps/portfolio/?samplePreset=5&keep=1#portfolio');

  const picker = page.getByRole('dialog', { name: '샘플로 구성하기' });
  await expect(picker).toBeVisible();
  await expect(picker.getByRole('heading', { name: 'SCHD 50 · 금 50' })).toBeVisible();
  await expect(picker.locator('.portfolio-example-picker__preview')).toContainText('SCHD50%');
  await expect(picker.locator('.portfolio-example-picker__preview')).toContainText('금(GOLD)50%');
  expect(new URL(page.url()).search).toBe('?keep=1');
  expect(new URL(page.url()).hash).toBe('#portfolio');
  await picker.getByRole('button', { name: '배분 편집', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(page.getByRole('button', { name: '배분 확인', exact: true })).toBeVisible();
});

test('opens the requested preset inside an existing Portfolio edit session', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/?samplePreset=9');

  const editor = page.locator('dialog.portfolio-edit-surface');
  const picker = page.getByRole('dialog', { name: '샘플로 구성하기' });
  await expect(editor).toBeVisible();
  await expect(picker.getByRole('heading', { name: 'QQQM 70 · SCHD 30' })).toBeVisible();
  expect(new URL(page.url()).search).toBe('');
  await picker.getByRole('button', { name: '배분 편집', exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(editor.getByRole('button', { name: /샘플로 구성하기/ })).toBeVisible();
});

for (const viewport of [
  { width: 390, height: 844 }, { width: 390, height: 600 },
  { width: 768, height: 1024 }, { width: 1024, height: 600 },
  { width: 1280, height: 720 }, { width: 1440, height: 900 },
]) {
  test(`browses every sample and applies adjusted ratios at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedMain(page, 200_000);
    await seedAppliedPortfolio(page);
    await page.goto('apps/portfolio/');
    await page.getByRole('button', { name: '인덱스', exact: true }).click();
    await page.getByRole('button', { name: '샘플로 구성하기', exact: true }).click();
    const picker = page.getByRole('dialog', { name: '샘플로 구성하기' });
    await expect(picker.getByRole('heading', { name: '샘플로 구성하기' })).toHaveCount(1);
    await expect(picker.getByRole('button', { name: '돌아가기', exact: true })).toHaveCount(0);
    for (const name of ['SCHD 70 · 금 30', 'JEPQ 70 · 금 30', 'VOO 70 · 금 30', 'QQQM 70 · SCHD 30',
      'QLD 50 · SCHD 30 · 금 20', 'QLD 70 · SCHD 20 · 금 10', 'QLD 50 · BTC 30 · 금 20']) {
      await picker.getByRole('button', { name, exact: true }).click();
      await expect(picker.getByRole('button', { name: '이 구성으로 초안 채우기' })).toBeInViewport();
      if (viewport.width < 1100) await picker.getByRole('button', { name: '샘플 목록' }).click();
    }
    await picker.getByRole('button', { name: 'VOO 70 · 금 30', exact: true }).click();
    await picker.getByRole('button', { name: '주력 비율 5% 높이기' }).click();
    if (viewport.width < 1100) {
      await page.keyboard.press('Escape');
      await expect(picker.getByRole('button', { name: 'VOO 70 · 금 30', exact: true })).toBeFocused();
      await picker.getByRole('button', { name: 'VOO 70 · 금 30', exact: true }).click();
      await expect(picker.getByRole('slider', { name: '주력 자산 비율' })).toHaveValue('75');
    }
    await picker.getByRole('button', { name: '이 구성으로 초안 채우기' }).click();
    await expect(picker.getByRole('heading', { name: '현재 초안을 이 구성으로 바꿀까요?' })).toBeInViewport();
    await expect(picker.getByRole('button', { name: '초안 바꾸기' })).toBeInViewport();
    expect(await picker.evaluate(e => e.scrollWidth <= e.clientWidth)).toBe(true);
    await picker.getByRole('button', { name: '초안 바꾸기' }).click();
    const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
    await expect(editor.getByRole('button', { name: /VOO 편집.*75%/ })).toBeVisible();
    await expect(page.locator('.portfolio-summary')).toContainText('인덱스');
    await editor.getByRole('button', { name: '적용', exact: true }).click();
    await page.getByRole('button', { name: '배분 적용', exact: true }).click();
    await expect(page.locator('.portfolio-allocation-list')).toContainText('VOO75%');
  });
}

test('closes on outside clicks, preserves rejected changes, and restores the entry row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  const trigger = page.getByRole('button', { name: '인덱스', exact: true });
  await trigger.click();
  const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
  const bounds = await editor.boundingBox();
  await page.mouse.click(bounds!.x + 5, bounds!.y + 5);
  await expect(editor).toBeVisible();
  await page.mouse.click(40, 120);
  await expect(editor).toBeHidden();
  await expect(trigger).toBeFocused();
  await trigger.click();
  await editor.getByRole('button', { name: /인덱스 편집/ }).click();
  await page.getByLabel('금액', { exact: true }).fill('110000');
  await page.getByRole('button', { name: '완료', exact: true }).click();
  await page.mouse.click(40, 120);
  const discard = page.getByRole('dialog', { name: '변경사항을 버릴까요?' });
  await discard.getByRole('button', { name: '계속 수정' }).click();
  await expect(editor.getByRole('button', { name: /인덱스 편집.*110,000원/ })).toBeVisible();
  await page.mouse.click(40, 120);
  await discard.getByRole('button', { name: '변경 버리기' }).click();
  await expect(trigger).toBeFocused();
  await expect(page.locator('.portfolio-allocation-list')).toContainText('인덱스60%');
});

test('toggles every result amount immediately and retains the preference after reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 800_000);
  await seedSourceVisualPortfolio(page);
  await page.goto('apps/portfolio/');
  const rows = page.locator('.portfolio-allocation-list');
  await expect(rows.locator('.portfolio-allocation-row__amount')).toHaveCount(0);
  await page.getByRole('button', { name: '관리 메뉴', exact: true }).click();
  await page.getByRole('switch', { name: '금액 보기' }).check();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: '관리 메뉴' })).toBeHidden();
  for (const amount of ['400,000원', '200,000원', '120,000원', '80,000원']) {
    await expect(rows.getByText(amount, { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(rows.locator('.portfolio-allocation-row__amount')).toHaveCount(4);
  await page.getByRole('button', { name: '관리 메뉴', exact: true }).click();
  await page.getByRole('switch', { name: '금액 보기' }).uncheck();
  await expect(rows.locator('.portfolio-allocation-row__amount')).toHaveCount(0);
  await expect(page.getByText('이번 달 투자금 800,000원')).toHaveCount(0);
});

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
    if (sessionStorage.getItem('isf-portfolio-main-seeded') !== null) return;
    const stored = localStorage.getItem('isf-workspace-v5');
    const workspace = stored === null ? {
      schemaVersion: 5,
      revision: 1,
      updatedAt: fixture.updatedAt,
      main: { expenseAssistant: null, applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null },
    } : JSON.parse(stored);
    workspace.main = { expenseAssistant: null,
      applied: { ...fixture, monthlyInvestmentWon: investment },
      setupProgress: null,
    };
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
    sessionStorage.setItem('isf-portfolio-main-seeded', 'true');
  }, {
    fixture: mainFixture,
    investment: monthlyInvestmentWon,
  });
}

async function seedAppliedPortfolio(page: Page): Promise<void> {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('isf-portfolio-applied-seeded') !== null) return;
    const stored = localStorage.getItem('isf-workspace-v5');
    const workspace = stored === null ? {
      schemaVersion: 5,
      revision: 1,
      updatedAt: 1,
      main: { expenseAssistant: null, applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null },
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
    }], draft: null };
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
    sessionStorage.setItem('isf-portfolio-applied-seeded', 'true');
  });
}

async function seedSourceVisualPortfolio(page: Page): Promise<void> {
  await page.addInitScript(({ fixture }) => {
    const stored = localStorage.getItem('isf-workspace-v5');
    const workspace = stored === null ? {
      schemaVersion: 5,
      revision: 1,
      updatedAt: fixture.updatedAt,
      main: { expenseAssistant: null, applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null },
    } : JSON.parse(stored);
    workspace.main = { expenseAssistant: null,
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
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
  }, { fixture: mainFixture });
}

async function enterFirstSetupAllocation(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /매달 .*원을 어디에 투자할까요\?/ })).toBeVisible();
  await page.getByRole('button', { name: '배분 시작하기' }).click();
  await expect(page.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
}

test('creates one allocation and revisits result-first', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  const mainBefore = await page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v5')!).main
  ));
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  const targetSheet = page.getByRole('region', { name: '투자 대상 추가' });
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
  await expect(page.locator('.portfolio-allocation-row__select').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: '안정 40%' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v5')!).portfolio.draft
  ))).toBeNull();
  await page.reload();
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /미국 인덱스.*60%/ }))
    .toBeVisible();
  await expect(page.locator('.portfolio-summary')).not.toContainText('120,000원');
  await expect(page.getByRole('link', { name: /투자 배분 \(Portfolio\).*현재 위치/ }))
    .toHaveAttribute('aria-current', 'page');
  expect(await page.evaluate(() => ({
    workspace: JSON.parse(localStorage.getItem('isf-workspace-v5')!),
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
  });
});

test('keeps setup navigation behind an open inline target form', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  const targetForm = page.getByRole('region', { name: '투자 대상 추가' });
  await targetForm.getByLabel('투자 대상 이름').fill('미국 인덱스');

  await expect(page.getByRole('button', { name: '배분 확인', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: '샘플로 구성하기', exact: true })).toBeDisabled();
  await page.keyboard.press('Escape');
  const discard = page.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
  await discard.getByRole('button', { name: '버리기' }).click();
  await expect(page.getByRole('button', { name: '배분 확인', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: '샘플로 구성하기', exact: true })).toBeEnabled();
});

test('starts from a sample without changing the applied plan until the existing apply flow completes', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);

  await page.getByRole('button', { name: '샘플로 구성하기' }).click();
  await page.getByRole('button', { name: 'VOO 70 · 금 30' }).click();
  await expect(page.getByRole('heading', { name: '구성 미리보기' })).toBeVisible();
  await page.getByRole('button', { name: '이 구성으로 초안 채우기' }).click();
  await expect(page.getByRole('button', { name: /VOO 편집/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /금\(GOLD\) 편집/ })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v5')!).portfolio.plans
  ))).toEqual([]);

  await page.getByRole('button', { name: '배분 확인' }).click();
  await page.getByRole('button', { name: '이대로 시작' }).click();
  await expect(page.getByRole('heading', { name: '안정 30%' })).toBeVisible();
  await expect(page.locator('.portfolio-summary')).toContainText('VOO70%');
  await expect(page.locator('.portfolio-summary')).toContainText('금(GOLD)30%');
});

test('resumes and cancels a draft, validates manual cash, and confirms reset', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', { name: /인덱스 편집/ }).click();
  await page.getByLabel('금액', { exact: true }).fill('100000');
  await page.getByRole('button', { name: '완료' }).click();
  await expect.poll(() => page.evaluate(() => (
    JSON.parse(localStorage.getItem('isf-workspace-v5')!).portfolio.draft?.items[0]?.shareUnits
  ))).toBe(500_000);
  await page.reload();
  await expect(page.getByRole('heading', { name: '투자 배분 수정' })).toBeVisible();
  await expect(page.getByRole('button', { name: /인덱스 편집/ })).toContainText('100,000원');

  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '변경 버리기' }).click();
  await expect(page.locator('.portfolio-summary').getByRole('listitem').filter({ hasText: /인덱스.*60%/ }))
    .toBeVisible();
  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', { name: /인덱스 편집/ }).click();
  await page.getByLabel('금액', { exact: true }).fill('100000');
  await page.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: /현금.*남은 금액 자동 배분/ }).click();
  await page.getByLabel('현금 금액').fill('70000');
  await page.getByLabel('현금 금액').blur();
  await expect(page.getByText('현금 직접 배분 중')).toBeVisible();
  await expect(page.getByRole('button', { name: '적용' })).toBeDisabled();
  await expect(page.getByRole('region', { name: '현재 배분 요약' })).toContainText('아직 배분하지 않은 금액 30,000원');
  await page.getByRole('button', { name: '현금 자동 배분 켜기' }).click();
  await page.getByRole('button', { name: '취소' }).click();
  await page.getByRole('button', { name: '변경 버리기' }).click();

  const management = page.getByRole('button', { name: '관리 메뉴', exact: true });
  await management.click();
  await page.getByRole('button', { name: '투자 배분 처음부터 다시' }).click();
  const resetDialog = page.getByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' });
  await expect(resetDialog.getByRole('button', { name: '취소' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(management).toBeFocused();
  await management.click();
  await page.getByRole('button', { name: '투자 배분 처음부터 다시' }).click();
  await page.getByRole('dialog', { name: '투자 배분을 처음부터 다시 할까요?' })
    .getByRole('button', { name: '초기화' }).click();
  await expect(page.getByRole('heading', { name: /매달 .*원을 어디에 투자할까요\?/ })).toBeVisible();
  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    return {
      plans: workspace.portfolio.plans,
      draft: workspace.portfolio.draft,
    };
  })).toEqual({
    plans: [],
    draft: null,
  });
});

test('explains duplicate names and blocks confirmation until corrected', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  let targetSheet = page.getByRole('region', { name: '투자 대상 추가' });
  await targetSheet.getByLabel('투자 대상 이름').fill('US INDEX');
  await targetSheet.getByLabel('금액').fill('50000');
  await targetSheet.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  targetSheet = page.getByRole('region', { name: '투자 대상 추가' });
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
  await expect(summary.getByRole('heading', { name: '안정 50%' })).toBeVisible();
  const summaryRows = summary.getByRole('listitem');
  await expect(summaryRows).toHaveCount(4);
  for (const row of await summaryRows.all()) {
    await expect(row).not.toContainText('원');
  }

  await page.getByRole('button', { name: '관리 메뉴', exact: true }).click();
  const amountSwitch = page.getByRole('switch', { name: '금액 보기' });
  const amountLabel = amountSwitch.locator('..');
  const amountLabelBox = await amountLabel.boundingBox();
  if (amountLabelBox === null) throw new Error('금액 보기 라벨이 표시되지 않음');
  await amountLabel.click({ position: { x: amountLabelBox.width - 12, y: amountLabelBox.height / 2 } });
  await expect(amountSwitch).toBeChecked();
  await expect(page.getByRole('button', { name: '관리 메뉴', exact: true })).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('이번 달 투자금 800,000원')).toBeVisible();
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
    await expect(summary.getByTestId('portfolio-allocation-bar').locator('[data-segment-id]')).toHaveCount(4);
    await expect(summary.locator('.portfolio-allocation-row__track')).toHaveCount(0);
    const edit = page.locator('.portfolio-allocation-row__select').first();
    const editBox = await edit.boundingBox();
    expect(editBox).not.toBeNull();
    expect(editBox!.width).toBeGreaterThanOrEqual(44);
    expect(editBox!.height).toBeGreaterThanOrEqual(44);
    await expect(edit).toHaveAttribute('aria-haspopup', 'dialog');
    await expect(summary.locator('.portfolio-summary__edit')).toHaveCount(0);
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
        // Compact rows preserve a usable target while showing the full allocation.
        expect(rowBox!.height).toBeGreaterThanOrEqual(44);
        expect(rowBox!.y + rowBox!.height).toBeLessThanOrEqual(viewport.height);
      }
    }
    if (viewport.width === 1280) {
      expect(summaryBox!.width).toBeGreaterThanOrEqual(767);
      expect(summaryBox!.width).toBeLessThanOrEqual(768);
    }
    const allocationBar = summary.getByTestId('portfolio-allocation-bar');
    const indexSegment = allocationBar.locator('[data-segment-id="global-index"]');
    const [barBox, indexSegmentBox] = await Promise.all([allocationBar.boundingBox(), indexSegment.boundingBox()]);
    expect(barBox).not.toBeNull();
    expect(indexSegmentBox).not.toBeNull();
    expect(indexSegmentBox!.width / barBox!.width).toBeCloseTo(0.5, 1);
    await expect(summary.locator('.portfolio-allocation-row__fill')).toHaveCount(0);

    await page.getByRole('button', { name: '관리 메뉴', exact: true }).click();
    const inputSort = page.getByRole('radio', { name: '입력순' });
    await inputSort.focus();
    await inputSort.check();
    await expect(inputSort).toBeFocused();
    await expect.poll(async () => summary.getByRole('listitem').evaluateAll((rows) => (
      rows.map((row) => row.querySelector('[role="heading"]')?.textContent)
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
  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', { name: /인덱스 편집/ }).click();
  await page.getByLabel('금액', { exact: true }).fill('110000');
  await page.getByRole('button', { name: '완료' }).click();

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

test('keeps add-sheet amount adjustments ordered, touch-sized, and on one row at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  const sheet = page.getByRole('region', { name: '투자 대상 추가' });
  const adjustments = sheet.getByRole('group', { name: '빠른 조정' });
  await expect(adjustments).toBeVisible();
  const buttons = adjustments.getByRole('button');
  await expect(buttons).toHaveText(['-50만', '-10만', '+10만', '+50만']);
  const boxes = await buttons.evaluateAll((elements) => elements.map((element) => {
    const rect = element.getBoundingClientRect();
    return { top: Math.round(rect.top), height: rect.height };
  }));
  expect(new Set(boxes.map(({ top }) => top)).size).toBe(1);
  expect(boxes.every(({ height }) => height >= 44)).toBe(true);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);

  const amount = sheet.getByLabel('금액');
  await amount.fill('1200000');
  await expect(amount).toHaveValue('1,200,000');
  await adjustments.getByRole('button', { name: '-50만' }).click();
  await expect(amount).toHaveValue('700,000');
  await adjustments.getByRole('button', { name: '+50만' }).click();
  await expect(amount).toHaveValue('1,200,000');
});

test('slides the mobile edit card in from below the viewport', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');
  await expect(page.locator('.portfolio-allocation-row__select').first()).toBeVisible();
  const frames = await page.evaluate(async () => {
    const samples: { top: number; height: number; bottom: number }[] = [];
    const started = performance.now();
    const sampled = new Promise<typeof samples>((resolve) => {
      function sample() {
        const card = document.querySelector<HTMLDialogElement>('.portfolio-edit-surface[open]');
        if (card) {
          const box = card.getBoundingClientRect();
          samples.push({ top: box.top, height: box.height, bottom: box.bottom });
        }
        if (performance.now() - started < 400) requestAnimationFrame(sample);
        else resolve(samples);
      }
      requestAnimationFrame(sample);
    });
    document.querySelector<HTMLButtonElement>('.portfolio-allocation-row__select')!.click();
    return sampled;
  });
  expect(frames.length).toBeGreaterThan(3);
  expect(frames[0].top).toBeGreaterThan(844 - frames[0].height * 0.25);
  expect(frames.at(-1)!.bottom).toBeCloseTo(844, 0);
  expect(Math.max(...frames.map((frame) => frame.height)) - Math.min(...frames.map((frame) => frame.height))).toBeLessThan(1);
  const cardBox = await page.getByRole('dialog', { name: '투자 배분 수정' }).boundingBox();
  expect(cardBox!.x).toBe(0);
  expect(cardBox!.width).toBe(390);
  await expect(page.getByRole('button', { name: '편집기 닫기' })).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('portfolio-edit-mobile.png') });
});

test('closes the clean mobile Portfolio editor from a downward header drag', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  for (const height of [844, 600]) {
    await page.setViewportSize({ width: 390, height });
    const trigger = page.locator('.portfolio-allocation-row__select').first();
    await trigger.click();
    const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
    const handle = editor.locator('[data-sheet-drag-handle]');
    expect((await handle.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await handle.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 0 });
    await handle.dispatchEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 120 });
    await handle.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 120 });

    await expect(editor).toHaveAttribute('data-sheet-exiting', 'true');
    const exitPositions = await page.evaluate(async () => {
      const sheet = document.querySelector<HTMLElement>('.portfolio-edit-surface');
      const positions: number[] = [];
      for (let frame = 0; frame < 12 && sheet?.isConnected; frame += 1) {
        positions.push(sheet.getBoundingClientRect().top);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      return positions;
    });
    expect(exitPositions.length).toBeGreaterThan(3);
    expect(exitPositions.every((top, index) => index === 0 || top >= exitPositions[index - 1] - 0.5)).toBe(true);
    await expect(editor).toBeHidden();
    await expect(trigger).toBeFocused();
  }
});

test('discards a dirty mobile Portfolio editor through its exit after drag confirmation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.goto('apps/portfolio/');

  const trigger = page.locator('.portfolio-allocation-row__select').first();
  await trigger.click();
  const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
  await editor.getByRole('button', { name: /인덱스 편집/ }).click();
  const item = page.getByRole('region', { name: '투자 대상 수정' });
  await item.getByLabel('금액', { exact: true }).fill('110000');
  await item.getByRole('button', { name: '완료' }).click();
  await expect(editor.getByRole('button', { name: /인덱스 편집.*110,000원/ })).toBeVisible();

  const handle = editor.locator('[data-sheet-drag-handle]');
  for (const pointerId of [1, 2]) {
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
    await handle.dispatchEvent('pointerdown', { pointerId, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 0 });
    await handle.dispatchEvent('pointermove', { pointerId, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 120 });
    await handle.dispatchEvent('pointerup', { pointerId, pointerType: 'touch', isPrimary: true, clientX: 180, clientY: 120 });
    const discard = page.getByRole('dialog', { name: '변경사항을 버릴까요?' });
    await expect(discard).toBeVisible();
    await expect(editor).not.toHaveAttribute('data-sheet-exiting', 'true');
    if (pointerId === 1) {
      await discard.getByRole('button', { name: '계속 수정' }).click();
      await expect(editor.getByRole('button', { name: '편집기 닫기' })).toBeFocused();
      await expect(editor.getByRole('button', { name: /인덱스 편집.*110,000원/ })).toBeVisible();
      continue;
    }
    await discard.getByRole('button', { name: '변경 버리기' }).click();
  }

  await expect(editor).toHaveAttribute('data-sheet-exiting', 'true');
  await expect(editor).not.toBeVisible();
  await expect(trigger).toBeFocused();
  await expect(page.locator('.portfolio-allocation-list')).toContainText('인덱스60%');
});

test('isolates applied editing as a sheet or centered modal and restores focus', async ({ page }, testInfo) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);

  for (const viewport of [
    { width: 390, height: 844, mode: 'sheet' },
    { width: 768, height: 1024, mode: 'modal' },
    { width: 1280, height: 900, mode: 'modal' },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto('apps/portfolio/');
    const trigger = page.locator('.portfolio-allocation-row__select').first();
    await trigger.click();
    const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
    await expect(editor).toHaveAttribute('data-presentation', viewport.mode);
    await expect(editor).toHaveCSS('opacity', '1');
    if (viewport.mode === 'sheet') {
      await expect.poll(async () => {
        const box = await editor.boundingBox();
        return box === null ? Infinity : Math.abs(box.y + box.height - viewport.height);
      }).toBeLessThan(0.5);
    }
    const box = await editor.boundingBox();
    if (viewport.mode === 'sheet') {
      expect(box!.x).toBe(0);
      expect(box!.width).toBe(viewport.width);
      expect(box!.y + box!.height).toBeCloseTo(viewport.height, 0);
    } else {
      expect(box!.x + box!.width / 2).toBeCloseTo(viewport.width / 2, 0);
      expect(box!.y + box!.height / 2).toBeCloseTo(viewport.height / 2, 0);
    }
    await expect(editor.getByRole('textbox')).toHaveCount(0);
    await expect(editor.getByRole('button', { name: /인덱스 편집.*성장/ })).toBeVisible();
    const add = editor.getByRole('button', { name: '투자 대상 추가' });
    expect(await add.evaluate((button) => getComputedStyle(button, '::before').content)).toBe('"+"');
    expect((await add.boundingBox())!.width).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: testInfo.outputPath(`portfolio-edit-${viewport.width}.png`) });
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
    const stored = localStorage.getItem('isf-workspace-v5');
    const workspace = stored === null ? {
      schemaVersion: 5,
      revision: 1,
      updatedAt: fixture.updatedAt,
      main: { expenseAssistant: null, applied: null, setupProgress: null },
      simulation: { draft: null },
      portfolio: { plans: [], draft: null },
      locations: [],
      accountMap: { applied: null, draft: null },
    } : JSON.parse(stored);
    workspace.main = { expenseAssistant: null,
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
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
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
  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.evaluate(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'isf-workspace-v5') {
        throw new DOMException('Portfolio draft writes are blocked for this test', 'QuotaExceededError');
      }
      originalSetItem.call(this, key, value);
    };
  });

  await page.getByRole('button', { name: /인덱스 편집/ }).click();
  await page.getByLabel('금액', { exact: true }).fill('110000');
  await page.getByRole('button', { name: '완료' }).click();
  const applyBar = page.getByRole('complementary', { name: '배분 변경' });
  await expect(applyBar.getByRole('alert')).toContainText('저장하지 못했습니다');
  await page.locator('.portfolio-edit-surface__body').evaluate((element) => {
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

  const sheet = page.getByRole('region', { name: '투자 대상 추가' });
  const box = await sheet.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(768);
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
});

test('keeps dirty inline target input contained and reuses the form for editing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: '투자 대상 추가' }).click();

  let sheet = page.getByRole('region', { name: '투자 대상 추가' });
  const sheetBox = await sheet.boundingBox();
  expect(sheetBox).not.toBeNull();
  expect(sheetBox!.x).toBeGreaterThanOrEqual(0);
  expect(sheetBox!.x + sheetBox!.width).toBeLessThanOrEqual(390);
  expect(await sheet.evaluate((form) => form.matches(':modal'))).toBe(false);
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
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await sheet.getByLabel('투자 대상 이름').focus();
  await page.keyboard.press('Escape');
  let discard = page.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: '계속 입력' }).click();
  await expect(sheet.getByLabel('투자 대상 이름')).toHaveValue('미국 인덱스');
  await page.keyboard.press('Escape');
  discard = page.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: '버리기' }).click();
  await expect(sheet).not.toBeVisible();
  await expect(page.getByRole('button', { name: '투자 대상 추가' })).toBeFocused();

  await page.getByRole('button', { name: '투자 대상 추가' }).click();
  sheet = page.getByRole('region', { name: '투자 대상 추가' });
  await sheet.getByLabel('투자 대상 이름').fill('미국 인덱스');
  await sheet.getByLabel('금액').fill('120000');
  await sheet.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '미국 인덱스 편집, 성장, 120,000원, 60%' }).click();

  const editSheet = page.getByRole('region', { name: '투자 대상 수정' });
  await expect(editSheet).toHaveClass(/portfolio-item-form/);
  await expect(editSheet.getByRole('button', { name: '투자 대상 삭제' })).toBeVisible();
  await expect(editSheet.getByRole('button', { name: 'S&P 500', exact: true })).toHaveCount(0);
  await expect(editSheet.getByRole('button', { name: '취소' })).toBeVisible();
  await expect(editSheet.getByRole('button', { name: '완료' })).toBeVisible();
  expect(await page.locator('html').evaluate((html) => html.scrollWidth <= innerWidth)).toBe(true);
  await editSheet.getByRole('button', { name: '투자 대상 삭제' }).click();
  await expect(editSheet).not.toBeVisible();
  await expect(page.getByRole('button', { name: '미국 인덱스 편집, 성장, 120,000원, 60%' })).toHaveCount(0);
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

    const sheet = page.getByRole('region', { name: '투자 대상 추가' });
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
test('does not expose account or custody management and preserves retired Account Map data', async ({ page }) => {
  await seedMain(page, 200_000);
  await seedAppliedPortfolio(page);
  await page.addInitScript(() => {
    if (sessionStorage.getItem('isf-retired-map-seeded')) return;
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    workspace.accountMap = {draft: null, applied: {
      schemaVersion: 3, sourceMainUpdatedAt: workspace.main.applied.updatedAt,
      customPurposes: [], transfers: [],
      links: [{id: 'investing-isa', purposeId: 'system:investing', locationId: 'loc-isa',
        monthlyAmountWon: 200_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1}],
      setupCompletedAt: 1, updatedAt: 1,
    }};
    localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
    sessionStorage.setItem('isf-retired-map-seeded', 'true');
  });
  await page.goto('apps/portfolio/');

  const preservedBefore = await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    return {
      locations: workspace.locations,
      accountMap: workspace.accountMap,
      locationPlans: workspace.portfolio.plans.filter(
        (plan: { scope: { type: string } }) => plan.scope.type === 'location',
      ),
    };
  });
  await expect(page.getByText(/투자 위치/)).toHaveCount(0);
  await expect(page.getByText(/계좌·보관처/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /위치|계좌|보관처/ })).toHaveCount(0);

  await page.locator('.portfolio-allocation-row__select').first().click();
  await page.getByRole('button', { name: /인덱스 편집/ }).click();
  await page.getByLabel('금액', { exact: true }).fill('100000');
  await page.getByRole('button', { name: '완료' }).click();
  await page.getByRole('button', { name: '적용' }).click();
  await page.getByRole('dialog', { name: '투자 배분을 적용할까요?' })
    .getByRole('button', { name: '배분 적용' }).click();
  await expect(page.locator('.portfolio-allocation-row__select').first()).toBeVisible();

  await expect.poll(() => page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    return workspace.portfolio.plans.find(
      (plan: { scope: { type: string } }) => plan.scope.type === 'aggregate',
    )?.items[0].shareUnits;
  })).toBe(500_000);

  await page.reload();
  await expect(page.locator('.portfolio-allocation-row__select').first()).toBeVisible();
  expect(await page.evaluate(() => {
    const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
    return {
      locations: workspace.locations,
      accountMap: workspace.accountMap,
      locationPlans: workspace.portfolio.plans.filter(
        (plan: { scope: { type: string } }) => plan.scope.type === 'location',
      ),
    };
  })).toEqual(preservedBefore);
});

for (const width of [390, 768, 1280]) {
  test(`keeps nested editor focus and footer containment at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 844 });
    await seedMain(page, 800_000);
    await seedSourceVisualPortfolio(page);
    await page.goto('apps/portfolio/');
    await page.locator('.portfolio-allocation-row__select').first().click();
    const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
    await expect(editor).toHaveCSS('opacity', '1');
    if (width < 768) {
      await expect.poll(async () => {
        const box = await editor.boundingBox();
        return box === null ? Infinity : Math.abs(box.y + box.height - 844);
      }).toBeLessThan(0.5);
    }
    const body = editor.locator('.portfolio-edit-surface__body');
    const add = editor.getByRole('button', { name: '투자 대상 추가' });
    await expect(editor.getByRole('region', { name: '현재 배분 요약' })).toBeVisible();
    await expect(add).toBeInViewport();
    for (const row of await editor.locator('.portfolio-editor__row-summary').all()) await expect(row).toBeInViewport();
    let row = editor.getByRole('button', { name: /글로벌 인덱스 편집/ });
    const beforeScroll = await body.evaluate(element => element.scrollTop);
    await row.click();
    let item = page.getByRole('region', { name: '투자 대상 수정' });
    await expect(item.getByLabel('투자 대상 이름')).toBeFocused();
    await editor.getByRole('button', { name: '편집기 닫기' }).click();
    await expect(item).toBeVisible();
    await item.getByLabel('투자 대상 이름').focus();
    await page.keyboard.press('Escape');
    await expect(item).not.toBeVisible();
    row = editor.getByRole('button', { name: /글로벌 인덱스 편집/ });
    await expect(row).toBeFocused();
    expect(await body.evaluate(element => element.scrollTop)).toBe(beforeScroll);
    await row.click();
    item = page.getByRole('region', { name: '투자 대상 수정' });
    await item.getByLabel('금액', { exact: true }).fill('999999');
    await expect(item.getByLabel('금액', { exact: true })).toHaveAccessibleDescription('월 투자금을 초과할 수 없습니다.');
    await page.keyboard.press('Escape');
    const discard = page.getByRole('dialog', { name: '입력 내용을 버릴까요?' });
    await expect(discard.getByRole('button', { name: '계속 입력' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(discard.getByRole('button', { name: '버리기' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(discard.getByRole('button', { name: '계속 입력' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(item.getByLabel('금액', { exact: true })).toBeFocused();
    await item.getByLabel('금액', { exact: true }).fill('350000');
    await item.getByRole('button', { name: '완료' }).click();
    row = editor.getByRole('button', { name: /글로벌 인덱스 편집/ });
    await expect(row).toBeFocused();
    const footer = editor.getByRole('complementary', { name: '배분 변경' });
    await expect(footer).toContainText('아직 적용하지 않은 변경이 있어요');
    expect(await footer.evaluate(element => getComputedStyle(element).position)).toBe('static');
    await add.scrollIntoViewIfNeeded();
    const [lastBox, footerBox] = await Promise.all([add.boundingBox(), footer.boundingBox()]);
    expect(lastBox!.y + lastBox!.height).toBeLessThanOrEqual(footerBox!.y);
    expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(footer).toHaveCSS('opacity', '1');
    await page.screenshot({ path: testInfo.outputPath(`task4-dirty-${width}.png`) });
    await footer.getByRole('button', { name: '적용', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    await expect(confirmation.getByRole('button', { name: '계속 수정' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(footer.getByRole('button', { name: '적용', exact: true })).toBeFocused();
  });
}

for (const width of [390, 640, 768, 1280]) {
  test(`scrolls ten editor targets without covering summary or actions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedMain(page, 800_000);
    await seedAppliedPortfolio(page);
    await page.addInitScript(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
      const plan = workspace.portfolio.plans[0];
      plan.syncedInvestmentWon = 800000;
      plan.items = Array.from({ length: 10 }, (_, index) => ({ ...plan.items[0], id: `target-${index}`,
        name: `전 세계 소형주 가치주 지수를 따르는 장기 투자 대상 ${index + 1}`, shareUnits: 90000, order: index }));
      plan.cashShareUnits = 100000;
      localStorage.setItem('isf-workspace-v5', JSON.stringify(workspace));
    });
    await page.goto('apps/portfolio/');
    await page.evaluate(() => document.fonts.ready);
    await page.locator('.portfolio-allocation-row__select').first().click();
    const editor = page.getByRole('dialog', { name: '투자 배분 수정' });
    const body = editor.locator('.portfolio-edit-surface__body');
    expect(await body.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
    const lastRow = editor.locator('.portfolio-editor__row-summary').last();
    await lastRow.scrollIntoViewIfNeeded();
    await lastRow.click();
    const scrollTop = await body.evaluate(element => element.scrollTop);
    const item = page.getByRole('region', { name: '투자 대상 수정' });
    await item.getByLabel('금액', { exact: true }).fill('50000');
    await item.getByRole('button', { name: '완료' }).click();
    await expect(lastRow).toBeFocused();
    await expect.poll(async () => body.evaluate((element, initialTop) => {
      const max = Math.max(0, element.scrollHeight - element.clientHeight);
      return Math.abs(element.scrollTop - Math.min(initialTop, max)) <= 1;
    }, scrollTop)).toBe(true);
    await editor.getByRole('button', { name: /현금.*남은 금액 자동 배분/ }).click();
    const cash = editor.getByLabel('현금 금액');
    await cash.fill('900000');
    await cash.blur();
    const error = editor.getByRole('alert');
    await error.scrollIntoViewIfNeeded();
    const footer = editor.getByRole('complementary', { name: '배분 변경' });
    const [errorBox, footerBox] = await Promise.all([error.boundingBox(), footer.boundingBox()]);
    expect(errorBox!.y + errorBox!.height).toBeLessThanOrEqual(footerBox!.y);
    await expect(editor.getByRole('region', { name: '현재 배분 요약' })).toBeInViewport();
    await expect(editor.getByRole('button', { name: '편집기 닫기' })).toBeInViewport();
    expect(await editor.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    expect(await body.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  });
}

for (const mode of ['setup', 'edit'] as const) {
  test(`retains local cash validation through unrelated item edits in ${mode}`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await seedMain(page, 200_000);
    if (mode === 'edit') await seedAppliedPortfolio(page);
    await page.goto('apps/portfolio/');
    if (mode === 'setup') {
      await enterFirstSetupAllocation(page);
      await page.getByRole('button', { name: '투자 대상 추가' }).click();
      await page.getByLabel('투자 대상 이름').fill('인덱스');
      await page.getByLabel('금액', { exact: true }).fill('120000');
      await page.getByRole('button', { name: '완료' }).click();
    } else await page.locator('.portfolio-allocation-row__select').first().click();
    await page.getByRole('button', { name: /현금.*남은 금액 자동 배분/ }).click();
    const cash = page.getByLabel('현금 금액');
    await cash.fill('900000');
    await cash.blur();
    await expect(cash).toHaveAccessibleDescription('투자금을 초과해 배분할 수 없습니다.');
    await page.getByRole('button', { name: /인덱스 편집/ }).click();
    await page.getByLabel('투자 대상 이름').fill('수정한 인덱스');
    await page.getByRole('button', { name: '완료' }).click();
    await expect(cash).toHaveValue('900,000');
    await expect(cash).toHaveAccessibleDescription('투자금을 초과해 배분할 수 없습니다.');
    const action = page.getByRole('button', { name: mode === 'setup' ? '배분 확인' : '적용', exact: true });
    await expect(action).toBeDisabled();
    await expect(page.getByRole('dialog', { name: '투자 배분을 적용할까요?' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: '배분 검토' })).toHaveCount(0);
    if (mode === 'setup') {
      await page.getByRole('button', { name: '현금 자동 배분 켜기' }).click();
    } else {
      await cash.fill('80000');
      await cash.blur();
    }
    await expect(cash).toHaveValue('80,000');
    await expect(cash).not.toHaveAttribute('aria-invalid');
    await expect(action).toBeEnabled();
    await action.click();
    await page.getByRole('button', { name: mode === 'setup' ? '이대로 시작' : '배분 적용', exact: true }).click();
    await expect(page.locator('.portfolio-allocation-row__select').first()).toBeVisible();
    await expect.poll(() => page.evaluate(() => {
      const workspace = JSON.parse(localStorage.getItem('isf-workspace-v5')!);
      return workspace.portfolio.plans[0].items[0].name;
    })).toBe('수정한 인덱스');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('isf-workspace-v5')!).main.applied.monthlyInvestmentWon)).toBe(200000);
  });
}

test('clears setup cash validation when back navigation discards its local input', async ({ page }) => {
  await seedMain(page, 200_000);
  await page.goto('apps/portfolio/');
  await enterFirstSetupAllocation(page);
  await page.getByRole('button', { name: /현금.*남은 금액 자동 배분/ }).click();
  await page.getByLabel('현금 금액').fill('900000');
  await page.getByLabel('현금 금액').blur();
  await expect(page.getByRole('button', { name: '배분 확인' })).toBeDisabled();
  await page.getByRole('button', { name: '이전' }).click();
  await enterFirstSetupAllocation(page);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const next = page.getByRole('button', { name: '배분 확인' });
  await expect(next).toBeEnabled();
  await page.getByRole('button', { name: /현금.*남은 금액 자동 배분/ }).click();
  await expect(page.getByLabel('현금 금액')).toHaveValue('200,000');
  await expect(page.getByLabel('현금 금액')).not.toHaveAttribute('aria-invalid');
  await next.click();
  await page.getByRole('button', { name: '이대로 시작' }).click();
  await expect(page.getByRole('heading', { name: '안정 100%' })).toBeVisible();
});
