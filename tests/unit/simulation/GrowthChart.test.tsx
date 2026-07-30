// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { projectCompoundGrowth } from '../../../src/simulation/domain/projection';
import { GrowthChart } from '../../../src/simulation/ui/GrowthChart';

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
});
