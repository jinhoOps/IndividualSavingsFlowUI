export function formatWon(amountWon: number): string {
  const sign = amountWon < 0 ? '-' : '';
  const absolute = Math.abs(Math.round(amountWon));
  if (absolute >= 10_000) {
    const manWon = absolute / 10_000;
    return `${sign}${new Intl.NumberFormat('ko-KR', {
      maximumFractionDigits: 1,
    }).format(manWon)}만 원`;
  }
  return `${sign}${new Intl.NumberFormat('ko-KR').format(absolute)}원`;
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 2,
  }).format(value);
}
