import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import type { MaterializedAllocation } from '../../../src/portfolio/domain/model';
import { PortfolioSummary } from '../../../src/portfolio/ui/PortfolioSummary';

afterEach(cleanup);

const allocation: MaterializedAllocation = {
  items: [{
    id: 'index', name: '미국 인덱스', order: 0,
    shareUnits: 600_000, amountWon: 120_000, percentage: 60,
  }],
  cashAmountWon: 80_000,
  cashPercentage: 40,
  totalAmountWon: 200_000,
};

describe('AllocationDonut', () => {
  it('links pointer detail to the matching table row', () => {
    render(<PortfolioSummary investmentWon={200_000} allocation={allocation} />);
    const segment = screen.getByRole('button', { name: '미국 인덱스 120,000원 60%' });
    fireEvent.pointerEnter(segment, { clientX: 120, clientY: 80 });
    expect(screen.getByRole('tooltip')).toHaveTextContent('미국 인덱스');
    expect(screen.getByRole('row', { name: /미국 인덱스/ })).toHaveAttribute('data-active', 'true');
    fireEvent.pointerLeave(screen.getByLabelText('투자 배분 도넛'));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('offers equivalent keyboard detail and moves to cash', () => {
    render(<PortfolioSummary investmentWon={200_000} allocation={allocation} />);
    const segment = screen.getByRole('button', { name: '미국 인덱스 120,000원 60%' });
    fireEvent.focus(segment);
    expect(screen.getByRole('tooltip')).toHaveTextContent('미국 인덱스');
    fireEvent.keyDown(segment, { key: 'ArrowRight' });
    expect(screen.getByRole('tooltip')).toHaveTextContent('현금');
  });

  it('activates the donut segment from the table', () => {
    render(<PortfolioSummary investmentWon={200_000} allocation={allocation} />);
    fireEvent.focus(screen.getByRole('row', { name: /현금/ }));
    expect(screen.getByRole('button', { name: '현금 80,000원 40%' }))
      .toHaveAttribute('data-active', 'true');
  });
});
