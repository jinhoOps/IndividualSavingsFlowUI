import { formatWon } from './format';

export interface GrowthChartTooltipValues {
  periodLabel: string;
  currentPlanWon: number;
  allSavingsWon: number;
  principalWon: number;
  savingsWon: number;
  investmentWon: number;
}

export function GrowthChartTooltip({
  values,
  variant,
  placement,
  anchorPercent,
  anchorYPercent,
}: {
  values: GrowthChartTooltipValues;
  variant: 'compact' | 'detailed';
  placement: { horizontal: 'left' | 'right'; vertical: 'above' | 'below' };
  anchorPercent: number;
  anchorYPercent: number;
}) {
  return (
    <aside
      className={`growth-chart__tooltip growth-chart__tooltip--${variant} growth-chart__tooltip--${placement.horizontal} growth-chart__tooltip--${placement.vertical}`}
      style={{
        '--tooltip-anchor-x': `${anchorPercent}%`,
        '--tooltip-anchor-y': `${anchorYPercent}%`,
      } as React.CSSProperties}
    >
      <strong>{values.periodLabel}</strong>
      <p className="growth-chart__tooltip-primary">
        <span>현재 계획 총액</span>
        <b>{formatWon(values.currentPlanWon)}</b>
      </p>
      <div className="growth-chart__tooltip-grid">
        {variant === 'detailed' ? (
          <>
            <Detail label="전부 저축 총액" value={values.allSavingsWon} />
            <Detail label="누적 납입원금" value={values.principalWon} />
            <Detail label="저축 잔액" value={values.savingsWon} />
            <Detail label="투자 잔액" value={values.investmentWon} />
          </>
        ) : <Detail label="누적 납입원금" value={values.principalWon} />}
      </div>
    </aside>
  );
}

function Detail({ label, value }: { label: string; value: number }) {
  return <p><span>{label}</span><b>{formatWon(value)}</b></p>;
}
