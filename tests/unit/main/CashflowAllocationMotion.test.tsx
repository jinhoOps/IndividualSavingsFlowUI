import { act, cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, expect, it, vi } from 'vitest';
import { CashflowAllocationSummary } from '../../../src/main/ui/dashboard/CashflowAllocationSummary';

const anime = vi.hoisted(() => ({
  reduced: false,
  animate: vi.fn((_target: unknown, _options: Record<string, unknown>) => ({ cancel: vi.fn() })),
}));
vi.mock('animejs', () => ({
  animate: anime.animate,
  createScope: () => ({ add: (setup: () => void) => setup(), revert() {}, matches: { reducedMotion: anime.reduced } }),
}));
afterEach(() => { cleanup(); vi.clearAllMocks(); anime.reduced = false; });
const data = { schemaVersion: 2 as const, updatedAt: 1, monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
const deficit = { ...data, monthlyInvestmentWon: 1_500_000 };

function latestFrame() {
  const call = anime.animate.mock.calls.filter(([target]) => 'progress' in (target as object)).at(-1);
  expect(call, 'the applied allocation must interpolate through Anime.js').toBeDefined();
  return { state: call![0] as { progress: number }, options: call![1] };
}
it('keeps the scale continuous through deficit and interrupted updates while exposing final semantics', () => {
  const { container, rerender, unmount } = render(<CashflowAllocationSummary data={data} />);
  const width = (id: string) => parseFloat((container.querySelector(`[data-segment="${id}"]`) as HTMLElement).style.width);
  rerender(<CashflowAllocationSummary data={deficit} />);
  expect(screen.getByRole('img')).toHaveAccessibleName(/40만 원 초과/);
  const first = latestFrame();
  act(() => { first.state.progress = 0.5; (first.options.onUpdate as () => void)(); });
  const intermediate = width('investment');
  expect(intermediate).toBeGreaterThan(6.25);
  expect(intermediate).toBeLessThan(150 / 360 * 100);
  expect(['consumption', 'saving', 'investment', 'remaining'].reduce((sum, id) => sum + width(id), 0)).toBeCloseTo(100);
  expect(container.querySelector('.cashflow-allocation__excess')).toHaveStyle({ opacity: '1' });
  rerender(<CashflowAllocationSummary data={data} />);
  expect(width('investment')).toBeCloseTo(intermediate);
  const second = latestFrame();
  act(() => { first.state.progress = 1; (first.options.onUpdate as () => void)(); });
  expect(width('investment')).toBeCloseTo(intermediate);
  act(() => { second.state.progress = 1; (second.options.onUpdate as () => void)(); });
  expect(width('investment')).toBeCloseTo(6.25);
  expect(container.querySelector('.cashflow-allocation__excess')).toHaveStyle({ opacity: '0' });
  unmount();
  expect(() => (second.options.onUpdate as () => void)()).not.toThrow();
});
it('commits final geometry and ratio immediately for reduced motion and animation failure', () => {
  const { container, rerender } = render(<CashflowAllocationSummary data={data} />);
  anime.reduced = true;
  rerender(<CashflowAllocationSummary data={deficit} />);
  expect(container.querySelector('[data-segment="remaining"]')).toHaveStyle({ width: '0%' });
  expect(container.querySelector('.cashflow-allocation__ratio [aria-hidden]')).toHaveTextContent('56.3%');
  anime.reduced = false;
  anime.animate.mockImplementation(() => { throw new Error('unavailable'); });
  rerender(<CashflowAllocationSummary data={data} />);
  expect(container.querySelector('[data-segment="investment"]')).toHaveStyle({ width: '6.25%' });
  expect(container.querySelector('.cashflow-allocation__ratio [aria-hidden]')).toHaveTextContent('15.6%');
});
