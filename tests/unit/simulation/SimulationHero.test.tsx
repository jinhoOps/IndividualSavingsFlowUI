// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { CompoundSimulationDraft } from '../../../src/simulation/domain/model';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { SimulationHero } from '../../../src/simulation/ui/SimulationHero';

afterEach(cleanup);

const draft: CompoundSimulationDraft & { targetAmountWon: number } = {
  ...createDefaultSimulationDraft({
    monthlySavingsWon: 300_000,
    monthlyInvestmentWon: 200_000,
    mainUpdatedAt: 123,
  }, 456),
  targetAmountWon: 100_000_000,
};

describe('SimulationHero', () => {
  it('renders the target reach duration with one nonduplicated condition line', () => {
    render(<SimulationHero draft={draft} result={projectCompoundGrowth(draft)} />);

    expect(screen.getByRole('heading', {
      name: /1억 원을 모으려면 \d+년/,
    })).toBeVisible();
    expect(screen.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
    expect(screen.queryByText('월 50만 원')).not.toBeInTheDocument();
  });

  it('states when a target cannot be reached within 30 years', () => {
    const unreachable = { ...draft, targetAmountWon: Number.MAX_SAFE_INTEGER };
    render(<SimulationHero draft={unreachable} result={projectCompoundGrowth(unreachable)} />);

    expect(screen.getByRole('heading', {
      name: /현재 조건으로는 30년 안에 .*에 도달하기 어려워요/,
    })).toBeVisible();
  });

  it('keeps milestone copy independent of graph years but reacts to return and amount mode', () => {
    const { rerender } = render(<SimulationHero draft={draft} result={projectCompoundGrowth(draft)} />);
    const originalCopy = screen.getByRole('heading').textContent;

    const changedYears = { ...draft, years: 0 };
    rerender(<SimulationHero draft={changedYears} result={projectCompoundGrowth(changedYears)} />);
    expect(screen.getByRole('heading')).toHaveTextContent(originalCopy ?? '');

    const changedReturn = { ...draft, expectedAnnualReturnPercent: 0 };
    rerender(<SimulationHero draft={changedReturn} result={projectCompoundGrowth(changedReturn)} />);
    expect(screen.getByRole('heading')).not.toHaveTextContent(originalCopy ?? '');

    const changedMode = { ...draft, amountMode: 'real' as const };
    rerender(<SimulationHero draft={changedMode} result={projectCompoundGrowth(changedMode)} />);
    expect(screen.getByRole('heading')).not.toHaveTextContent(originalCopy ?? '');
  });
});
