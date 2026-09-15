import { animate } from 'animejs';
import { useRef, useState, type CSSProperties } from 'react';
import { attemptMotion } from '../../../components/motion/attemptMotion';
import { MOTION_DURATION, MOTION_EASE } from '../../../components/motion/tokens';
import { useAnimeScope } from '../../../components/motion/useAnimeScope';
import type { MainData } from '../../domain/model';
import { calculateCashflow } from '../../domain/cashflow';
import { calculateCashflowInsight } from '../../domain/cashflowInsight';
import { CashflowSummary, formatDashboardWon, type CashflowSummaryProps } from './CashflowSummary';

interface Props extends Pick<CashflowSummaryProps, 'onExpense' | 'onRemaining' | 'onEditAmount'> { data: MainData; }
type AllocationId = 'consumption' | 'saving' | 'investment' | 'remaining';
const allocationIds: AllocationId[] = ['consumption', 'saving', 'investment', 'remaining'];
const shareFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });
const formatRatio = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;
const formatSplit = (value: number | null) => value === null ? '—' : `${shareFormat.format(value)} : ${shareFormat.format(100 - value)}`;
interface AllocationFrame {
  widths: number[];
  incomePosition: number;
  ratio: number | null;
  savingShare: number | null;
}

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
  const split = formatSplit(savingShare);
  const incomePosition = scale > 0 ? summary.incomeWon / scale * 100 : 0;
  const target: AllocationFrame = {
    widths: allocationIds.map(id => scale > 0 ? (insight.allocations.find(item => item.id === id)?.amountWon ?? 0) / scale * 100 : 0),
    incomePosition,
    ratio: insight.savingsInvestmentPercentage,
    savingShare,
  };
  const motionKey = JSON.stringify(target);
  const frameRef = useRef<AllocationFrame | null>(null);
  const motionRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const previous = frameRef.current;
    let active = true;
    const segments = root.querySelectorAll<HTMLElement>('[data-segment]');
    const chart = root.querySelector<HTMLElement>('.cashflow-allocation__chart');
    const markers = root.querySelectorAll<HTMLElement>('[data-income-marker]');
    const ratio = root.querySelector<HTMLElement>('[data-visual-ratio]');
    const splitValue = root.querySelector<HTMLElement>('[data-visual-split]');
    const paint = (frame: AllocationFrame) => {
      if (!active) return;
      frameRef.current = frame;
      segments.forEach((segment, index) => { segment.style.width = `${frame.widths[index]}%`; });
      chart?.style.setProperty('--income-position', `${frame.incomePosition}%`);
      markers.forEach(marker => { marker.style.opacity = frame.incomePosition < 100 ? '1' : '0'; });
      if (ratio) ratio.textContent = formatRatio(frame.ratio);
      if (splitValue) splitValue.textContent = formatSplit(frame.savingShare);
    };
    if (previous === null || reducedMotion || summary.incomeWon === 0 || previous.ratio === null) {
      paint(target);
    } else {
      const state = { progress: 0 };
      paint(previous);
      if (!attemptMotion(() => animate(state, {
        progress: 1, duration: MOTION_DURATION.emphasis, ease: MOTION_EASE.update,
        onUpdate: () => {
          const mix = (from: number, to: number) => from + (to - from) * state.progress;
          const mixNullable = (from: number | null, to: number | null) => from === null || to === null ? to : mix(from, to);
          paint({
            widths: target.widths.map((width, index) => mix(previous.widths[index], width)),
            incomePosition: mix(previous.incomePosition, target.incomePosition),
            ratio: mixNullable(previous.ratio, target.ratio),
            savingShare: mixNullable(previous.savingShare, target.savingShare),
          });
        },
        onComplete: () => paint(target),
      }))) paint(target);
    }
    return () => { active = false; };
  }, [motionKey]);
  return (
    <section ref={motionRef} className="cashflow-allocation" aria-label="월 수입 배분">
      <div className="cashflow-allocation__overview">
        <div className="cashflow-allocation__ratio"><span>저축·투자 비중</span><strong><span className="sr-only">{formatRatio(target.ratio)}</span><span aria-hidden="true" data-visual-ratio>{formatRatio(target.ratio)}</span></strong><small>월수입 대비</small></div>
        <div className="cashflow-allocation__split"><span>저축 : 투자</span><strong><span className="sr-only">{savingShare === null ? '저축·투자 미설정' : `저축 ${shareFormat.format(savingShare)}%, 투자 ${shareFormat.format(100 - savingShare)}%`}</span><span aria-hidden="true" data-visual-split>{split}</span></strong><small>저축·투자 합계 기준</small></div>
      </div>
      {summary.incomeWon > 0 ? (
        <div className="cashflow-allocation__visual">
          <div className="cashflow-allocation__chart" role="img"
            aria-label={`월수입 대비. ${insight.allocations.map(item => `${item.label} ${item.percentage.toFixed(1)}%`).join(', ')}${insight.isOverIncome ? `. 수입보다 ${formatDashboardWon(summary.deficitWon)} 초과` : ''}`}
            style={{ '--income-position': `${incomePosition}%` } as CSSProperties}>
            <div className="cashflow-allocation__track">
              {allocationIds.map((id, index) => (
                <span key={id} className={`cashflow-allocation__segment cashflow-allocation--${id}`}
                  data-segment={id} data-active={active === id || undefined}
                  style={{ width: `${target.widths[index]}%` }} />
              ))}
            </div>
            <span className="cashflow-allocation__excess" data-income-marker aria-hidden="true" style={{ opacity: insight.isOverIncome ? 1 : 0 }} />
            <span className="cashflow-allocation__income-marker" data-income-marker aria-hidden="true" style={{ opacity: insight.isOverIncome ? 1 : 0 }} />
          </div>
          {insight.isOverIncome ? <p className="cashflow-allocation__deficit"><span>기준선: 월수입 100%</span><strong>{formatDashboardWon(summary.deficitWon)} 초과</strong></p> : null}
        </div>
      ) : <p className="cashflow-allocation__guidance">월소득을 입력해주세요.</p>}
      <CashflowSummary summary={summary} {...actions} selection={{ activeId: active, selectedId: selected,
        onHover: setHovered, onFocus: setFocused, onSelect: id => setSelected(current => current === id ? undefined : id) }} />
    </section>
  );
}
