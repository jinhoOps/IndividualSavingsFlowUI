// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { SimulationHero } from '../../../src/simulation/ui/SimulationHero';

afterEach(cleanup);

const draft = createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456);

describe('SimulationHero', () => {
  it('renders one result sentence and one nonduplicated condition line', () => {
    render(<SimulationHero draft={draft} result={projectCompoundGrowth(draft)} />);

    expect(screen.getByRole('heading', {
      name: /이대로 20년 유지하면 .*이 됩니다!/,
    })).toBeVisible();
    expect(screen.getByText('월 저축 30만 원 · 투자 20만 원 · 연 9%')).toBeVisible();
    expect(screen.queryByText('월 50만 원')).not.toBeInTheDocument();
  });

  it('uses current-starting-asset copy at year zero', () => {
    const current = { ...draft, years: 0, initialInvestmentWon: 10_000_000 };
    render(<SimulationHero draft={current} result={projectCompoundGrowth(current)} />);

    expect(screen.getByRole('heading', {
      name: '현재 시작 자산은 1,000만 원입니다!',
    })).toBeVisible();
  });
});
