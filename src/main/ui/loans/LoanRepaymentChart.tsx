import {animate} from 'animejs';
import {useId} from 'react';
import {useAnimeScope} from '../../../components/motion/useAnimeScope';
import {LOAN_METHOD_LABELS, type LoanMethod, type LoanPayment} from '../../domain/housingLoan';

export const LOAN_METHOD_HINTS: Record<LoanMethod, string> = {
  'equal-payment': '매달 같은 금액, 원금 비중은 점점 크게',
  'equal-principal': '같은 원금에 줄어드는 이자',
  bullet: '평소에는 이자, 만기에는 원금 전액',
};

/** Schematic shapes teach structure; numeric results use the calculated schedule below. */
export function LoanMethodDiagram({method}: {method: LoanMethod}) {
  const paths = method === 'equal-payment'
    ? ['M8 72 L8 66 Q70 44 152 16 L152 72 Z', 'M8 16 L152 16 Q70 44 8 66 Z']
    : method === 'equal-principal'
      ? ['M8 72 L8 48 L152 48 L152 72 Z', 'M8 12 L152 44 L152 48 L8 48 Z']
      : ['M124 55 L124 10 L152 10 L152 55 Z', 'M8 72 L8 55 L152 55 L152 72 Z'];
  const root = useAnimeScope<HTMLDivElement>(({root, reducedMotion}) => {
    if (reducedMotion) return;
    const shapes = root.querySelectorAll('path');
    try { animate(shapes, {opacity: [0, 1], duration: 450, ease: 'out(3)'}); }
    catch { shapes.forEach(path => { (path as SVGElement).style.opacity = '1'; }); }
  }, [method]);
  return <div ref={root} className="loan-method-diagram">
    <svg viewBox="0 0 160 84" role="img" aria-label={`${LOAN_METHOD_LABELS[method]} 개념도: ${LOAN_METHOD_HINTS[method]}`}>
      <path d={paths[0]} className="loan-chart__principal" />
      <path d={paths[1]} className="loan-chart__interest" />
      <line x1="8" x2="152" y1="73" y2="73" stroke="currentColor" opacity=".25" />
    </svg>
    <div className="loan-method-axis"><span>초기</span><span>만기</span></div>
  </div>;
}

export function LoanChartLegend() {
  return <div className="loan-chart__legend"><span><i className="loan-chart__principal" />원금</span><span><i className="loan-chart__interest" />이자</span></div>;
}

export function LoanRepaymentChart({rows, selectedIndex}: {rows: LoanPayment[]; selectedIndex: number}) {
  const clipId = `loan-clip-${useId().replaceAll(':', '')}`;
  const width = 560, top = 28, bottom = 166;
  const regular = rows.map(row => row.paymentWon - row.maturityWon);
  const max = Math.max(0, ...regular);
  const x = (index: number) => rows.length === 1 ? 300 : 20 + index * width / (rows.length - 1);
  const y = (amount: number) => bottom - amount / Math.max(1, max) * (bottom - top);
  const principalPoints = rows.map((row, index) => `${x(index)},${y(row.principalWon - row.maturityWon)}`);
  const totalPoints = regular.map((amount, index) => `${x(index)},${y(amount)}`);
  const principal = `M20,${bottom} L${principalPoints.join(' L')} L${x(rows.length - 1)},${bottom} Z`;
  const interest = `M${totalPoints.join(' L')} L${[...principalPoints].reverse().join(' L')} Z`;
  const signature = rows.map(row => `${row.paymentWon}:${row.principalWon}`).join(',');
  const root = useAnimeScope<HTMLDivElement>(({root, reducedMotion}) => {
    const rect = root.querySelector('clipPath rect');
    if (!rect || reducedMotion) return;
    try { animate(rect, {width: [0, 600], duration: 500, ease: 'out(3)', onComplete: () => rect.setAttribute('width', '600')}); }
    catch { rect.setAttribute('width', '600'); }
    return () => { rect.setAttribute('width', '600'); };
  }, [signature]);
  const bullet = rows.some(row => row.maturityWon > 0);
  return <div ref={root} className="loan-repayment-chart">
    <div className="loan-chart__scale"><span>월 최대 {max.toLocaleString('ko-KR')}원</span><LoanChartLegend /></div>
    <svg viewBox="0 20 600 154" role="img" aria-label={`월별 정기 납입액의 원금과 이자. ${rows[0].month}부터 ${rows.at(-1)!.month}까지.${bullet ? ' 만기 원금은 그래프 아래에 별도 표시합니다.' : ''}`}>
      <defs><clipPath id={clipId}><rect width="600" height="196" /></clipPath></defs>
      <line x1="20" x2="580" y1={bottom} y2={bottom} stroke="currentColor" opacity=".2" />
      <g clipPath={`url(#${clipId})`}>
        {rows.length === 1 ? <>
          <rect x="260" width="80" y={y(rows[0].principalWon - rows[0].maturityWon)} height={bottom - y(rows[0].principalWon - rows[0].maturityWon)} className="loan-chart__principal" />
          <rect x="260" width="80" y={y(regular[0])} height={y(rows[0].principalWon - rows[0].maturityWon) - y(regular[0])} className="loan-chart__interest" />
        </> : <><path d={principal} className="loan-chart__principal" /><path d={interest} className="loan-chart__interest" /></>}
      </g>
      {selectedIndex >= 0 && <line x1={x(selectedIndex)} x2={x(selectedIndex)} y1="24" y2={bottom} stroke="var(--ink)" strokeDasharray="3 4" />}
    </svg>
    <div className="loan-chart__axis"><span>{rows[0].month}</span><span>{rows.at(-1)!.month}</span></div>
    {bullet && <div className="loan-maturity"><span>{rows.at(-1)!.month} 만기 원금</span><strong>{rows.at(-1)!.maturityWon.toLocaleString('ko-KR')}원</strong></div>}
  </div>;
}
