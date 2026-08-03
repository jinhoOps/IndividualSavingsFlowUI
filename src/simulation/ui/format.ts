export function formatWon(amountWon: number): string {
  const sign = amountWon < 0 ? '-' : '';
  const absolute = Math.abs(amountWon);
  const minimumUnit = absolute >= 100_000_000 ? 10_000 : 1_000;
  const rounded = Math.round(absolute / minimumUnit) * minimumUnit;
  if (rounded === 0) return '0원';

  const parts: string[] = [];
  let remaining = rounded;
  for (const [unit, label] of [
    [1_000_000_000_000, '조'],
    [100_000_000, '억'],
    [10_000, '만'],
    [1_000, '천'],
  ] as const) {
    const value = Math.floor(remaining / unit);
    if (value > 0) parts.push(`${formatInteger(value)}${label}`);
    remaining %= unit;
  }

  return `${sign}${parts.join(' ')} 원`;
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat('ko-KR', {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInteger(value: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value);
}
