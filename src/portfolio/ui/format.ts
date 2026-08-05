export function formatPortfolioWon(amountWon: number): string {
  const rounded = Math.round(amountWon / 1_000) * 1_000;
  return `${new Intl.NumberFormat('ko-KR').format(rounded)}원`;
}

export function formatAllocationPercent(percentage: number): string {
  const rounded = Math.round(percentage * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}
