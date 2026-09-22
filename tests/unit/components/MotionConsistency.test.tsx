import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { PortfolioSetupFlow, type PortfolioSetupFlowProps } from '../../../src/portfolio/ui/PortfolioSetupFlow';
import { ExpenseAssistantDialog } from '../../../src/main/ui/dashboard/ExpenseAssistantDialog';
import { RemainingAllocationDialog } from '../../../src/main/ui/dashboard/RemainingAllocationDialog';

const anime = vi.hoisted(() => ({
  reduced: false,
  animate: vi.fn((_target: unknown, _options: Record<string, unknown>) => ({ cancel: vi.fn() })),
}));
vi.mock('animejs', () => ({
  animate: anime.animate,
  createScope: () => ({ add: (setup: () => void) => setup(), revert() {}, matches: { reducedMotion: anime.reduced } }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); anime.reduced = false; });
const props: PortfolioSetupFlowProps = {
  step: 'welcome', investmentWon: 200_000, saveError: false, applying: false, showSaving: false, fieldError: null,
  draft: { schemaVersion: 2, scope: { type: 'aggregate' }, items: [], cashShareUnits: 1_000_000,
    cashMode: 'automatic', inputMode: 'amount', isApplicable: true, syncedInvestmentWon: 200_000, updatedAt: 1 },
  onAction() {}, onPrevious() {}, onNext() {}, onApply() {}, now: () => 1,
};
it('continues setup progress from the visible fraction when steps change quickly', () => {
  const { container, rerender } = render(<PortfolioSetupFlow {...props} />);
  const fill = container.querySelector('.portfolio-setup__progress span') as HTMLElement;
  rerender(<PortfolioSetupFlow {...props} step="allocation" />);
  expect(parseFloat(fill.style.width)).toBeCloseTo(100 / 3);
  const [state, options] = anime.animate.mock.calls.find(([target]) => 'value' in (target as object))!;
  act(() => { (state as { value: number }).value = 50; (options.onUpdate as () => void)(); });
  expect(fill).toHaveStyle({ width: '50%' });
  rerender(<PortfolioSetupFlow {...props} step="review" />);
  expect(fill).toHaveStyle({ width: '50%' });
  act(() => { (state as { value: number }).value = 60; (options.onUpdate as () => void)(); });
  expect(fill).toHaveStyle({ width: '50%' });
  anime.reduced = true;
  rerender(<PortfolioSetupFlow {...props} step="welcome" />);
  expect(parseFloat(fill.style.width)).toBeCloseTo(100 / 3);
});
it('uses the shared edit frame for the remaining-money assistant', () => {
  render(<RemainingAllocationDialog applied={{ schemaVersion: 2, updatedAt: 1, monthlyNetIncomeWon: 3_200_000,
    monthlyHousingWon: 800_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 }}
    dirty={false} saveStatus="idle" onDraftChange={() => {}} onApply={() => {}} onCancel={() => {}} onClose={() => {}} />);
  const dialog = screen.getByRole('dialog', { name: '남는 돈 분배' });
  expect(dialog.querySelector('[data-surface-layout="edit"]')).toBeTruthy();
  expect(dialog.querySelector('[data-surface-body]')).toBeTruthy();
  expect(dialog.querySelector('[data-surface-footer]')).toBeTruthy();
});
it('uses the shared edit frame for the expense assistant', () => {
  render(<ExpenseAssistantDialog repository={{ load: () => null, save: vi.fn() }} onClose={() => {}} onApplied={() => {}} />);
  const dialog = screen.getByRole('dialog', { name: '지출 계산 도우미' });
  expect(dialog.querySelector('[data-surface-layout="edit"]')).toBeTruthy();
  expect(dialog.querySelector('[data-surface-body]')).toBeTruthy();
  expect(dialog.querySelector('[data-surface-footer]')).toBeTruthy();
});
