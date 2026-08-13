import { expect, test, type Page, type TestInfo } from '@playwright/test';

const appliedMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 7, 13, 6),
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

const seededWorkspace = {
  schemaVersion: 1,
  revision: 3,
  updatedAt: appliedMain.updatedAt,
  main: { applied: appliedMain, setupProgress: null },
  simulation: {
    draft: {
      schemaVersion: 2,
      source: {
        monthlySavingsWon: appliedMain.monthlySavingWon,
        monthlyInvestmentWon: appliedMain.monthlyInvestmentWon,
        mainUpdatedAt: appliedMain.updatedAt,
      },
      initialInvestmentWon: 10_000_000,
      years: 20,
      expectedAnnualReturnPercent: 9,
      baseRatePercent: 2.75,
      inflationOffsetPercentPoints: -0.25,
      amountMode: 'nominal',
      updatedAt: appliedMain.updatedAt,
    },
  },
  portfolio: {
    plans: [{
      schemaVersion: 2,
      scope: { type: 'aggregate' },
      items: [{
        id: 'index',
        name: '관장 인덱스',
        shareUnits: 600_000,
        order: 0,
        classification: 'growth',
        classificationOrigin: 'automatic',
      }],
      cashShareUnits: 400_000,
      cashMode: 'automatic',
      syncedInvestmentWon: appliedMain.monthlyInvestmentWon,
      appliedAt: appliedMain.updatedAt,
      updatedAt: appliedMain.updatedAt,
    }],
    draft: null,
  },
  locations: [],
  accountMap: { applied: null, draft: null, instruments: [], flows: [] },
};

const clippedDeficitMain = {
  ...appliedMain,
  monthlyNetIncomeWon: 1_000_000,
  monthlyHousingWon: 1_000_000,
  monthlyLivingWon: 0,
  monthlySavingWon: 1_000_000,
  monthlyInvestmentWon: 1_000_000,
};

const zeroInvestmentWorkspace = {
  ...seededWorkspace,
  main: {
    ...seededWorkspace.main,
    applied: {
      ...appliedMain,
      monthlyInvestmentWon: 0,
    },
  },
};

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 900 },
  { name: 'desktop', width: 1280, height: 900 },
] as const;

const apps = [
  {
    name: 'main',
    path: 'apps/main/',
    frameTestId: 'main-dashboard-frame',
    resultHeading: '이번 달 자금 흐름',
  },
  {
    name: 'simulation',
    path: 'apps/simulation/',
    frameTestId: 'simulation-page-frame',
    resultHeading: /이대로 20년 유지하면/,
  },
  {
    name: 'portfolio',
    path: 'apps/portfolio/',
    frameTestId: 'portfolio-page-frame',
    resultHeading: '안정 40%',
  },
] as const;

function expectReadingFrame(
  viewportWidth: number,
  box: { x: number; width: number },
): void {
  const expectedWidth = Math.min(viewportWidth - 32, 768);
  expect(Math.abs(box.width - expectedWidth)).toBeLessThan(1);
  expect(Math.abs(box.x - (viewportWidth - expectedWidth) / 2)).toBeLessThan(1);
}

async function expectNoHorizontalOverflow(page: Page, viewportWidth: number): Promise<void> {
  const widths = await page.evaluate(() => ({
    body: document.body.scrollWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(widths.body).toBeLessThanOrEqual(viewportWidth);
  expect(widths.document).toBeLessThanOrEqual(viewportWidth);
}

async function captureReadingWidth(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await page.screenshot({ path: testInfo.outputPath(name) });
}

for (const viewport of viewports) {
  test(`shares the exact reading frame across result apps at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((workspace) => {
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    }, seededWorkspace);

    for (const app of apps) {
      await page.goto(app.path);
      await expect(page.getByRole('heading', { name: app.resultHeading })).toBeVisible();

      const frame = page.getByTestId(app.frameTestId);
      await expect(frame).toHaveClass(/app-content-frame/);
      const frameBox = await frame.boundingBox();
      expect(frameBox).not.toBeNull();
      expectReadingFrame(viewport.width, frameBox!);
      await expectNoHorizontalOverflow(page, viewport.width);
      await captureReadingWidth(
        page,
        testInfo,
        `${app.name}-${viewport.name}-reading-width.png`,
      );
    }
  });
}

for (const viewport of viewports) {
  test(`contains the actionable Portfolio gate in the reading frame at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((workspace) => {
      localStorage.setItem('isf-workspace-v1', JSON.stringify(workspace));
    }, zeroInvestmentWorkspace);
    await page.goto('apps/portfolio/');

    const frame = page.getByTestId('portfolio-page-frame');
    const message = frame.locator('.portfolio-gate__message');
    const heading = message.getByRole('heading', { name: '투자금을 먼저 정해 주세요' });
    const link = message.getByRole('link', { name: 'Main에서 투자금 설정' });
    await expect(page.getByTestId('portfolio-page-frame')).toHaveCount(1);
    await expect(frame).toHaveClass(/app-content-frame/);
    await expect(heading).toBeVisible();
    await expect(link).toHaveAttribute('href', /apps\/main\/\?edit=investment$/);
    expect(await message.evaluate((element) => getComputedStyle(element).position)).toBe('absolute');

    const frameBox = await frame.boundingBox();
    const messageBox = await message.boundingBox();
    const headingBox = await heading.boundingBox();
    const linkBox = await link.boundingBox();
    expect(frameBox).not.toBeNull();
    expect(messageBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(linkBox).not.toBeNull();
    expectReadingFrame(viewport.width, frameBox!);
    for (const box of [messageBox!, headingBox!, linkBox!]) {
      expect(box.x).toBeGreaterThanOrEqual(frameBox!.x);
      expect(box.x + box.width).toBeLessThanOrEqual(frameBox!.x + frameBox!.width);
    }

    await link.focus();
    await expect(link).toBeFocused();
    await expectNoHorizontalOverflow(page, viewport.width);
  });
}

interface WideReviewState {
  stage: { x: number; width: number; right: number };
  frame: { x: number; width: number };
  desiredEndPercent: number;
  visibleEndPercent: number;
  clipped: boolean;
  targetClip: { x: number; right: number };
  targets: Array<{ x: number; right: number }>;
}

async function readWideReviewState(page: Page): Promise<WideReviewState> {
  await page.evaluate(() => new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
  return page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="allocation-visual-stage"]')!;
    const frame = document.querySelector<HTMLElement>('[data-testid="main-page-frame"]')!;
    const segments = stage.querySelector<HTMLElement>('.allocation-bar__segments')!;
    const targetClip = segments.querySelector<HTMLElement>('.cashflow-bar__targets-clip')!;
    const stageBox = stage.getBoundingClientRect();
    const frameBox = frame.getBoundingClientRect();
    const targetClipBox = targetClip.getBoundingClientRect();
    return {
      stage: { x: stageBox.x, width: stageBox.width, right: stageBox.right },
      frame: { x: frameBox.x, width: frameBox.width },
      desiredEndPercent: Number(segments.dataset.desiredEndPercent),
      visibleEndPercent: Number(segments.dataset.visibleEndPercent),
      clipped: segments.dataset.overflowClipped === 'true',
      targetClip: { x: targetClipBox.x, right: targetClipBox.right },
      targets: Array.from(segments.querySelectorAll<HTMLElement>('.allocation-bar__segment-target'))
        .map((target) => {
          const box = target.getBoundingClientRect();
          return { x: box.x, right: box.right };
        }),
    };
  });
}

async function expectClippedDeficitReview(
  page: Page,
  viewport: typeof viewports[number],
  state: WideReviewState,
): Promise<void> {
  const expectedWideWidth = Math.min(viewport.width - 32, 1200);
  const expectedWideX = (viewport.width - expectedWideWidth) / 2;
  expect(Math.abs(state.stage.width - expectedWideWidth)).toBeLessThan(1);
  expect(Math.abs(state.stage.x - expectedWideX)).toBeLessThan(1);
  expect(state.stage.x).toBeGreaterThanOrEqual(16);
  expect(state.stage.right).toBeLessThanOrEqual(viewport.width - 16 + 1);
  expectReadingFrame(viewport.width, state.frame);

  if (viewport.name === 'desktop') {
    expect(state.stage.width).toBeGreaterThan(state.frame.width);
  } else {
    expect(Math.abs(state.stage.width - state.frame.width)).toBeLessThan(1);
  }

  expect(state.desiredEndPercent).toBe(300);
  expect(state.visibleEndPercent).toBeGreaterThanOrEqual(100);
  expect(state.visibleEndPercent).toBeLessThan(state.desiredEndPercent);
  expect(state.clipped).toBe(true);
  expect(state.targetClip.x).toBeGreaterThanOrEqual(state.stage.x - 1);
  expect(state.targetClip.right).toBeLessThanOrEqual(viewport.width - 16 + 1);
  expect(state.targets.length).toBeGreaterThan(0);
  for (const target of state.targets) {
    expect(target.x).toBeGreaterThanOrEqual(state.targetClip.x - 1);
    expect(target.right).toBeLessThanOrEqual(state.targetClip.right + 1);
  }
  await expect(page.getByRole('button', { name: '저축 상세 정보' })).toBeVisible();
  await expect(page.getByRole('button', { name: '투자 상세 정보' })).toBeVisible();
  await expectNoHorizontalOverflow(page, viewport.width);
}

async function expectTooltipInsideWideStage(
  page: Page,
  viewportWidth: number,
): Promise<void> {
  const boxes = await page.evaluate(() => {
    const stage = document.querySelector<HTMLElement>('[data-testid="allocation-visual-stage"]')!;
    const tooltip = document.querySelector<HTMLElement>('[role="tooltip"]')!;
    const stageBox = stage.getBoundingClientRect();
    const tooltipBox = tooltip.getBoundingClientRect();
    return {
      stage: { left: stageBox.left, right: stageBox.right },
      tooltip: { left: tooltipBox.left, right: tooltipBox.right },
    };
  });
  expect(boxes.tooltip.left).toBeGreaterThanOrEqual(Math.max(16, boxes.stage.left));
  expect(boxes.tooltip.right).toBeLessThanOrEqual(Math.min(viewportWidth - 16, boxes.stage.right));
}

async function expectClippedFallbackTooltips(
  page: Page,
  viewportWidth: number,
): Promise<void> {
  const saving = page.getByRole('button', { name: '저축 상세 정보' });
  const investment = page.getByRole('button', { name: '투자 상세 정보' });

  await saving.hover();
  await expect(page.getByRole('tooltip')).toHaveText('저축 · 100만 원 · 100.0%');
  await expectTooltipInsideWideStage(page, viewportWidth);
  await page.mouse.move(0, 0);
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await investment.evaluate((button) => {
    button.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      isPrimary: true,
      pointerType: 'touch',
    }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  await expect(page.getByRole('tooltip')).toHaveText('투자 · 100만 원 · 100.0%');
  await expectTooltipInsideWideStage(page, viewportWidth);

  await investment.evaluate((button) => {
    button.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      isPrimary: true,
      pointerType: 'touch',
    }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
  await saving.focus();
  await page.keyboard.press('Enter');
  await expect(saving).toBeFocused();
  await expect(page.getByRole('tooltip')).toHaveText('저축 · 100만 원 · 100.0%');
  await expectTooltipInsideWideStage(page, viewportWidth);
}

for (const viewport of viewports) {
  test(`keeps first and restart Main assembly widths identical at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(({ workspace, deficit }) => {
      const marker = 'isf-reading-width-first-review-seeded';
      if (sessionStorage.getItem(marker) !== null) return;
      localStorage.clear();
      localStorage.setItem('isf-workspace-v1', JSON.stringify({
        ...workspace,
        main: {
          applied: null,
          setupProgress: {
            kind: 'initial',
            step: 'review',
            draft: deficit,
            savedAt: deficit.updatedAt,
          },
        },
      }));
      sessionStorage.setItem(marker, 'true');
    }, { workspace: seededWorkspace, deficit: clippedDeficitMain });

    await page.goto('apps/main/');
    await expect(page.getByRole('heading', {
      name: '입력한 월 자금 계획을 확인해주세요',
    })).toBeVisible();
    await expect(page.getByTestId('allocation-visual-stage')).toHaveClass(/app-wide-visual/);
    const firstReview = await readWideReviewState(page);
    await expectClippedDeficitReview(page, viewport, firstReview);
    await expectClippedFallbackTooltips(page, viewport.width);

    await page.getByRole('button', { name: '계획 적용' }).click();
    await expect(page.getByRole('heading', { name: '이번 달 자금 흐름' })).toBeVisible();
    await page.getByRole('button', { name: '관리 메뉴' }).click();
    await page.getByRole('menuitem', { name: '처음부터 다시' }).click();
    await page.getByRole('dialog', { name: '처음부터 다시 할까요?' })
      .getByRole('button', { name: '다시 시작' })
      .click();
    await expect(page.getByRole('heading', {
      name: '한 달 돈의 흐름, 2분이면 확인할 수 있어요.',
    })).toBeVisible();

    for (let step = 0; step < 5; step += 1) {
      await page.getByRole('button', { name: '다음' }).click();
    }
    await expect(page.getByRole('heading', {
      name: '입력한 월 자금 계획을 확인해주세요',
    })).toBeVisible();
    await expect(page.getByRole('button', { name: '설정 취소' })).toBeVisible();
    await expect(page.getByTestId('allocation-visual-stage')).toHaveClass(/app-wide-visual/);
    const restartReview = await readWideReviewState(page);
    await expectClippedDeficitReview(page, viewport, restartReview);

    expect(restartReview.stage.width).toBe(firstReview.stage.width);
    expect(restartReview.stage.x).toBe(firstReview.stage.x);
    expect(restartReview.desiredEndPercent).toBe(firstReview.desiredEndPercent);
    expect(restartReview.visibleEndPercent).toBe(firstReview.visibleEndPercent);
    expect(restartReview.clipped).toBe(firstReview.clipped);
  });
}
