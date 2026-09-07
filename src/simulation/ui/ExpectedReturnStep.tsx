import { useContext, useEffect, useRef, useState } from 'react';
import {
  AccountDraftContext,
  useAccountRecovery,
  useInitialRecovery,
} from '../../auth/AccountDraftContext';
import { Button } from '../../components/common/Button';
import { Surface } from '../../components/common/Surface';
import type { CompoundSimulationDraft } from '../domain/model';

const RETURN_PRESETS = [5, 9, 13] as const;

interface ReturnRecoveryDraft {
  customReturn: boolean;
  returnRaw: string;
  returnError: boolean;
}

function isValidReturnRaw(raw: string): boolean {
  const value = Number(raw);
  return /^(?:\d+)(?:\.\d{0,2})?$/.test(raw)
    && Number.isFinite(value) && value >= 0 && value <= 30;
}

function parseReturnRecoveryDraft(value: unknown): ReturnRecoveryDraft | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const draft = value as Record<string, unknown>;
  if (
    typeof draft.customReturn !== 'boolean'
    || typeof draft.returnRaw !== 'string'
    || typeof draft.returnError !== 'boolean'
    || draft.returnRaw.length > 32
    || draft.returnError === isValidReturnRaw(draft.returnRaw)
  ) {
    return null;
  }
  return {
    customReturn: draft.customReturn,
    returnRaw: draft.returnRaw,
    returnError: draft.returnError,
  };
}

export function ExpectedReturnStep({
  draft,
  onChange,
  onComplete,
}: {
  draft: CompoundSimulationDraft;
  onChange(next: CompoundSimulationDraft): void;
  onComplete(): void;
}) {
  const session = useContext(AccountDraftContext);
  const recovered = useInitialRecovery('simulation-onboarding-return', parseReturnRecoveryDraft);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const previousExpectedReturnRef = useRef(draft.expectedAnnualReturnPercent);
  const [returnRaw, setReturnRaw] = useState(
    () => recovered?.returnRaw ?? String(draft.expectedAnnualReturnPercent),
  );
  const [returnError, setReturnError] = useState(() => recovered?.returnError ?? false);
  const [customReturn, setCustomReturn] = useState(
    () => recovered?.customReturn
      ?? !RETURN_PRESETS.includes(draft.expectedAnnualReturnPercent as 5 | 9 | 13),
  );
  const [dirty, setDirty] = useState(false);

  useAccountRecovery(
    'simulation-onboarding-return',
    { customReturn, returnRaw, returnError },
    dirty,
    dirty,
  );

  useEffect(() => headingRef.current?.focus(), []);
  useEffect(() => {
    if (previousExpectedReturnRef.current === draft.expectedAnnualReturnPercent) return;
    previousExpectedReturnRef.current = draft.expectedAnnualReturnPercent;
    setReturnRaw(String(draft.expectedAnnualReturnPercent));
    if (!RETURN_PRESETS.includes(draft.expectedAnnualReturnPercent as 5 | 9 | 13)) {
      setCustomReturn(true);
    }
  }, [draft.expectedAnnualReturnPercent]);

  function updateReturn(value: number): void {
    const next = Math.max(0, Math.min(30, Math.round(value * 100) / 100));
    setReturnRaw(String(next));
    setReturnError(false);
    setDirty(true);
    onChange({ ...draft, expectedAnnualReturnPercent: next });
  }

  return (
    <Surface as="section" className="simulation-onboarding-step" aria-labelledby="expected-return-title">
      <p className="simulation-eyebrow">기대 수익률</p>
      <h1 id="expected-return-title" ref={headingRef} tabIndex={-1}>
        매년 어느 정도 수익을 기대하나요?
      </h1>
      <fieldset className="simulation-control-group">
        <legend>연 기대수익률</legend>
        <div className="simulation-preset-row">
          {RETURN_PRESETS.map((rate) => (
            <Button
              type="button"
              variant="secondary"
              key={rate}
              aria-label={`연 기대수익률 ${rate}%`}
              aria-pressed={!customReturn && draft.expectedAnnualReturnPercent === rate}
              onClick={() => {
                setCustomReturn(false);
                updateReturn(rate);
              }}
            >
              {rate}%
            </Button>
          ))}
          <Button
            type="button"
            variant="secondary"
            aria-pressed={customReturn}
              onClick={() => {
                setCustomReturn(true);
                setReturnError(false);
                setDirty(true);
            }}
          >
            직접 입력
          </Button>
        </div>

        {customReturn ? (
          <div className="simulation-custom-return">
            <Button
              type="button"
              variant="secondary"
              aria-label="기대수익률 0.25%p 내리기"
              disabled={draft.expectedAnnualReturnPercent <= 0}
              onClick={() => updateReturn(draft.expectedAnnualReturnPercent - 0.25)}
            >
              −
            </Button>
            <label className="simulation-number-field">
              <span className="sr-only">연 기대수익률 직접 입력</span>
              <input
                aria-label="연 기대수익률 직접 입력"
                type="number"
                min="0"
                max="30"
                step="0.01"
                value={returnRaw}
                aria-invalid={returnError}
                aria-describedby={returnError ? 'simulation-return-error' : undefined}
                onChange={(event) => {
                  const raw = event.target.value;
                  const value = Number(raw);
                  const valid = isValidReturnRaw(raw);
                  setReturnRaw(raw);
                  setReturnError(!valid);
                  setDirty(true);
                  if (valid) onChange({ ...draft, expectedAnnualReturnPercent: value });
                }}
              />
              <span aria-hidden="true">%</span>
            </label>
            <Button
              type="button"
              variant="secondary"
              aria-label="기대수익률 0.25%p 올리기"
              disabled={draft.expectedAnnualReturnPercent >= 30}
              onClick={() => updateReturn(draft.expectedAnnualReturnPercent + 0.25)}
            >
              +
            </Button>
          </div>
        ) : null}
        {returnError ? (
          <p id="simulation-return-error" role="alert">
            0~30 사이, 소수점 둘째 자리까지 입력해주세요.
          </p>
        ) : null}
      </fieldset>
      <p className="simulation-preset-note">
        수익률 선택값은 상품 추천이나 과거 성과가 아닌 계산 가정입니다.
      </p>
      <Button
        type="button"
        variant="primary"
        disabled={returnError}
        onClick={() => {
          session?.recordRecoveryDraft('simulation-onboarding-return', null);
          setDirty(false);
          onComplete();
        }}
      >
        결과 보기
      </Button>
    </Surface>
  );
}
