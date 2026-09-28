import {assetClassAllocation, assetClassForName} from '../../portfolio/domain/classification';
import {formatAllocationPercent} from '../../portfolio/ui/format';
import type {SharedAllocation} from '../domain/publication';
const color = {equity: '#587bb6', spot: '#cc9027', bond: '#247f79', cash: '#8dbab4', other: '#7f6856'};
export function AllocationSummary({allocation, compact = false}: {allocation: SharedAllocation; compact?: boolean}) {
  const groups = assetClassAllocation({items: allocation.items.map((item, order) => ({...item, id: String(order), order, classification: 'growth', classificationOrigin: 'automatic'})), cashShareUnits: allocation.cashShareUnits});
  const allEntries = [...allocation.items, ...(allocation.cashShareUnits ? [{name: '현금', shareUnits: allocation.cashShareUnits}] : [])];
  const entries = [...allEntries].sort((a,b) => b.shareUnits-a.shareUnits);
  const segments = groups.flatMap(group => allEntries.filter(item => assetClassForName(item.name) === group.id));
  return <div className="lounge-allocation">
    <div className="lounge-allocation__bar" aria-hidden="true">{segments.map((item,index) => <span key={index} style={{width: `${item.shareUnits/10000}%`, background: color[assetClassForName(item.name)]}} />)}</div>
    <dl className="lounge-allocation__groups" aria-label="자산군별 비율">{groups.map(group => <div key={group.id}><dt><i style={{background:group.color}} />{group.label}</dt><dd>{formatAllocationPercent(group.percentage)}</dd></div>)}</dl>
    <dl className="lounge-allocation__items" aria-label="투자 대상별 비율">{entries.slice(0, compact ? 3 : 11).map((item, i) => <div key={i}>
      <dt><i style={{background:color[assetClassForName(item.name)]}} />{item.name}</dt><dd>{formatAllocationPercent(item.shareUnits/10000)}</dd>
    </div>)}</dl>
    {compact && entries.length > 3 ? <p className="lounge-muted">외 {entries.length-3}개 대상</p> : null}
    {!compact && groups.some(g => g.id === 'other') ? <p className="lounge-muted">기타: 이름으로 분류되지 않은 대상</p> : null}
  </div>;
}
