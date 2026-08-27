// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { AdvancedSettings } from '../../../src/simulation/ui/AdvancedSettings';

afterEach(cleanup);

const draft = createDefaultSimulationDraft({
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
}, 456);

function draftWithInitial(
  initialInvestmentWon: number,
  targetAmountWon: number | null = 100_000_000,
) {
  return {
    ...draft,
    initialInvestmentWon,
    targetAmountWon,
  };
}

function ControlledAdvancedSettings({
  initialDraft,
  onCommitted,
}: {
  initialDraft: typeof draft;
  onCommitted?: (next: typeof draft) => void;
}) {
  const [currentDraft, setCurrentDraft] = useState(initialDraft);
  return <AdvancedSettings
    draft={currentDraft}
    onChange={(next) => {
      setCurrentDraft(next);
      onCommitted?.(next);
    }}
  />;
}

describe('AdvancedSettings', () => {
  it('keeps a valid direct edit local until blur, then commits the formatted amount once', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(12_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));

    const input = screen.getByRole('textbox', { name: '현재 모아둔 돈' });
    expect(input).toHaveValue('12,000,000');
    fireEvent.change(input, { target: { value: '20000000' } });

    expect(input).toHaveValue('20000000');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.blur(input);

    expect(input).toHaveValue('20,000,000');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 20_000_000,
      targetAmountWon: 100_000_000,
    }));
  });

  it('moves an automatic goal with the edited accumulated amount threshold', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(70_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 돈' }), {
      target: { value: '80,000,000' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: '현재 모아둔 돈' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      initialInvestmentWon: 80_000_000,
      targetAmountWon: 200_000_000,
    }));
  });

  it('returns to goal setup when an edited amount reaches a user-defined goal', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(200_000_000, 300_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 돈' }), {
      target: { value: '300,000,000' },
    });
    fireEvent.blur(screen.getByRole('textbox', { name: '현재 모아둔 돈' }));

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      initialInvestmentWon: 300_000_000,
      targetAmountWon: null,
    }));
  });

  it('keeps a blank or invalid accumulated amount uncommitted and clearly invalid', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings
      draft={draftWithInitial(12_000_000)}
      onChange={onChange}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    const input = screen.getByRole('textbox', { name: '현재 모아둔 돈' });
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input).toHaveValue('');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('0원 이상 안전한 정수로 입력해주세요.');
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.change(input, { target: { value: '9007199254740992' } });
    fireEvent.blur(input);

    expect(input).toHaveValue('9007199254740992');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers accessible quick adjustments that commit their clamped next amounts', () => {
    const onCommitted = vi.fn();
    render(<ControlledAdvancedSettings
      initialDraft={draftWithInitial(200_000_000, null)}
      onCommitted={onCommitted}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    for (const name of ['-1억', '-5천만', '+5천만', '+1억']) {
      expect(screen.getByRole('button', { name })).toBeVisible();
    }

    fireEvent.click(screen.getByRole('button', { name: '-1억' }));
    fireEvent.click(screen.getByRole('button', { name: '-5천만' }));
    fireEvent.click(screen.getByRole('button', { name: '+5천만' }));
    fireEvent.click(screen.getByRole('button', { name: '+1억' }));

    expect(onCommitted).toHaveBeenNthCalledWith(1, expect.objectContaining({
      initialInvestmentWon: 100_000_000,
      targetAmountWon: 200_000_000,
    }));
    expect(onCommitted).toHaveBeenNthCalledWith(2, expect.objectContaining({
      initialInvestmentWon: 50_000_000,
      targetAmountWon: 100_000_000,
    }));
    expect(onCommitted).toHaveBeenNthCalledWith(3, expect.objectContaining({
      initialInvestmentWon: 100_000_000,
      targetAmountWon: 200_000_000,
    }));
    expect(onCommitted).toHaveBeenNthCalledWith(4, expect.objectContaining({
      initialInvestmentWon: 200_000_000,
      targetAmountWon: null,
    }));
  });

  it('clamps quick adjustments at zero and the safe-integer maximum', () => {
    const onCommitted = vi.fn();
    const { rerender } = render(<ControlledAdvancedSettings
      initialDraft={draftWithInitial(1_000_000)}
      onCommitted={onCommitted}
    />);

    fireEvent.click(screen.getByText('계산 기준'));
    fireEvent.click(screen.getByRole('button', { name: '-1억' }));
    expect(onCommitted).toHaveBeenLastCalledWith(expect.objectContaining({ initialInvestmentWon: 0 }));

    rerender(<ControlledAdvancedSettings
      key="maximum"
      initialDraft={draftWithInitial(Number.MAX_SAFE_INTEGER - 50_000_000, null)}
      onCommitted={onCommitted}
    />);
    fireEvent.click(screen.getByRole('button', { name: '+1억' }));
    expect(onCommitted).toHaveBeenLastCalledWith(expect.objectContaining({
      initialInvestmentWon: Number.MAX_SAFE_INTEGER,
      targetAmountWon: null,
    }));
  });

  it('does not persist blank, nonfinite, or over-precise rates', () => {
    const onChange = vi.fn();
    render(<AdvancedSettings draft={draft} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '명목' })).toBeVisible();
    expect(screen.getByRole('button', { name: '실질' })).toBeVisible();
    fireEvent.click(screen.getByText('계산 기준'));

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
