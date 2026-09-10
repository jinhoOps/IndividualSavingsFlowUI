import { useContext, useEffect, useRef, useState } from 'react';
import { ArrowLeft, WandSparkles, X } from 'lucide-react';
import { AccountDraftContext, AccountWriteRecoveryContext, useAccountRecovery, useInitialRecovery } from '../../../auth/AccountDraftContext';
import { createExpenseDraft, expenseAnswersComplete, expenseTotals, EXPENSE_ITEMS, parseExpenseDraft, type ExpenseAssistantDraft } from '../../domain/expenseAssistant';
import type { MainData } from '../../domain/model';
import type { ExpenseAssistantRepository } from '../../infrastructure/expenseAssistantRepository';
import { Button } from '../common/Button';
import { formatDashboardWon } from './CashflowSummary';

export function ExpenseAssistantDialog({ repository, onClose, onApplied }: {
  repository: ExpenseAssistantRepository;
  onClose(): void;
  onApplied(data: MainData): void;
}) {
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
  const [returnToReview, setReturnToReview] = useState(() => expenseAnswersComplete((recovered ?? initial.draft).answers));
  const dialogRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(persisted);
  useAccountRecovery('main-expense', draft, dirty, !initial.error);
  const index = EXPENSE_ITEMS.findIndex(item => item.id === draft.step);
  const item = index < 0 ? null : EXPENSE_ITEMS[index];
  const answer = item ? draft.answers[item.id] : null;
  const [period, setPeriod] = useState<'month' | 'year'>(answer?.period ?? 'month');
  useEffect(() => { setPeriod(item ? draft.answers[item.id]?.period ?? 'month' : 'month'); }, [draft.step]);
  const totals = expenseTotals(draft.answers);
  const answered = EXPENSE_ITEMS.filter(({ id }) => draft.answers[id] !== null).length;

  useEffect(() => { headingRef.current?.focus(); }, [draft.step]);
  useEffect(() => {
    if (!dirty) return;
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [dirty]);

  async function save(next: ExpenseAssistantDraft, complete = false, close = false) {
    if (busyRef.current || initial.error) return;
    busyRef.current = true;
    setBusy(true); setError('');
    try {
      const result = await repository.save(next, complete);
      setDraft(result.assistant.draft); setPersisted(result.assistant.draft);
      session?.recordRecoveryDraft('main-expense', null);
      if (complete) onApplied(result.data);
      if (complete || close) onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '답변을 저장하지 못했습니다. 다시 시도해주세요.');
    } finally { busyRef.current = false; setBusy(false); }
  }

  function close() {
    if (busyRef.current) return;
    if (session && (session.pending || session.status === 'offline')) onClose();
    else if (dirty && !initial.error) void save(draft, false, true);
    else onClose();
  }
  function next(none = false) {
    if (!item || (!none && answer === null)) return;
    const step = returnToReview ? 'review' : EXPENSE_ITEMS[index + 1]?.id ?? 'review';
    const nextDraft: ExpenseAssistantDraft = { ...draft, step, updatedAt: Date.now(), answers: none
      ? { ...draft.answers, [item.id]: { amountWon: 0, period: 'month' as const } } : draft.answers };
    // Preserve this answer locally even if the request fails.
    setDraft({ ...nextDraft, step: draft.step });
    void save(nextDraft);
  }

  function trap(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== 'Tab') return;
    const controls = [...dialogRef.current!.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select:not(:disabled)')]
      .filter(element => element.getBoundingClientRect().width > 0);
    if (!controls.length) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === headingRef.current)) {
      event.preventDefault(); controls.at(-1)!.focus();
    } else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0].focus(); }
  }

  return <>
    <div className="expense-assistant__backdrop" aria-hidden="true" onClick={close} />
    <div className="expense-assistant" role="dialog" aria-modal="true" aria-labelledby="expense-assistant-title" aria-busy={busy} ref={dialogRef} onKeyDown={trap}>
      <header className="expense-assistant__header">
        <span><WandSparkles size={18} aria-hidden="true" /> 지출 계산 도우미</span>
        <Button type="button" variant="quiet" aria-label="도우미 닫기" disabled={busy} onClick={close}><X size={22} aria-hidden="true" /></Button>
      </header>
      <div className="expense-assistant__body">
        {item ? <>
          <div className="expense-assistant__progress">
            <Button type="button" variant="quiet" aria-label="이전 질문" disabled={busy || (index === 0 && !returnToReview)} onClick={() => {
              const step = returnToReview ? 'review' : EXPENSE_ITEMS[index - 1].id;
              void save({ ...draft, step, updatedAt: Date.now() });
            }}><ArrowLeft size={18} aria-hidden="true" /></Button>
            <span>{item.group === 'fixed' ? '고정비' : '변동비'} <span className="expense-assistant__muted">· {index + 1} / {EXPENSE_ITEMS.length}</span></span>
          </div>
          <h2 id="expense-assistant-title" tabIndex={-1} ref={headingRef}>{item.question}</h2>
          <p className="expense-assistant__hint" id="expense-question-hint">{item.hint}</p>
          <div className="expense-assistant__period" role="group" aria-label="금액 기준">
            {(['month', 'year'] as const).map(option => <Button key={option} type="button" variant="quiet" aria-pressed={period === option} disabled={busy} onClick={() => {
              setError(''); setPeriod(option); if (answer) setDraft({ ...draft, updatedAt: Date.now(), answers: { ...draft.answers, [item.id]: { ...answer, period: option } } });
            }}>{option === 'month' ? '한 달 평균' : '1년 총액'}</Button>)}
          </div>
          <label className="sr-only" htmlFor="expense-answer">{item.label} 금액</label>
          <div className="expense-assistant__amount">
            <input id="expense-answer" type="text" inputMode="numeric" autoComplete="off" placeholder="0" disabled={busy || !!initial.error}
              value={answer === null ? '' : answer.amountWon.toLocaleString('ko-KR')} aria-describedby="expense-question-hint expense-input-note" aria-invalid={!!error}
              onChange={event => {
                const raw = event.target.value.replaceAll(',', '');
                if (!/^\d*$/.test(raw) || (raw && !Number.isSafeInteger(Number(raw)))) { setError('0 이상의 원 단위 금액을 입력해주세요.'); return; }
                setError(''); setDraft({ ...draft, updatedAt: Date.now(), answers: { ...draft.answers, [item.id]: raw === '' ? null : { amountWon: Number(raw), period } } });
              }} />
            <span aria-hidden="true">원</span>
          </div>
          <p className="expense-assistant__hint" id="expense-input-note">{answer?.period === 'year' ? `월평균 약 ${formatDashboardWon(Math.round(answer.amountWon / 12))}으로 계산해요.` : '최근 몇 달의 평균을 떠올려보세요.'}</p>
        </> : <>
          <p className="main-eyebrow">답변 {answered}개 / {EXPENSE_ITEMS.length}개</p>
          <h2 id="expense-assistant-title" tabIndex={-1} ref={headingRef}>{expenseAnswersComplete(draft.answers) ? '한 달 지출을 확인해보세요' : '남은 항목도 채워볼까요?'}</h2>
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
        {error ? <div className="expense-assistant__error" role="alert"><p>{error}</p>
          {recoverWrite && session?.pending && ['save_expense_draft', 'apply_expense'].includes(session.pending.operation) && (session.status === 'uncertain' || session.status === 'conflict') ?
            <Button type="button" variant="secondary" disabled={busy} onClick={async () => {
              if (busyRef.current) return;
              busyRef.current = true; setBusy(true);
              try { await recoverWrite(session.status === 'conflict'); }
              finally { busyRef.current = false; setBusy(false); }
            }}>{session.status === 'conflict' ? '최신 상태에서 다시 적용' : '저장 결과 다시 확인'}</Button> : null}
        </div> : null}
      </div>
      <footer className="expense-assistant__footer">
        <div className="expense-assistant__total"><span>{item ? '지금까지 월평균' : '월 지출 합계'}</span><strong>{totals ? formatDashboardWon(totals.totalWon) : '금액 범위 초과'}</strong></div>
        {!item && totals ? <p className="expense-assistant__hint">주거 {formatDashboardWon(totals.housingWon)} · 생활 {formatDashboardWon(totals.livingWon)}<br />직접 입력한 주거비와 생활비를 이 합계로 바꿔요.</p> : null}
        {item ? <div className="expense-assistant__actions">
          <Button type="button" variant="secondary" disabled={busy || !!initial.error} onClick={() => next(true)}>없어요</Button>
          <Button type="button" variant="primary" disabled={busy || answer === null || !totals || !!initial.error} onClick={() => next()}>{busy ? '저장 중…' : returnToReview ? '내역으로' : index === EXPENSE_ITEMS.length - 1 ? '합계 확인' : '다음'}</Button>
        </div> : <Button className="expense-assistant__apply" type="button" variant="primary" disabled={busy || !expenseAnswersComplete(draft.answers) || !totals || !!initial.error} onClick={() => void save(draft, true)}>{busy ? '반영 중…' : '이 금액으로 반영'}</Button>}
      </footer>
    </div>
  </>;
}
