// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompoundSimulationDraft, SimulationMainSource } from '../../../src/simulation/domain/model';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import { SimulationOnboarding } from '../../../src/simulation/ui/SimulationOnboarding';
import { AccountDraftContext } from '../../../src/auth/AccountDraftContext';
import type { AccountWorkspaceSession } from '../../../src/workspace/infrastructure/accountWorkspaceSession';

afterEach(cleanup);

const source: SimulationMainSource = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

describe('SimulationOnboarding', () => {
  it('guides a high-principal user through a separate validated goal decision', () => {
    const onComplete = vi.fn();
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);

    expect(screen.getByRole('region', { name: '지금 모아둔 투자금이 있나요?' }))
      .toHaveClass('ui-surface');
    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    const initialAmount = screen.getByRole('textbox', { name: '현재 모아둔 투자금' });
    fireEvent.change(initialAmount, {
      target: { value: '200000000' },
    });
    expect(initialAmount).toHaveValue('200,000,000');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: '기간' })).not.toBeInTheDocument();
    const target = screen.getByRole('textbox', { name: '목표 금액' });
    expect(target).toHaveAttribute('inputmode', 'numeric');
    expect(document.activeElement).toBe(screen.getByRole('heading', {
      name: '다음에는 얼마를 모으고 싶나요?',
    }));

    fireEvent.change(target, { target: { value: '200000000' } });
    expect(screen.getByRole('button', { name: '다음' })).toBeDisabled();
    expect(target).toHaveAttribute('aria-describedby', 'goal-amount-error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '현재 모아둔 투자금보다 큰 금액을 입력해주세요.',
    );

    fireEvent.change(target, { target: { value: '250million' } });
    expect(target).toHaveValue('250million');
    expect(target).toHaveAttribute('aria-describedby', 'goal-amount-error');
    expect(screen.getByRole('alert')).toHaveTextContent(
      '숫자는 쉼표를 포함한 원 단위로 입력해주세요.',
    );

    fireEvent.change(target, { target: { value: '250,000,000' } });
    expect(target).toHaveValue('250,000,000');
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.getByRole('heading', { name: '매년 어느 정도 수익을 기대하나요?' })).toBeVisible();
    expect(screen.queryByRole('slider', { name: '기간' })).not.toBeInTheDocument();
    expect(screen.getByText('수익률 선택값은 상품 추천이나 과거 성과가 아닌 계산 가정입니다.'))
      .toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '연 기대수익률 13%' }));

    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 200_000_000,
      targetAmountWon: 250_000_000,
      years: 5,
      expectedAnnualReturnPercent: 13,
      updatedAt: 456,
    }));
  });

  it.each([
    [79_999_999, 100_000_000],
    [80_000_000, 200_000_000],
  ])('automatically uses a %s-won goal for %s-won starting assets', (
    initialInvestmentWon,
    targetAmountWon,
  ) => {
    const onComplete = vi.fn();
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    fireEvent.change(screen.getByRole('textbox', { name: '현재 모아둔 투자금' }), {
      target: { value: String(initialInvestmentWon) },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));

    expect(screen.queryByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' }))
      .not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '매년 어느 정도 수익을 기대하나요?' }))
      .toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon,
      targetAmountWon,
    }));
  });

  it('adjusts principal with large presets and never drops below zero', () => {
    render(<SimulationOnboarding source={source} now={() => 456} onComplete={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: '있어요' }));
    const input = screen.getByRole('textbox', { name: '현재 모아둔 투자금' });
    fireEvent.change(input, { target: { value: '5000000' } });
    expect(input).toHaveValue('5,000,000');

    fireEvent.click(screen.getByRole('button', { name: '-1000만' }));
    expect(input).toHaveValue('0');
    fireEvent.click(screen.getByRole('button', { name: '+100만' }));
    expect(input).toHaveValue('1,000,000');
    fireEvent.click(screen.getByRole('button', { name: '+1000만' }));
    expect(input).toHaveValue('11,000,000');
    fireEvent.click(screen.getByRole('button', { name: '-100만' }));
    expect(input).toHaveValue('10,000,000');
  });

  it('completes a migrated goal-required draft directly from the goal while preserving its settings', () => {
    const onComplete = vi.fn();
    const initialDraft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 123),
      initialInvestmentWon: 200_000_000,
      targetAmountWon: null,
      years: 17,
      expectedAnnualReturnPercent: 5,
      baseRatePercent: 3.25,
      inflationOffsetPercentPoints: -0.75,
      amountMode: 'real',
    };
    render(<SimulationOnboarding
      source={source}
      initialDraft={initialDraft}
      now={() => 456}
      onComplete={onComplete}
    />);

    expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
    fireEvent.change(screen.getByRole('textbox', { name: '목표 금액' }), {
      target: { value: '300000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(screen.queryByRole('heading', { name: '매년 어느 정도 수익을 기대하나요?' }))
      .not.toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 200_000_000,
      targetAmountWon: 300_000_000,
      years: 17,
      expectedAnnualReturnPercent: 5,
      baseRatePercent: 3.25,
      inflationOffsetPercentPoints: -0.75,
      amountMode: 'real',
      updatedAt: 456,
    }));
  });

  it('restores an unsubmitted principal input without completing or saving on mount', () => {
    const onComplete = vi.fn();
    const recordRecoveryDraft = vi.fn();
    const session = {
      readRecoveryDraft: (key: string) => key === 'simulation-onboarding-principal'
        ? {hasPrincipal: true, rawAmount: '250million'}
        : null,
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;

    render(
      <StrictMode>
        <AccountDraftContext.Provider value={session}>
          <SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />
        </AccountDraftContext.Provider>
      </StrictMode>,
    );

    expect(screen.getByRole('textbox', {name: '현재 모아둔 투자금'})).toHaveValue('250million');
    expect(onComplete).not.toHaveBeenCalled();
    expect(recordRecoveryDraft).not.toHaveBeenCalled();
  });

  it('restores an unsubmitted goal input without completing or saving on mount', () => {
    const onComplete = vi.fn();
    const recordRecoveryDraft = vi.fn();
    const initialDraft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 123),
      initialInvestmentWon: 200_000_000,
      targetAmountWon: null,
    };
    const session = {
      readRecoveryDraft: (key: string) => key === 'simulation-onboarding-goal'
        ? {rawAmount: '250million'}
        : null,
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;

    render(
      <AccountDraftContext.Provider value={session}>
        <SimulationOnboarding
          source={source}
          initialDraft={initialDraft}
          now={() => 456}
          onComplete={onComplete}
        />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByRole('textbox', {name: '목표 금액'})).toHaveValue('250million');
    expect(onComplete).not.toHaveBeenCalled();
    expect(recordRecoveryDraft).not.toHaveBeenCalled();
  });

  it('restores a typed return-stage draft without completing or saving on mount', () => {
    const onComplete = vi.fn();
    const recordRecoveryDraft = vi.fn();
    const draft = createDefaultSimulationDraft(source, 123);
    const session = {
      readRecoveryDraft: (key: string) => key === 'simulation-onboarding'
        ? {stage: 'return', draft}
        : null,
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;

    render(
      <AccountDraftContext.Provider value={session}>
        <SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByRole('heading', {name: '매년 어느 정도 수익을 기대하나요?'})).toBeVisible();
    expect(onComplete).not.toHaveBeenCalled();
    expect(recordRecoveryDraft).not.toHaveBeenCalled();
  });

  it('clears the parent recovery record only after an explicit final completion', () => {
    const onComplete = vi.fn();
    const recordRecoveryDraft = vi.fn();
    const session = {
      readRecoveryDraft: () => null,
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;

    render(
      <AccountDraftContext.Provider value={session}>
        <SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />
      </AccountDraftContext.Provider>,
    );

    fireEvent.click(screen.getByRole('button', {name: '없어요'}));
    fireEvent.click(screen.getByRole('button', {name: '결과 보기'}));

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(recordRecoveryDraft).toHaveBeenCalledWith('simulation-onboarding', null);
    expect(recordRecoveryDraft).toHaveBeenCalledWith('simulation-onboarding-return', null);
  });

  it('restores an invalid custom return input without completing or saving on mount', () => {
    const onComplete = vi.fn();
    const recordRecoveryDraft = vi.fn();
    const draft = createDefaultSimulationDraft(source, 123);
    const session = {
      readRecoveryDraft: (key: string) => {
        if (key === 'simulation-onboarding') return {stage: 'return', draft};
        if (key === 'simulation-onboarding-return') {
          return {customReturn: true, returnRaw: '30.123', returnError: true};
        }
        return null;
      },
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;

    render(
      <StrictMode>
        <AccountDraftContext.Provider value={session}>
          <SimulationOnboarding source={source} now={() => 456} onComplete={onComplete} />
        </AccountDraftContext.Provider>
      </StrictMode>,
    );

    expect(screen.getByRole('spinbutton', {name: '연 기대수익률 직접 입력'})).toHaveValue(30.123);
    expect(screen.getByRole('alert')).toHaveTextContent('0~30 사이, 소수점 둘째 자리까지 입력해주세요.');
    expect(screen.getByRole('button', {name: '결과 보기'})).toBeDisabled();
    expect(onComplete).not.toHaveBeenCalled();
    expect(recordRecoveryDraft).not.toHaveBeenCalled();
  });
});
