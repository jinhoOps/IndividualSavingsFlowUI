import { useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { AccountDraftContext, AccountWriteRecoveryContext } from '../../../auth/AccountDraftContext';
import { AccountProductBoundary } from '../../../auth/AccountManagementContext';
import { ResponsiveDialog, type DialogCloseReason } from '../../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../../components/common/ResponsiveDialogLayout';
import type { MainState } from '../../application/mainReducer';
import type { MainData } from '../../domain/model';
import { allocateRemaining, availableRemainingWon } from '../../domain/remainingAllocation';
import { Button } from '../common/Button';
import { SavingOverlay } from '../common/SavingOverlay';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;

export function RemainingAllocationDialog({ applied, dirty, saveStatus, returnFocusRef, onDraftChange, onApply, onCancel, onClose }: {
  applied: MainData;
  dirty: boolean;
  saveStatus: MainState['saveStatus'];
  returnFocusRef?: RefObject<HTMLElement | null>;
  onDraftChange(data: MainData): void;
  onApply(): void;
  onCancel(): void;
  onClose(): void;
}) {
  const fallbackFocusRef = useRef<HTMLElement | null>(null);
  const session = useContext(AccountDraftContext);
  const recoverWrite = useContext(AccountWriteRecoveryContext);
  const [base] = useState(applied);
  const available = availableRemainingWon(base);
  const [savingWon, setSavingWon] = useState(0);
  const [investmentWon, setInvestmentWon] = useState(0);
  const [inputError, setInputError] = useState('');
  const [recovering, setRecovering] = useState(false);
  const submitted = useRef(false);
  const submitting = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const busy = saveStatus === 'saving' || recovering;
  const pending = !!session?.pending;
  const proposal = allocateRemaining(base, savingWon, investmentWon);
  const total = savingWon + investmentWon;
  const error = inputError || (!proposal ? '추가할 금액이 남는 돈보다 많아요. 금액을 줄여주세요.' : '');

  useLayoutEffect(() => { headingRef.current?.focus(); }, []);
  useEffect(() => {
    if (saveStatus !== 'saving') submitting.current = false;
    if (submitted.current && saveStatus === 'saved' && !dirty) onClose();
  }, [saveStatus, dirty, onClose]);

  function change(saving: number, investment: number) {
    if (busy || pending) return;
    submitted.current = false;
    setInputError(''); setSavingWon(saving); setInvestmentWon(investment);
    const next = allocateRemaining(base, saving, investment);
    if (next) onDraftChange(next);
    // Register even an initially rejected edit so cancel clears account edit tracking.
    else if (!dirty) onDraftChange(base);
  }

  function requestClose(_reason: DialogCloseReason): boolean {
    if (busy || submitting.current) return false;
    // An unresolved request must be reconciled through the existing account recovery UI.
    if (pending) return true;
    if (dirty || total > 0 || inputError) {
      if (!window.confirm('나누던 금액을 반영하지 않고 닫을까요?')) return false;
      if (dirty) onCancel();
    }
    return true;
  }

  return <ResponsiveDialog open labelledBy="remaining-allocation-title" size="form" busy={busy} mobileEntranceMotion
    returnFocusRef={returnFocusRef ?? fallbackFocusRef} onRequestClose={requestClose} onClosed={onClose}>
    {({ requestClose: closeDialog }) => <AccountProductBoundary><ResponsiveDialogLayout title="남는 돈 분배" titleId="remaining-allocation-title"
      eyebrow={available > 0 ? `이번 달 남는 돈 ${won(available)}` : '이번 달 남는 돈 없음'}
      onClose={() => undefined}
      status={saveStatus === 'error' ? <div className="expense-assistant__error" role="alert">
        <p>{session?.status === 'conflict' ? '다른 곳에서 계획이 바뀌었어요. 도우미를 닫고 최신 저장 계획을 확인한 뒤 다시 나눠주세요.' : '저장을 확인하지 못했습니다. 입력한 금액은 유지돼요.'}</p>
        {recoverWrite && pending && session?.status === 'uncertain' && <Button type="button" variant="secondary" disabled={busy} onClick={async () => {
          if (submitting.current) return;
          submitting.current = true; setRecovering(true);
          try { await recoverWrite(); } finally { submitting.current = false; setRecovering(false); }
        }}>저장 결과 다시 확인</Button>}
        {pending && session?.status === 'conflict' && <Button type="button" variant="secondary" onClick={() => closeDialog('button')}>닫고 저장 상태 확인</Button>}
      </div> : undefined}
      footer={<div className="expense-assistant__footer">
        <SavingOverlay saving={busy} />
        {available > 0 ? <>
          <div className="expense-assistant__total" aria-live="polite"><span>나눈 뒤 남는 돈</span><strong>{proposal ? won(available - total) : '금액 확인 필요'}</strong></div>
          <p className="expense-assistant__hint">기존 월 저축·투자 금액에 더해요.</p>
          <div className="expense-assistant__actions">
            <Button type="button" variant="secondary" disabled={busy} onClick={() => closeDialog('button')}>나중에</Button>
            <Button type="button" variant="primary" disabled={busy || pending || !!error || total <= 0} onClick={() => {
              if (submitting.current || !proposal) return;
              submitting.current = true; submitted.current = true; onApply();
            }}>이렇게 나누기</Button>
          </div>
        </> : <Button type="button" className="expense-assistant__apply" variant="primary" onClick={() => closeDialog('button')}>확인</Button>}
      </div>}
    >
      <div className="remaining-allocation">
        <h3 tabIndex={-1} ref={headingRef}>{available > 0 ? '남는 돈을 더 모아볼까요?' : '지금은 나눌 돈이 없어요'}</h3>
        {available > 0 ? <>
          <p className="expense-assistant__hint">저축·투자에 더 넣고, 일부는 남겨둬도 좋아요.</p>
          <div className="remaining-allocation__available"><span>이번 달 남는 돈</span><strong>{won(available)}</strong></div>
          <div className="remaining-allocation__presets" role="group" aria-label="빠르게 나누기">
            <Button type="button" variant="secondary" disabled={busy || pending} onClick={() => change(available, 0)}>저축에 전부</Button>
            <Button type="button" variant="secondary" disabled={busy || pending} onClick={() => change(0, available)}>투자에 전부</Button>
            <Button type="button" variant="secondary" disabled={busy || pending} onClick={() => change(Math.ceil(available / 2), Math.floor(available / 2))}>반씩 나누기</Button>
          </div>
          <p className="sr-only" id="remaining-input-hint">추가할 금액을 직접 조정할 수 있어요.</p>
          <div className="remaining-allocation__fields">
            {([{ id: 'saving', label: '저축에 추가', value: savingWon, before: base.monthlySavingWon },
              { id: 'investment', label: '투자에 추가', value: investmentWon, before: base.monthlyInvestmentWon }] as const).map(field => <div key={field.id}>
              <label htmlFor={`remaining-${field.id}`}>{field.label}</label>
              <div className="remaining-allocation__input">
                <input id={`remaining-${field.id}`} type="text" inputMode="numeric" autoComplete="off" disabled={busy || pending}
                  value={field.value === 0 ? '' : field.value.toLocaleString('ko-KR')} placeholder="0" aria-invalid={!!error}
                  aria-describedby={`remaining-input-hint remaining-${field.id}-preview${error ? ' remaining-allocation-error' : ''}`}
                  onChange={event => {
                    const raw = event.target.value.replaceAll(',', '');
                    if (!/^\d*$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
                      if (!dirty) onDraftChange(base);
                      setInputError('0 이상의 원 단위 금액을 입력해주세요.'); return;
                    }
                    change(field.id === 'saving' ? Number(raw) : savingWon, field.id === 'investment' ? Number(raw) : investmentWon);
                  }} /><span aria-hidden="true">원</span>
              </div>
              <p id={`remaining-${field.id}-preview`} className="remaining-allocation__preview">현재 {won(field.before)}<span>반영 후 <strong>{proposal ? won(field.before + field.value) : '금액 확인 필요'}</strong></span></p>
            </div>)}
          </div>
          {error && <p id="remaining-allocation-error" className="expense-assistant__error" role="alert">{error}</p>}
        </> : <p className="expense-assistant__hint">{base.monthlyNetIncomeWon < base.monthlyHousingWon + base.monthlyLivingWon + base.monthlySavingWon + base.monthlyInvestmentWon
          ? '지금 계획은 수입보다 나가는 돈이 많아요. 월 금액 편집에서 지출과 저축·투자 금액을 먼저 확인해주세요.'
          : '수입이 지출과 저축·투자에 모두 배분되어 있어요. 금액을 바꾸려면 월 금액 편집에서 조정해주세요.'}</p>}
      </div>
    </ResponsiveDialogLayout></AccountProductBoundary>}
  </ResponsiveDialog>;
}
