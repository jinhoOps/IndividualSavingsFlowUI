import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';

export function GoalAmountStep({
  initialInvestmentWon,
  onContinue,
  completesOnSubmit = false,
  submissionState = 'idle',
}: {
  initialInvestmentWon: number;
  onContinue(targetAmountWon: number): void;
  completesOnSubmit?: boolean;
  submissionState?: 'idle' | 'saving' | 'error';
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [rawAmount, setRawAmount] = useState('');
  const acceptedFormat = /^\d+$|^\d{1,3}(?:,\d{3})+$/.test(rawAmount);
  const targetAmountWon = acceptedFormat ? Number(rawAmount.replaceAll(',', '')) : Number.NaN;
  const validAmount = acceptedFormat && Number.isSafeInteger(targetAmountWon)
    && targetAmountWon > initialInvestmentWon;
  const showFormatError = rawAmount.length > 0 && !acceptedFormat;
  const showRangeError = rawAmount.length > 0 && acceptedFormat && !validAmount;
  const showError = showFormatError || showRangeError;

  useEffect(() => headingRef.current?.focus(), []);

  return (
    <Surface as="section" className="simulation-onboarding-step" aria-labelledby="goal-amount-title">
      <p className="simulation-eyebrow">다음 목표</p>
      <h1 id="goal-amount-title" ref={headingRef} tabIndex={-1}>
        다음에는 얼마를 모으고 싶나요?
      </h1>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (validAmount) onContinue(targetAmountWon);
      }}>
        <label htmlFor="goal-amount">목표 금액</label>
        <input
          id="goal-amount"
          type="text"
          inputMode="numeric"
          value={rawAmount}
          aria-invalid={showError}
          aria-describedby={showError ? 'goal-amount-error' : undefined}
          onChange={(event) => setRawAmount(event.target.value)}
        />
        {showError ? (
          <p id="goal-amount-error" role="alert">
            {showFormatError
              ? '숫자는 쉼표를 포함한 원 단위로 입력해주세요.'
              : '현재 모아둔 투자금보다 큰 금액을 입력해주세요.'}
          </p>
        ) : null}
        {submissionState === 'error' ? (
          <p className="simulation-goal-save-error" role="alert">
            목표를 저장하지 못했어요. 다시 시도해주세요.
          </p>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          disabled={!validAmount || submissionState === 'saving'}
        >
          {goalSubmitLabel(completesOnSubmit, submissionState)}
        </Button>
      </form>
    </Surface>
  );
}

function goalSubmitLabel(
  completesOnSubmit: boolean,
  submissionState: 'idle' | 'saving' | 'error',
): string {
  if (!completesOnSubmit) return '다음';
  if (submissionState === 'error') return '다시 시도';
  if (submissionState === 'saving') return '저장 중';
  return '결과 보기';
}
