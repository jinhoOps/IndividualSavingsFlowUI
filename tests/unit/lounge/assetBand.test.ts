import {describe, expect, it} from 'vitest';
import {ASSET_BANDS, assetBandFromWon, assetBandLabel, isAssetBand} from '../../../src/lounge/domain/assetBand';

describe('optional broad asset scale', () => {
  it.each([
    [0, 'under_10m'], [9_999_999, 'under_10m'], [10_000_000, '10m'],
    [20_123_456, '20m'], [99_999_999, '90m'], [100_000_000, '100m'],
    [199_999_999, '100m'], [999_999_999, '900m'], [1_000_000_000, '1b_plus'],
    [Number.MAX_SAFE_INTEGER, '1b_plus'], [null, null], [-1, null], [NaN, null], [1.5, null],
  ])('maps %s to %s without sharing exact money', (amount, expected) => {
    expect(assetBandFromWon(amount)).toBe(expected);
  });
  it('accepts only fixed bands, never a freeform amount', () => {
    for (const [code, label] of ASSET_BANDS) {expect(isAssetBand(code)).toBe(true); expect(assetBandLabel(code)).toBe(label);}
    for (const value of ['20123456', 20_123_456, '2천만원대', {}, undefined, null]) expect(isAssetBand(value)).toBe(false);
  });
});
