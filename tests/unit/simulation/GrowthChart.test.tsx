// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { GrowthChart } from '../../../src/simulation/ui/GrowthChart';
import { formatWon } from '../../../src/simulation/ui/format';

afterEach(cleanup);

const result = projectCompoundGrowth(createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456));

describe('GrowthChart', () => {
  it('names both series and exposes yearly detail by keyboard focus', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    expect(screen.getByText('현재 계획')).toBeVisible();
    expect(screen.getByText('전부 저축')).toBeVisible();

    fireEvent.change(screen.getByRole('slider', { name: '그래프 연도 상세' }), {
      target: { value: '10' },
    });
    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    expect(screen.getByText('누적 납입원금')).toBeVisible();
    expect(screen.getByText('저축 잔액')).toBeVisible();
    expect(screen.getByText('투자 잔액')).toBeVisible();
  });

  it('dismisses detail with Escape or an outside pointer', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    const scrubber = screen.getByRole('slider', { name: '그래프 연도 상세' });
    fireEvent.change(scrubber, { target: { value: '10' } });
    fireEvent.keyDown(scrubber, { key: 'Escape' });
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();

    fireEvent.change(scrubber, { target: { value: '9' } });
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();
  });

  it('toggles the same chart point off on a repeated tap', () => {
    render(<GrowthChart result={result} amountMode="nominal" />);
    const chart = screen.getByRole('img', { name: '연도별 복리 성장 그래프' });
    Object.defineProperty(chart, 'getBoundingClientRect', {
      value: () => ({ left: 0, width: 680 }),
    });
    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 340 }));
    expect(screen.getByText('현재 계획 총액')).toBeVisible();
    fireEvent(chart, new MouseEvent('pointerdown', { bubbles: true, clientX: 340 }));
    expect(screen.queryByText('현재 계획 총액')).not.toBeInTheDocument();
  });

  it('shows real component balances consistently in real mode', () => {
    render(<GrowthChart result={result} amountMode="real" />);
    fireEvent.change(screen.getByRole('slider', { name: '그래프 연도 상세' }), {
      target: { value: '10' },
    });
    const final = result.points[10];
    expect(screen.getByText('저축 잔액').nextElementSibling).toHaveTextContent(
      formatWon(final.savingsRealWon),
    );
  });
});
