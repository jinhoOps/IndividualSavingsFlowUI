import { useState, type CSSProperties } from 'react';
import type { MainData } from '../../domain/model';
import { calculateCashflow } from '../../domain/cashflow';
import { calculateCashflowInsight } from '../../domain/cashflowInsight';
import { CashflowSummary, formatDashboardWon, type CashflowSummaryProps } from './CashflowSummary';

interface Props extends Pick<CashflowSummaryProps, 'onExpense' | 'onRemaining' | 'onEditAmount'> { data: MainData; }
type AllocationId = 'consumption' | 'saving' | 'investment' | 'remaining';

/** One shared scale keeps even an over-income plan fully visible. */
export function CashflowAllocationSummary({ data, ...actions }: Props) {
  const summary = calculateCashflow(data);
  const insight = calculateCashflowInsight(data);
  const [hovered, setHovered] = useState<AllocationId>();
  const [focused, setFocused] = useState<AllocationId>();
  const [selected, setSelected] = useState<AllocationId>();
  const active = focused ?? hovered ?? selected;
  const total = insight.allocations.reduce((sum, item) => sum + item.amountWon, 0);
  const scale = Math.max(summary.incomeWon, total);
  const savingInvestmentTotal = summary.savingWon + summary.investmentWon;
  const savingShare = savingInvestmentTotal > 0 ? summary.savingWon / savingInvestmentTotal * 100 : null;
  const shareFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
  const split = savingShare === null ? '—' : `${shareFormat.format(savingShare)} : ${shareFormat.format(100 - savingShare)}`;
  const incomePosition = scale > 0 ? summary.incomeWon / scale * 100 : 0;
  return (
    <section className="cashflow-allocation" aria-label="월 수입 배분">
      <div className="cashflow-allocation__overview">
        <div className="cashflow-allocation__ratio"><span>저축·투자 비중</span><strong>{insight.savingsInvestmentPercentage === null ? '—' : `${insight.savingsInvestmentPercentage.toFixed(1)}%`}</strong><small>월수입 대비</small></div>
        <div className="cashflow-allocation__split"><span>저축 : 투자</span><strong aria-label={savingShare === null ? '저축·투자 미설정' : `저축 ${shareFormat.format(savingShare)}%, 투자 ${shareFormat.format(100 - savingShare)}%`}>{split}</strong><small>저축·투자 합계 기준</small></div>
      </div>
      {summary.incomeWon > 0 ? (
        <div className="cashflow-allocation__visual">
          <div className="cashflow-allocation__chart" role="img"
            aria-label={`월수입 대비. ${insight.allocations.map(item => `${item.label} ${item.percentage.toFixed(1)}%`).join(', ')}${insight.isOverIncome ? `. 수입보다 ${formatDashboardWon(summary.deficitWon)} 초과` : ''}`}
            style={{ '--income-position': `${incomePosition}%` } as CSSProperties}>
            <div className="cashflow-allocation__track">
              {insight.allocations.filter(item => item.amountWon > 0).map(item => (
                <span key={item.id} className={`cashflow-allocation__segment cashflow-allocation--${item.id}`}
                  data-segment={item.id} data-active={active === item.id || undefined}
                  style={{ width: `${item.amountWon / scale * 100}%` }} />
              ))}
            </div>
            {insight.isOverIncome ? <><span className="cashflow-allocation__excess" /><span className="cashflow-allocation__income-marker" /></> : null}
          </div>
          {insight.isOverIncome ? <p className="cashflow-allocation__deficit"><span>기준선: 월수입 100%</span><strong>{formatDashboardWon(summary.deficitWon)} 초과</strong></p> : null}
        </div>
      ) : <p className="cashflow-allocation__guidance">월소득을 입력해주세요.</p>}
      <CashflowSummary summary={summary} {...actions} selection={{ activeId: active, selectedId: selected,
        onHover: setHovered, onFocus: setFocused, onSelect: id => setSelected(current => current === id ? undefined : id) }} />
    </section>
  );
}
