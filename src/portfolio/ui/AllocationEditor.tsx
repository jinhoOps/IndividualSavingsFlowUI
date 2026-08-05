import { useState } from 'react';
import type { PortfolioAction } from '../application/portfolioReducer';
import { materializeAllocation, normalizePortfolioName } from '../domain/allocation';
import type { PortfolioDraft } from '../domain/model';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export function AllocationEditor({
  draft,
  investmentWon,
  onAction,
  now,
  fieldError = null,
  createId = () => crypto.randomUUID(),
}: {
  draft: PortfolioDraft;
  investmentWon: number;
  onAction: (action: PortfolioAction) => void;
  now: () => number;
  fieldError?: string | null;
  createId?: () => string;
}) {
  const allocation = materializeAllocation(draft, investmentWon);
  const [rawValues, setRawValues] = useState<Record<string, string>>({});
  const isAtLimit = draft.items.length >= 10;
  const normalizedNameCounts = draft.items.reduce<Map<string, number>>((counts, item) => {
    const normalized = normalizePortfolioName(item.name);
    if (normalized.length > 0) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    return counts;
  }, new Map());

  function commitItem(id: string, fallback: number): void {
    const raw = rawValues[id];
    if (raw === undefined) return;
    const value = raw.trim() === '' ? 0 : Number(raw);
    onAction(draft.inputMode === 'amount'
      ? { type: 'draft-item-amount-changed', id, amountWon: value, now: now() }
      : { type: 'draft-item-percentage-changed', id, percentage: value, now: now() });
    setRawValues((current) => ({ ...current, [id]: String(Number.isFinite(value) ? value : fallback) }));
  }

  return (
    <section className="portfolio-editor" aria-labelledby="portfolio-editor-title">
      <header>
        <p>한 달 투자금을 배분합니다</p>
        <h1 id="portfolio-editor-title">투자 배분 설정</h1>
      </header>
      <fieldset className="portfolio-editor__mode">
        <legend>입력 방식</legend>
        <label><input type="radio" name="allocation-mode" checked={draft.inputMode === 'amount'} onChange={() => onAction({ type: 'input-mode-changed', mode: 'amount' })} />금액</label>
        <label><input type="radio" name="allocation-mode" checked={draft.inputMode === 'percentage'} onChange={() => onAction({ type: 'input-mode-changed', mode: 'percentage' })} />비율</label>
      </fieldset>

      <div className="portfolio-editor__items">
        {draft.items.map((item, index) => {
          const result = allocation.items.find((candidate) => candidate.id === item.id)!;
          const editableValue = draft.inputMode === 'amount' ? result.amountWon : result.percentage;
          const inputLabel = `${item.name || `투자 대상 ${index + 1}`} ${draft.inputMode === 'amount' ? '금액' : '비율'}`;
          const normalizedName = normalizePortfolioName(item.name);
          const nameError = normalizedName.length === 0
            ? '투자 대상 이름을 입력해 주세요.'
            : (normalizedNameCounts.get(normalizedName) ?? 0) > 1
              ? '같은 이름의 투자 대상이 이미 있습니다.'
              : null;
          const nameErrorId = `portfolio-name-error-${index}`;
          return (
            <div className="portfolio-editor__row" key={item.id}>
              <label>
                <span>투자 대상 이름 {index + 1}</span>
                <input
                  aria-label={`투자 대상 이름 ${index + 1}`}
                  aria-invalid={nameError ? 'true' : undefined}
                  aria-describedby={nameError ? nameErrorId : undefined}
                  value={item.name}
                  onChange={(event) => onAction({ type: 'draft-name-changed', id: item.id, name: event.target.value, now: now() })}
                />
                {nameError ? <span className="portfolio-editor__field-error" id={nameErrorId}>{nameError}</span> : null}
              </label>
              <label>
                <span>{draft.inputMode === 'amount' ? '금액' : '비율'}</span>
                <input
                  aria-label={inputLabel}
                  inputMode={draft.inputMode === 'amount' ? 'numeric' : 'decimal'}
                  value={rawValues[item.id] ?? editableValue}
                  onChange={(event) => setRawValues((current) => ({ ...current, [item.id]: event.target.value }))}
                  onBlur={() => commitItem(item.id, editableValue)}
                />
              </label>
              <div className="portfolio-editor__computed" aria-label={`${item.name || `투자 대상 ${index + 1}`} 계산 결과`}>
                <span>{formatPortfolioWon(result.amountWon)}</span>
                <span>{formatAllocationPercent(result.percentage)}</span>
              </div>
              <button type="button" onClick={() => onAction({ type: 'draft-item-removed', id: item.id, now: now() })}>
                {item.name || `투자 대상 ${index + 1}`} 삭제
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        disabled={isAtLimit}
        onClick={() => onAction({
          type: 'draft-item-added',
          item: { id: createId(), name: '', order: draft.items.length },
          now: now(),
        })}
      >투자 대상 추가</button>
      {isAtLimit ? <p role="status">투자 대상은 최대 10개까지 추가할 수 있습니다</p> : null}

      <section className="portfolio-editor__cash" aria-labelledby="portfolio-cash-title">
        <h2 id="portfolio-cash-title">현금</h2>
        <label>
          <span>{draft.inputMode === 'amount' ? '현금 금액' : '현금 비율'}</span>
          <input
            aria-label={draft.inputMode === 'amount' ? '현금 금액' : '현금 비율'}
            inputMode={draft.inputMode === 'amount' ? 'numeric' : 'decimal'}
            value={rawValues.cash ?? (draft.inputMode === 'amount' ? allocation.cashAmountWon : allocation.cashPercentage)}
            onChange={(event) => setRawValues((current) => ({ ...current, cash: event.target.value }))}
            onBlur={() => {
              const value = Number(rawValues.cash ?? (draft.inputMode === 'amount' ? allocation.cashAmountWon : allocation.cashPercentage));
              const amountWon = draft.inputMode === 'amount' ? value : Math.round(investmentWon * value / 100);
              onAction({ type: 'draft-cash-changed', amountWon, now: now() });
            }}
          />
        </label>
        <span>{formatPortfolioWon(allocation.cashAmountWon)}</span>
        <span>{formatAllocationPercent(allocation.cashPercentage)}</span>
        {draft.cashMode === 'manual' ? (
          <div>
            <p role="status">현금 직접 배분 중</p>
            <p>남은 투자금을 현금으로 자동 배분합니다</p>
            <button type="button" onClick={() => onAction({ type: 'automatic-cash-enabled', now: now() })}>
              현금 자동 배분 켜기
            </button>
          </div>
        ) : <p role="status">남은 투자금 자동 배분</p>}
      </section>
      {fieldError ? <p role="alert">{errorMessage(fieldError)}</p> : null}
    </section>
  );
}

function errorMessage(code: string): string {
  const messages: Record<string, string> = {
    'allocation-exceeds-investment': '투자금을 초과해 배분할 수 없습니다.',
    'amount-below-minimum': '투자 대상 금액은 1,000원 이상이어야 합니다.',
    'invalid-percentage': '비율은 0.1% 단위까지 입력할 수 있습니다.',
    'too-many-items': '투자 대상은 최대 10개까지 추가할 수 있습니다.',
  };
  return messages[code] ?? '입력값을 확인해 주세요.';
}
