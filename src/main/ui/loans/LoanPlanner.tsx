import {useEffect, useLayoutEffect, useRef, useState, type ReactNode} from 'react';
import {Plus, ChevronRight, Trash2} from 'lucide-react';
import {ResponsiveDialogActionRow, ResponsiveDialogLayout} from '../../../components/common/ResponsiveDialogLayout';
import {useUncommittedInput} from '../../../auth/useUncommittedInput';
import {Button} from '../common/Button';
import {MoneyField} from '../common/MoneyField';
import {calculateLoanSchedule, currentLoanMonth, loanPlanMonthTotals, LOAN_METHOD_LABELS, LOAN_METHODS, parseHousingLoan, type HousingLoan, type HousingLoanPlan} from '../../domain/housingLoan';
import {LoanChartLegend, LoanMethodDiagram, LoanRepaymentChart, LOAN_METHOD_HINTS} from './LoanRepaymentChart';
import './loans.css';

const won = (value: number) => `${value.toLocaleString('ko-KR')}원`;
export function LoanPlanner({plan, busy, status, onChange, onBack, onEditingChange}: {
  plan: HousingLoanPlan | null; busy: boolean; status?: ReactNode;
  onChange(plan: HousingLoanPlan): Promise<boolean>; onBack(): void; onEditingChange(dirty: boolean): void;
}) {
  const [empty] = useState<HousingLoanPlan>(() => ({month: currentLoanMonth(), loans: [], paymentOverrideWon: null}));
  const value = plan ?? empty;
  const [editing, setEditing] = useState<HousingLoan | null>(null);
  const originalRef = useRef('');
  const [step, setStep] = useState<'method' | 'terms' | 'result'>('method');
  const [monthIndex, setMonthIndex] = useState(0);
  const [yearIndex, setYearIndex] = useState(0);
  const [showTable, setShowTable] = useState(false);
  const [confirmedSeparation, setConfirmedSeparation] = useState(plan !== null);
  const [invalidNumber, setInvalidNumber] = useState(false);
  const [actualPayment, setActualPayment] = useState<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const dirty = (editing !== null && (JSON.stringify(editing) !== originalRef.current || invalidNumber)) || actualPayment !== null;
  useUncommittedInput(dirty);
  useEffect(() => { onEditingChange(dirty); return () => onEditingChange(false); }, [dirty, onEditingChange]);
  useLayoutEffect(() => { headingRef.current?.focus(); }, [step, editing?.id]);
  const valid = editing && parseHousingLoan(editing);
  const rows = valid ? calculateLoanSchedule(valid) : [];
  const row = rows[Math.min(monthIndex, rows.length - 1)];
  const totals = loanPlanMonthTotals(value);
  function edit(loan?: HousingLoan) {
    const next: HousingLoan = loan ? structuredClone(loan) : {id: crypto.randomUUID(), name: `주거 대출 ${value.loans.length + 1}`,
      method: 'equal-payment', basis: 'remaining', principalWon: 0, annualRateBps: 400, rateType: 'fixed', months: 120,
      graceMonths: 0, firstPaymentMonth: value.month};
    originalRef.current = JSON.stringify(next);
    setEditing(next); setStep(loan ? 'terms' : 'method'); setMonthIndex(0); setYearIndex(0); setShowTable(false); setInvalidNumber(false);
  }
  function patch(update: Partial<HousingLoan>) { setEditing(current => current && {...current, ...update}); }
  async function saveLoan() {
    if (!valid || invalidNumber || (!plan && !confirmedSeparation)) return;
    const loans = value.loans.some(loan => loan.id === valid.id) ? value.loans.map(loan => loan.id === valid.id ? valid : loan) : [...value.loans, valid];
    if (await onChange({...value, loans, paymentOverrideWon: null})) { setEditing(null); onEditingChange(false); }
  }
  return <ResponsiveDialogLayout title="대출 설정" titleId="expense-assistant-title" onClose={() => undefined} onBack={onBack}
    eyebrow={editing ? step === 'method' ? '1 / 3 · 상환방식' : step === 'terms' ? '2 / 3 · 대출 조건' : '3 / 3 · 상환 일정' : '주거비에 연결'}
    status={status}
    footer={<ResponsiveDialogActionRow>
      {editing ? <>
        <Button variant="secondary" type="button" disabled={busy} onClick={() => {
          if (step === 'result') setStep('terms'); else if (step === 'terms') setStep('method'); else onBack();
        }}>이전</Button>
        <Button variant="primary" type="button" disabled={busy || (step !== 'method' && (!valid || invalidNumber)) || (step === 'result' && !plan && !confirmedSeparation)}
          onClick={() => step === 'result' ? void saveLoan() : setStep(step === 'method' ? 'terms' : 'result')}>{step === 'result' ? '대출 조건 저장' : step === 'terms' ? '상환 일정 확인' : '조건 입력'}</Button>
      </> : <Button variant="primary" type="button" disabled={busy} onClick={onBack}>지출 내역으로</Button>}
    </ResponsiveDialogActionRow>}>
    <div className="loan-planner">
      {!editing ? <>
        <h3 tabIndex={-1} ref={headingRef}>주거 대출</h3>
        <label className="loan-month">주거비에 반영할 월<input type="month" aria-label="주거비에 반영할 월" value={value.month} min="1900-01" max="9999-12" disabled={busy}
          onChange={event => { if (/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value) && event.target.value >= '1900-01') void onChange({...value, month: event.target.value, paymentOverrideWon: null}); }} /></label>
        <div className="loan-summary"><span>정기 납입 합계</span><strong>{won(totals.regularWon)}</strong><small>예상 원금 {won(totals.principalWon)} · 이자 {won(totals.interestWon)}{value.paymentOverrideWon !== null ? ' · 실제 금액 보정 중' : ''}</small></div>
        {totals.maturityWon > 0 && <div className="loan-maturity"><span>이달 만기 원금 · 정기 지출 외 별도 필요</span><strong>{won(totals.maturityWon)}</strong></div>}
        <div className="loan-list">{value.loans.map(loan => <div className="loan-list__row" key={loan.id}>
          <button type="button" disabled={busy} onClick={() => edit(loan)}><span><strong>{loan.name}</strong><small>{LOAN_METHOD_LABELS[loan.method]} · 연 {loan.annualRateBps / 100}%</small></span><ChevronRight size={18} aria-hidden="true" /></button>
          <button type="button" aria-label={`${loan.name} 삭제`} disabled={busy} onClick={() => void onChange({...value, loans: value.loans.filter(item => item.id !== loan.id), paymentOverrideWon: null})}><Trash2 size={18} aria-hidden="true" /></button>
        </div>)}</div>
        <Button variant="secondary" type="button" disabled={busy || value.loans.length >= 10} onClick={() => edit()}><Plus size={18} aria-hidden="true" /> 대출 추가</Button>
        {value.loans.length > 0 && <details className="loan-detail"><summary>은행 납입액과 다를 때</summary>
          <p>선택한 달의 정기 납입액만 보정해요. 만기 원금과 예상 대출 잔액은 바뀌지 않아요.</p>
          <MoneyField id="loan-actual-payment" label="확인한 정기 납입액" valueWon={actualPayment ?? value.paymentOverrideWon ?? totals.estimatedRegularWon} disabled={busy}
            onChange={setActualPayment} />
          <Button variant="secondary" type="button" disabled={busy || actualPayment === null || actualPayment > 10_000_000_000_000} onClick={async () => {
            if (await onChange({...value, paymentOverrideWon: actualPayment})) setActualPayment(null);
          }}>선택 월에 보정 적용</Button>
          {value.paymentOverrideWon !== null && <Button variant="quiet" type="button" disabled={busy} onClick={() => void onChange({...value, paymentOverrideWon: null})}>예상 금액 사용</Button>}
        </details>}
        <p className="loan-note">조건은 저장되고, 주거비는 지출 내역의 ‘이 금액으로 반영’에서 변경돼요.</p>
      </> : <>
        <h3 tabIndex={-1} ref={headingRef}>{step === 'method' ? '어떻게 갚고 있나요?' : step === 'terms' ? '대출 조건을 알려주세요' : editing.name}</h3>
        {step === 'method' && <>
          <div className="loan-method-heading"><span>상환방식 개념도</span><LoanChartLegend /></div>
          <div className="loan-methods" role="radiogroup" aria-label="대출 상환방식">{LOAN_METHODS.map(method => <label className="loan-method" data-selected={editing.method === method} key={method}>
            <LoanMethodDiagram method={method} /><span className="loan-method__label"><strong>{LOAN_METHOD_LABELS[method]}</strong><small>{LOAN_METHOD_HINTS[method]}</small></span>
            <input type="radio" name="loan-method" value={method} checked={editing.method === method} onChange={() => patch({method, ...(method === 'bullet' ? {graceMonths: 0} : {})})} />
          </label>)}</div>
          <p className="loan-note">모양은 구조를 보여줘요. 다음 단계에서 내 조건으로 금액을 계산해요.</p>
        </>}
        {step === 'terms' && <div className="loan-fields">
          <label>대출 이름<input maxLength={40} value={editing.name} onChange={event => patch({name: event.target.value})} /></label>
          <fieldset><legend>계산 시작점</legend><div className="loan-choice"><label><input type="radio" name="loan-basis" checked={editing.basis === 'remaining'} onChange={() => patch({basis: 'remaining'})} />이미 갚고 있어요</label><label><input type="radio" name="loan-basis" checked={editing.basis === 'new'} onChange={() => patch({basis: 'new'})} />새 대출이에요</label></div></fieldset>
          <MoneyField id="loan-principal" label={editing.basis === 'remaining' ? '현재 남은 원금' : '빌릴 원금'} valueWon={editing.principalWon} onChange={principalWon => patch({principalWon})}
            error={editing.principalWon <= 0 || editing.principalWon > 1_000_000_000_000 ? '1원부터 1조 원까지 입력해주세요.' : undefined} />
          <div className="loan-field-pair"><label>연 금리 (%)<input type="number" min="0" max="100" step="0.01" defaultValue={editing.annualRateBps / 100}
            onChange={event => { const rate = event.target.value; const n = Number(rate); setInvalidNumber(rate === '' || !Number.isFinite(n) || n < 0 || n > 100 || Math.abs(n * 100 - Math.round(n * 100)) > 1e-8); if (rate !== '' && Number.isFinite(n)) patch({annualRateBps: Math.round(n * 100)}); }} /></label>
            <label>금리 유형<select value={editing.rateType} onChange={event => patch({rateType: event.target.value as HousingLoan['rateType']})}><option value="fixed">고정금리</option><option value="variable">변동금리</option></select></label></div>
          <div className="loan-field-pair"><label>{editing.basis === 'remaining' ? '남은 기간 (개월)' : '전체 기간 (개월)'}<input type="number" min="1" max="600" value={editing.months || ''} onChange={event => patch({months: Number(event.target.value)})} /></label>
            <label>{editing.basis === 'remaining' ? '다음 납입월' : '첫 납입월'}<input type="month" value={editing.firstPaymentMonth} min="1900-01" max="9950-01" onChange={event => patch({firstPaymentMonth: event.target.value})} /></label></div>
          {editing.method !== 'bullet' && <label>이자만 내는 남은 거치기간 (개월)<input type="number" min="0" max={Math.max(0, editing.months - 1)} value={editing.graceMonths} onChange={event => patch({graceMonths: event.target.value === '' ? -1 : Number(event.target.value)})} /><small>전체/남은 기간에 포함돼요. 거치가 없으면 0개월.</small></label>}
          <p className="loan-note">{editing.basis === 'remaining' ? '현재 잔액을 남은 기간으로 재산정한 월 단위 예상이에요. ' : '매월 한 번 납입하는 예상이에요. '}{editing.rateType === 'variable' ? '변동금리는 현재 금리가 유지된다고 가정해요.' : '실제 청구액은 일수·반올림에 따라 달라질 수 있어요.'}</p>
          {(!valid || invalidNumber) && <p className="loan-error" role="alert">원금·금리·기간·납입월을 확인해주세요. 기간은 1~600개월이고 거치기간보다 길어야 해요.</p>}
        </div>}
        {step === 'result' && row && <>
          <div className="loan-result-heading"><span>{row.month} · {row.installment}회차</span><small>월 단위 예상 · {editing.rateType === 'variable' ? '현재 금리 유지 가정' : '고정금리'}</small></div>
          <div className="loan-summary"><span>정기 납입액</span><strong>{won(row.paymentWon - row.maturityWon)}</strong><small>원금 {won(row.principalWon - row.maturityWon)} · 이자 {won(row.interestWon)}</small></div>
          <LoanRepaymentChart rows={rows} selectedIndex={Math.min(monthIndex, rows.length - 1)} />
          <label className="loan-month-slider">납입 회차<input aria-label="납입 회차" type="range" min="0" max={rows.length - 1} value={Math.min(monthIndex, rows.length - 1)} onChange={event => setMonthIndex(Number(event.target.value))} /></label>
          <dl className="loan-kpis"><div><dt>납입 후 예상 잔액</dt><dd>{won(row.balanceWon)}</dd></div><div><dt>앞으로 낼 예상 이자</dt><dd>{won(rows.reduce((sum, payment) => sum + payment.interestWon, 0))}</dd></div><div><dt>상환 종료 예정</dt><dd>{rows.at(-1)!.month}</dd></div><div><dt>상환방식</dt><dd>{LOAN_METHOD_LABELS[editing.method]}</dd></div></dl>
          <Button variant="quiet" type="button" onClick={() => setShowTable(!showTable)} aria-expanded={showTable}>월별 상환 내역</Button>
          {showTable && <div className="loan-schedule"><label>회차 구간<select value={yearIndex} onChange={event => setYearIndex(Number(event.target.value))}>{Array.from({length: Math.ceil(rows.length / 12)}, (_, index) => <option key={index} value={index}>{index * 12 + 1}~{Math.min(rows.length, (index + 1) * 12)}회차</option>)}</select></label>
            {rows.slice(yearIndex * 12, yearIndex * 12 + 12).map(payment => <dl className="loan-schedule__row" key={payment.month}><dt>{payment.month}</dt><dd><span>원금</span>{won(payment.principalWon)}</dd><dd><span>이자</span>{won(payment.interestWon)}</dd><dd><span>합계</span><strong>{won(payment.paymentWon)}</strong></dd><dd><span>잔액</span>{won(payment.balanceWon)}</dd></dl>)}
          </div>}
          {!plan && <label className="loan-confirm"><input type="checkbox" checked={confirmedSeparation} onChange={event => setConfirmedSeparation(event.target.checked)} /><span>월세·기타 주거비에 넣었던 대출 금액은 지출 내역에서 빼고 반영할게요.<small>기존 ‘주거 대출 이자’는 새 납입액과 중복 합산하지 않아요.</small></span></label>}
        </>}
      </>}
    </div>
  </ResponsiveDialogLayout>;
}
