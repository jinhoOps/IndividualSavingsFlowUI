import { formatWon } from './format';

export interface GrowthChartTooltipValues {
  year: number;
  currentPlanWon: number;
  allSavingsWon: number;
  principalWon: number;
  savingsWon: number;
  investmentWon: number;
}

export function GrowthChartTooltip({
  values,
  side,
  anchorPercent,
  onClose,
}: {
  values: GrowthChartTooltipValues;
  side: 'left' | 'right';
  anchorPercent: number;
  onClose(): void;
}) {
  return (
    <aside
      className={`growth-chart__tooltip growth-chart__tooltip--${side}`}
      style={{ '--tooltip-anchor': `${anchorPercent}%` } as React.CSSProperties}
      aria-live="polite"
    >
      <strong>{values.year}년</strong>
      <p className="growth-chart__tooltip-primary">
        <span>현재 계획 총액</span>
        <b>{formatWon(values.currentPlanWon)}</b>
      </p>
      <div className="growth-chart__tooltip-grid">
        <Detail label="전부 저축 총액" value={values.allSavingsWon} />
        <Detail label="누적 납입원금" value={values.principalWon} />
        <Detail label="저축 잔액" value={values.savingsWon} />
        <Detail label="투자 잔액" value={values.investmentWon} />
      </div>
      <button type="button" onClick={onClose}>닫기</button>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: number }) {
  return <p><span>{label}</span><b>{formatWon(value)}</b></p>;
}
