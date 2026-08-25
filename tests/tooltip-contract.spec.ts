import { expect, test, type Page } from '@playwright/test';

const deficitMain = {
  schemaVersion: 2,
  updatedAt: Date.UTC(2026, 7, 25, 6),
  monthlyNetIncomeWon: 1_000_000,
  monthlyHousingWon: 1_000_000,
  monthlyLivingWon: 0,
  monthlySavingWon: 1_000_000,
  monthlyInvestmentWon: 1_000_000,
};

const workspace = {
  schemaVersion: 1,
  revision: 1,
  updatedAt: deficitMain.updatedAt,
  main: { applied: null, setupProgress: { kind: 'initial', step: 'review', draft: deficitMain, savedAt: deficitMain.updatedAt } },
  simulation: { draft: null },
  portfolio: { plans: [], draft: null },
  locations: [],
  accountMap: { applied: null, draft: null, instruments: [], flows: [] },
};

for (const viewport of [
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1280, height: 900 },
]) {
  test(`keeps pearl single-line tooltips contained for visual and clipped fallback targets at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript((seed) => {
      localStorage.clear();
      localStorage.setItem('isf-workspace-v1', JSON.stringify(seed));
    }, workspace);
    await page.goto('apps/main/');
    await expect(page.getByRole('heading', { name: '입력한 월 자금 계획을 확인해주세요' })).toBeVisible();

    const visualTarget = page.locator('.allocation-bar__segment-target').first();
    await visualTarget.hover({ position: { x: 1, y: 22 } });
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toHaveText('소비 · 100만 원 · 100.0%');
    await expectTooltipContract(page, tooltip, 'normal');
    await expect(visualTarget).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id'));

    const longValue = '소비 · 1,000,000원 · 100.0% · 화면 폭이 제한될 때에도 전체 접근 가능 텍스트를 유지하는 긴 설명 · 화면 폭이 제한될 때에도 전체 접근 가능 텍스트를 유지하는 긴 설명 · 화면 폭이 제한될 때에도 전체 접근 가능 텍스트를 유지하는 긴 설명';
    await tooltip.evaluate((element, text) => {
      element.textContent = text;
    }, longValue);
    await expect(tooltip).toHaveText(longValue);
    await expect(tooltip).toHaveAccessibleName(longValue);
    await expectLongTooltipOverflow(tooltip);

    await page.mouse.move(0, 0);
    const savingFallback = page.getByRole('button', { name: '저축 상세 정보' });
    await savingFallback.focus();
    await expect(tooltip).toHaveText('저축 · 100만 원 · 100.0%');
    await expectTooltipContract(page, tooltip, 'fallback');
    await expect(savingFallback).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id'));

    const investmentFallback = page.getByRole('button', { name: '투자 상세 정보' });
    await tap(investmentFallback);
    await expect(tooltip).toHaveText('투자 · 100만 원 · 100.0%');
    await expect(investmentFallback).toHaveAttribute('aria-describedby', await tooltip.getAttribute('id'));
    await tap(investmentFallback);
    await expect(tooltip).toHaveCount(0);
  });
}

test('keeps an open right-edge visual tooltip within the stage and viewport after resize', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((seed) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(seed));
  }, workspace);
  await page.goto('apps/main/');

  const visualTarget = page.locator('.allocation-bar__segment-target').first();
  const targetBox = await visualTarget.boundingBox();
  if (targetBox === null) throw new Error('Expected visual allocation target');
  await visualTarget.click({ position: { x: targetBox.width - 1, y: 22 } });
  const tooltip = page.getByRole('tooltip');
  await expect(tooltip).toHaveText('소비 · 100만 원 · 100.0%');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectTooltipContract(page, tooltip, 'normal');
});

test('returns an edge-corrected visual tooltip to its current interior anchor', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((seed) => {
    localStorage.clear();
    localStorage.setItem('isf-workspace-v1', JSON.stringify(seed));
  }, workspace);
  await page.goto('apps/main/');

  const visualTarget = page.locator('.allocation-bar__segment-target').first();
  const targetBox = await visualTarget.boundingBox();
  if (targetBox === null) throw new Error('Expected visual allocation target');
  await visualTarget.hover({ position: { x: targetBox.width - 1, y: 22 } });
  const tooltip = page.getByRole('tooltip');
  await expectTooltipContract(page, tooltip, 'normal');

  await visualTarget.hover({ position: { x: targetBox.width / 2, y: 22 } });
  await expectTooltipContract(page, tooltip, 'normal');
  await expect.poll(async () => tooltip.evaluate((element) => {
    const tooltipBox = element.getBoundingClientRect();
    const stageBox = element.closest<HTMLElement>('[data-testid="allocation-visual-stage"]')!
      .getBoundingClientRect();
    return Math.abs((tooltipBox.left + tooltipBox.right) / 2 - (stageBox.left + stageBox.right) / 2);
  })).toBeLessThanOrEqual(1);
});

async function tap(target: ReturnType<Page['getByRole']>): Promise<void> {
  await target.evaluate((button) => {
    button.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      isPrimary: true,
      pointerType: 'touch',
    }));
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }));
  });
}

async function expectTooltipContract(
  page: Page,
  tooltip: ReturnType<Page['getByRole']>,
  alignment: 'normal' | 'fallback',
): Promise<void> {
  await expect.poll(async () => tooltip.evaluate((element) => {
    const tooltipBox = element.getBoundingClientRect();
    const stageBox = element.closest<HTMLElement>('[data-testid="allocation-visual-stage"]')!
      .getBoundingClientRect();
    return tooltipBox.left >= stageBox.left - 1
      && tooltipBox.right <= stageBox.right + 1
      && tooltipBox.left >= -1
      && tooltipBox.right <= window.innerWidth + 1;
  })).toBe(true);

  const state = await tooltip.evaluate((element) => {
    const tooltipElement = element as HTMLElement;
    const stage = tooltipElement.closest<HTMLElement>('[data-testid="allocation-visual-stage"]')!;
    const tooltipBox = tooltipElement.getBoundingClientRect();
    const stageBox = stage.getBoundingClientRect();
    const style = getComputedStyle(tooltipElement);
    return {
      role: tooltipElement.getAttribute('role'),
      hasEndContainedClass: tooltipElement.classList.contains('flow-tooltip--end-contained'),
      tooltip: { left: tooltipBox.left, right: tooltipBox.right, height: tooltipBox.height },
      isClipped: tooltipElement.scrollWidth > tooltipElement.clientWidth,
      stage: { left: stageBox.left, right: stageBox.right },
      viewportWidth: window.innerWidth,
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
      borderTopColor: style.borderTopColor,
      boxShadow: style.boxShadow,
      color: style.color,
      whiteSpace: style.whiteSpace,
      overflow: style.overflow,
      textOverflow: style.textOverflow,
      backgroundImage: style.backgroundImage,
      opacity: style.opacity,
    };
  });

  expect(state.role).toBe('tooltip');
  expect(state.hasEndContainedClass).toBe(alignment === 'fallback');
  expect(state.tooltip.left).toBeGreaterThanOrEqual(state.stage.left - 1);
  expect(state.tooltip.right).toBeLessThanOrEqual(state.stage.right + 1);
  expect(state.tooltip.left).toBeGreaterThanOrEqual(-1);
  expect(state.tooltip.right).toBeLessThanOrEqual(state.viewportWidth + 1);
  expect(state.tooltip.height).toBeLessThan(32);
  expect(state.isClipped).toBe(false);
  expect(state.backgroundColor).toBe('rgb(244, 251, 249)');
  expect(state.borderTopWidth).toBe('1px');
  expect(state.borderTopColor).toBe('rgba(15, 118, 110, 0.28)');
  expect(state.boxShadow).toContain('rgba(15, 118, 110, 0.14)');
  expect(state.color).toBe('rgb(16, 34, 32)');
  expect(state.whiteSpace).toBe('nowrap');
  expect(state.overflow).toBe('hidden');
  expect(state.textOverflow).toBe('ellipsis');
  expect(state.backgroundImage).toBe('none');
  expect(state.opacity).toBe('1');
}

async function expectLongTooltipOverflow(tooltip: ReturnType<Page['getByRole']>): Promise<void> {
  const state = await tooltip.evaluate((element) => {
    const tooltipElement = element as HTMLElement;
    const style = getComputedStyle(tooltipElement);
    return {
      fullText: tooltipElement.textContent,
      isClipped: tooltipElement.scrollWidth > tooltipElement.clientWidth,
      textOverflow: style.textOverflow,
      whiteSpace: style.whiteSpace,
    };
  });

  expect(state.fullText).toBe('소비 · 1,000,000원 · 100.0% · 화면 폭이 제한될 때에도 전체 접근 가능 텍스트를 유지하는 긴 설명 · 화면 폭이 제한될 때에도 전체 접근 가능 텍스트를 유지하는 긴 설명 · 화면 폭이 제한될 때에도 전체 접근 가능 텍스트를 유지하는 긴 설명');
  expect(state.isClipped).toBe(true);
  expect(state.whiteSpace).toBe('nowrap');
  expect(state.textOverflow).toBe('ellipsis');
}
