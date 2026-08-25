export function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}

export {
  adjustWon,
  formatWonInput,
  normalizeMoneyEdit,
  parseWonInput,
} from '../../core/domain/moneyInput';
export type {
  MoneyInputOptions,
  NormalizedMoneyEdit,
  ZeroDisplay,
} from '../../core/domain/moneyInput';
