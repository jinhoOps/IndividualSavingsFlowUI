import { Pencil } from 'lucide-react';
import type { Classification } from '../domain/model';
import { formatAllocationPercent, formatPortfolioWon } from './format';

type PortfolioAllocationRowProps = {
  name: string;
  amountWon: number;
  percentage: number;
  classification: Classification;
  onEdit(trigger: HTMLButtonElement): void;
};

export function PortfolioAllocationRow({ name, amountWon, percentage, classification, onEdit }: PortfolioAllocationRowProps) {
  return (
    <button
      type="button"
      className="portfolio-editor__row-summary"
      aria-label={`${name} 편집, ${formatPortfolioWon(amountWon)}, ${formatAllocationPercent(percentage)}`}
      onClick={(event) => onEdit(event.currentTarget)}
    >
      <span><strong>{name}</strong><small>{classification === 'growth' ? '성장' : '안정'}</small></span>
      <span><strong>{formatPortfolioWon(amountWon)}</strong><small>{formatAllocationPercent(percentage)} <Pencil size={14} aria-hidden="true" /></small></span>
    </button>
  );
}
