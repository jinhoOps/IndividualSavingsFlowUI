import { useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { ArrowLeft } from 'lucide-react';
import { AccountProductBoundary } from '../../../auth/AccountManagementContext';
import { MoneyAdjustments } from '../../../components/common/MoneyAdjustments';
import { SegmentedControl } from '../../../components/common/SegmentedControl';
import { ResponsiveDialog, type DialogCloseReason } from '../../../components/common/ResponsiveDialog';
import { ResponsiveDialogLayout } from '../../../components/common/ResponsiveDialogLayout';
import { AccountDraftContext, AccountWriteRecoveryContext, useAccountRecovery, useInitialRecovery } from '../../../auth/AccountDraftContext';
import { createExpenseDraft, expenseAnswersComplete, expenseTotals, EXPENSE_ITEMS, parseExpenseDraft, type ExpenseAssistantDraft } from '../../domain/expenseAssistant';
import type { MainData } from '../../domain/model';
import type { ExpenseAssistantRepository } from '../../infrastructure/expenseAssistantRepository';
import { Button } from '../common/Button';
import { SavingOverlay } from '../common/SavingOverlay';
import { formatDashboardWon } from './CashflowSummary';

export function ExpenseAssistantDialog({ repository, returnFocusRef, onClose, onApplied }: {
  repository: ExpenseAssistantRepository;
  returnFocusRef?: RefObject<HTMLElement | null>;
  onClose(): void;
  onApplied(data: MainData): void;
}) {
  const fallbackFocusRef = useRef<HTMLElement | null>(null);
  const session = useContext(AccountDraftContext);
  const recoverWrite = useContext(AccountWriteRecoveryContext);
  const recovered = useInitialRecovery('main-expense', parseExpenseDraft);
  const [initial] = useState(() => {
    try { return { draft: repository.load()?.draft ?? createExpenseDraft(), error: '' }; }
    catch { return { draft: createExpenseDraft(), error: '저장된 답변을 불러오지 못했습니다. 닫은 뒤 다시 열어주세요.' }; }
  });
  const [draft, setDraft] = useState(recovered ?? initial.draft);
  const [persisted, setPersisted] = useState(initial.draft);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState(initial.error);
  const [invalidAmount, setInvalidAmount] = useState(false);
  const [returnToReview, setReturnToReview] = useState(() => expenseAnswersComplete((recovered ?? initial.draft).answers));
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(persisted);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useAccountRecovery('main-expense', draft, dirty, !initial.error);
  const index = EXPENSE_ITEMS.findIndex(item => item.id === draft.step);
  const item = index < 0 ? null : EXPENSE_ITEMS[index];
  const answer = item ? draft.answers[item.id] : null;
  const [period, setPeriod] = useState<'month' | 'year'>(answer?.period ?? 'month');
  useEffect(() => { setPeriod(item ? draft.answers[item.id]?.period ?? 'month' : 'month'); }, [draft.step]);
  const totals = expenseTotals(draft.answers);
  const answered = EXPENSE_ITEMS.filter(({ id }) => draft.answers[id] !== null).length;

  useLayoutEffect(() => { setInvalidAmount(false); headingRef.current?.focus(); }, [draft.step]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);

  async function save(next: ExpenseAssistantDraft, complete = false): Promise<boolean> {
    if (busyRef.current || initial.error) return false;
    busyRef.current = true;
    setBusy(true); setError('');
    try {
      const result = await repository.save(next, complete);
      setDraft(result.assistant.draft); setPersisted(result.assistant.draft);
      dirtyRef.current = false;
      session?.recordRecoveryDraft('main-expense', null);
      if (complete) onApplied(result.data);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '답변을 저장하지 못했습니다. 다시 시도해주세요.');
      return false;
    } finally { busyRef.current = false; setBusy(false); }
  }

  function requestClose(_reason: DialogCloseReason): boolean | Promise<boolean> {
    if (busyRef.current) return false;
    if (session && (session.pending || session.status === 'offline')) return true;
    if (dirtyRef.current && !initial.error) return save(draft);
    return true;
  }
  function next(none = false) {
    if (!item || (!none && invalidAmount)) return;
    setInvalidAmount(false);
    const step = returnToReview ? 'review' : EXPENSE_ITEMS[index + 1]?.id ?? 'review';
    const nextDraft: ExpenseAssistantDraft = { ...draft, step, updatedAt: Date.now(), answers: {
      ...draft.answers, [item.id]: none ? { amountWon: 0, period: 'month' } : answer ?? { amountWon: 0, period },
    } };
    // Preserve this answer locally even if the request fails.
    setDraft({ ...nextDraft, step: draft.step });
    void save(nextDraft);
  }

  return <ResponsiveDialog open labelledBy="expense-assistant-title" size="form" busy={busy} mobileEntranceMotion
    returnFocusRef={returnFocusRef ?? fallbackFocusRef} onRequestClose={requestClose} onClosed={onClose}>
    {({ requestClose: closeDialog }) => <AccountProductBoundary><ResponsiveDialogLayout title="지출 계산 도우미" titleId="expense-assistant-title"
      eyebrow={item ? `답변 ${index + 1} / ${EXPENSE_ITEMS.length}` : `답변 ${answered}개 / ${EXPENSE_ITEMS.length}`}
      onClose={() => undefined}
      status={error ? <div className="expense-assistant__error" role="alert"><p>{error}</p>
        {recoverWrite && session?.pending && ['save_expense_draft', 'apply_expense'].includes(session.pending.operation) && (session.status === 'uncertain' || session.status === 'conflict') ?
          <Button type="button" variant="secondary" disabled={busy} onClick={async () => {
            if (busyRef.current) return;
            busyRef.current = true; setBusy(true);
            try { await recoverWrite(session.status === 'conflict'); }
            finally { busyRef.current = false; setBusy(false); }
          }}>{session.status === 'conflict' ? '최신 상태에서 다시 적용' : '저장 결과 다시 확인'}</Button> : null}
      </div> : undefined}
      footer={<div className="expense-assistant__footer">
        <SavingOverlay saving={busy} />
        <div className="expense-assistant__total"><span>{item ? '지금까지 월평균' : '월 지출 합계'}</span><strong>{totals ? formatDashboardWon(totals.totalWon) : '금액 범위 초과'}</strong></div>
        {!item && totals ? <p className="expense-assistant__hint">주거 {formatDashboardWon(totals.housingWon)} · 생활 {formatDashboardWon(totals.livingWon)}<br />직접 입력한 주거비와 생활비를 이 합계로 바꿔요.</p> : null}
        {item ? <div className="expense-assistant__actions">
          <Button type="button" variant="secondary" disabled={busy || !!initial.error} onClick={() => next(true)}>없어요</Button>
          <Button type="button" variant="primary" disabled={busy || invalidAmount || !totals || !!initial.error} onClick={() => next()}>{returnToReview ? '내역으로' : index === EXPENSE_ITEMS.length - 1 ? '합계 확인' : '다음'}</Button>
        </div> : <Button className="expense-assistant__apply" type="button" variant="primary" disabled={busy || !expenseAnswersComplete(draft.answers) || !totals || !!initial.error} onClick={async () => {
          if (await save(draft, true)) closeDialog('button');
        }}>이 금액으로 반영</Button>}
      </div>}
    >
      <div className={`expense-assistant__content${item && 'example' in item ? ' expense-assistant--explained' : ''}`}>
        {item ? <>
          <div className="expense-assistant__progress">
            <Button type="button" variant="quiet" aria-label="이전 질문" disabled={busy || (index === 0 && !returnToReview)} onClick={() => {
              const step = returnToReview ? 'review' : EXPENSE_ITEMS[index - 1].id;
              void save({ ...draft, step, updatedAt: Date.now() });
            }}><ArrowLeft size={18} aria-hidden="true" /></Button>
            <span>{item.group === 'fixed' ? '고정비' : '변동비'} <span className="expense-assistant__muted">· {index + 1} / {EXPENSE_ITEMS.length}</span></span>
          </div>
          <h3 tabIndex={-1} ref={headingRef}>{item.question}</h3>
          <p className="expense-assistant__hint" id="expense-question-hint">{item.hint}</p>
          {'example' in item ? <p className="expense-assistant__example" id="expense-question-example">{item.example}</p> : null}
          <SegmentedControl className="expense-assistant__period" label="금액 기준" value={period} disabled={busy}
            options={[{ value: 'month', label: '한 달 평균' }, { value: 'year', label: '1년 총액' }]}
            onChange={(option) => {
              if (!invalidAmount) setError(''); setPeriod(option);
              if (answer) setDraft({ ...draft, updatedAt: Date.now(), answers: { ...draft.answers, [item.id]: { ...answer, period: option } } });
            }} />
          <label className="sr-only" htmlFor="expense-answer">{item.label} 금액</label>
          <div className="expense-assistant__amount">
            <input id="expense-answer" type="text" inputMode="numeric" autoComplete="off" placeholder="0" disabled={busy || !!initial.error}
              value={answer === null ? '' : answer.amountWon.toLocaleString('ko-KR')} aria-describedby={`expense-question-hint${'example' in item ? ' expense-question-example' : ''} expense-input-note`} aria-invalid={!!error}
              onChange={event => {
                const raw = event.target.value.replaceAll(',', '');
                if (!/^\d*$/.test(raw) || (raw && !Number.isSafeInteger(Number(raw)))) { setInvalidAmount(true); setError('0 이상의 원 단위 금액을 입력해주세요.'); return; }
                setInvalidAmount(false); setError(''); setDraft({ ...draft, updatedAt: Date.now(), answers: { ...draft.answers, [item.id]: raw === '' ? null : { amountWon: Number(raw), period } } });
              }} />
            <span aria-hidden="true">원</span>
          </div>
          <p className="expense-assistant__hint" id="expense-input-note">{answer?.period === 'year' ? `월평균 약 ${formatDashboardWon(Math.round(answer.amountWon / 12))}으로 계산해요.` : '최근 몇 달의 평균을 떠올려보세요.'}</p>
          <MoneyAdjustments className="expense-assistant__adjustments" disabled={busy || !!initial.error}
            isAdjustmentDisabled={(deltaWon) => (deltaWon < 0 && !answer?.amountWon)
              || !Number.isSafeInteger((answer?.amountWon ?? 0) + deltaWon)}
            onAdjust={(deltaWon) => {
              setInvalidAmount(false); setError('');
              setDraft({ ...draft, updatedAt: Date.now(), answers: { ...draft.answers,
                [item.id]: { amountWon: Math.max(0, (answer?.amountWon ?? 0) + deltaWon), period },
              } });
            }} />
        </> : <>
          <h3 tabIndex={-1} ref={headingRef}>{expenseAnswersComplete(draft.answers) ? '한 달 지출을 확인해보세요' : '남은 항목도 채워볼까요?'}</h3>
          <p className="expense-assistant__hint">금액을 누르면 해당 답변을 바꿀 수 있어요.</p>
          <div className="expense-assistant__review">
            {EXPENSE_ITEMS.map(entry => {
              const value = draft.answers[entry.id];
              return <button key={entry.id} type="button" disabled={busy} aria-label={`${entry.label} 답변 수정`} onClick={() => {
                setReturnToReview(true); setError(''); setDraft({ ...draft, step: entry.id, updatedAt: Date.now() });
              }}><span>{entry.label}</span><span>{value === null ? '답변하기' : `${value.period === 'year' ? '연 ' : '월 '}${formatDashboardWon(value.amountWon)}`}</span></button>;
            })}
          </div>
        </>}
      </div>
    </ResponsiveDialogLayout></AccountProductBoundary>}
  </ResponsiveDialog>;
}
