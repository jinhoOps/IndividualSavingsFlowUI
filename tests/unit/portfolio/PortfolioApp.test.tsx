import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { PortfolioMainSourceRepository } from '../../../src/portfolio/infrastructure/mainSourceRepository';
import { PortfolioApp } from '../../../src/portfolio/ui/PortfolioApp';
import { createMemoryPortfolioRepository } from './MemoryPortfolioRepository';

afterEach(cleanup);

const plan: PortfolioPlan = {
  schemaVersion: 1,
  items: [{ id: 'a', name: '인덱스', shareUnits: 600_000, order: 0 }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};
const mainFound: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 200_000, mainUpdatedAt: 1 } }),
};
const zeroMain: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 0, mainUpdatedAt: 1 } }),
};

describe('PortfolioApp', () => {
  it('opens setup on first run', () => {
    render(<PortfolioApp mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository()} now={() => 1} />);
    expect(screen.getByRole('heading', { name: '투자 배분 설정' })).toBeVisible();
  });

  it('revisits a saved plan result-first', () => {
    render(<PortfolioApp mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 2} />);
    expect(screen.getByText('한 달 투자금을 배분합니다')).toBeVisible();
    expect(screen.getByRole('heading', { name: /투자금/ })).toBeVisible();
  });

  it('preserves the plan behind a zero-investment blurred gate', () => {
    render(<PortfolioApp mainSourceRepository={zeroMain} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 1} />);
    expect(screen.getByTestId('portfolio-gated-content')).toHaveClass('portfolio-content--blurred');
    expect(screen.getByRole('link', { name: 'Main에서 투자금 설정' }))
      .toHaveAttribute('href', expect.stringContaining('?edit=investment'));
  });
});
