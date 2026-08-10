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
    classification: 'growth', classificationOrigin: 'automatic',
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

  it('clamps a pointer tooltip inside the viewport edges', () => {
    const originalPointerEvent = window.PointerEvent;
    Object.defineProperties(window, {
      innerWidth: { configurable: true, value: 390 },
      innerHeight: { configurable: true, value: 844 },
      PointerEvent: { configurable: true, value: MouseEvent },
    });
    const original = HTMLElement.prototype.getBoundingClientRect;
    HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
      if (this.getAttribute('role') === 'tooltip') {
        return { x: 0, y: 0, width: 140, height: 64, top: 0, right: 140, bottom: 64, left: 0, toJSON: () => ({}) };
      }
      return original.call(this);
    };

    try {
      render(<PortfolioSummary investmentWon={200_000} allocation={allocation} />);
      fireEvent.pointerEnter(screen.getByRole('button', { name: '미국 인덱스 120,000원 60%' }), {
        clientX: 385,
        clientY: 840,
      });

      expect(screen.getByRole('tooltip')).toHaveStyle({ left: '234px', top: '764px' });
    } finally {
      HTMLElement.prototype.getBoundingClientRect = original;
      Object.defineProperty(window, 'PointerEvent', { configurable: true, value: originalPointerEvent });
    }
  });
});
