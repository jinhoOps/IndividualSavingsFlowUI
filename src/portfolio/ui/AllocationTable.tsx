import type { AllocationResultItem } from './AllocationDonut';
import { formatAllocationPercent, formatPortfolioWon } from './format';

export function AllocationTable({
  items,
  activeId,
  onActive,
  onClear,
}: {
  items: AllocationResultItem[];
  activeId: string | null;
  onActive: (id: string) => void;
  onClear: () => void;
}) {
  return (
    <table className="portfolio-table">
      <thead>
        <tr><th scope="col">투자 대상</th><th scope="col">금액</th><th scope="col">비율</th></tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr
            key={item.id}
            tabIndex={0}
            data-active={activeId === item.id ? 'true' : 'false'}
            onPointerEnter={() => onActive(item.id)}
            onPointerLeave={onClear}
            onFocus={() => onActive(item.id)}
            onBlur={onClear}
          >
            <th scope="row">{item.name}</th>
            <td>{formatPortfolioWon(item.amountWon)}</td>
            <td>{formatAllocationPercent(item.percentage)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
