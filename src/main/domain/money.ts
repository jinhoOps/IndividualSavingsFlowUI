export function parseWonInput(value: string | number | null | undefined): number {
  const normalized = String(value ?? '').replace(/[\s,]/g, '');
  if (!/^\d+$/.test(normalized)) {
    return 0;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : 0;
}

export function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
