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
    return tooltipBox.left >= stageBox.left - 1 && tooltipBox.right <= stageBox.right + 1;
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
