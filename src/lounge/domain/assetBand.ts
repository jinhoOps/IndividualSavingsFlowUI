export const ASSET_BANDS = [
  ['under_10m', '1천만원 미만'],
  ['10m', '1천만원대'], ['20m', '2천만원대'], ['30m', '3천만원대'],
  ['40m', '4천만원대'], ['50m', '5천만원대'], ['60m', '6천만원대'],
  ['70m', '7천만원대'], ['80m', '8천만원대'], ['90m', '9천만원대'],
  ['100m', '1억원대'], ['200m', '2억원대'], ['300m', '3억원대'],
  ['400m', '4억원대'], ['500m', '5억원대'], ['600m', '6억원대'],
  ['700m', '7억원대'], ['800m', '8억원대'], ['900m', '9억원대'],
  ['1b_plus', '10억원 이상'],
] as const;
export type AssetBand = typeof ASSET_BANDS[number][0];
export const isAssetBand = (value: unknown): value is AssetBand => ASSET_BANDS.some(([code]) => code === value);
export const assetBandLabel = (value: AssetBand) => ASSET_BANDS.find(([code]) => code === value)![1];

export function assetBandFromWon(amount: number | null): AssetBand | null {
  if (amount === null || !Number.isSafeInteger(amount) || amount < 0) return null;
  if (amount < 10_000_000) return 'under_10m';
  if (amount >= 1_000_000_000) return '1b_plus';
  const step = amount < 100_000_000 ? 10_000_000 : 100_000_000;
  const code = `${Math.floor(amount / step) * step / 1_000_000}m`;
  return isAssetBand(code) ? code : null;
}
