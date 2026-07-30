// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { AdvancedSettings } from '../../../src/simulation/ui/AdvancedSettings';

afterEach(cleanup);

const draft = createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456);

describe('AdvancedSettings', () => {
  it('does not persist blank, nonfinite, or over-precise rates', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings draft={draft} onChange={onChange} />);
    fireEvent.click(screen.getByText('고급 설정'));

    fireEvent.change(screen.getByRole('spinbutton', { name: '기준금리' }), {
      target: { value: '' },
    });
    expect(screen.getByText('−100%보다 크고 소수점 둘째 자리까지 입력해주세요.')).toBeVisible();

    fireEvent.change(screen.getByRole('spinbutton', { name: '물가상승률 차이' }), {
      target: { value: '0.123' },
    });
    expect(screen.getAllByText('−100%보다 크고 소수점 둘째 자리까지 입력해주세요.')).toHaveLength(2);
    expect(onChange).not.toHaveBeenCalled();
  });
});
