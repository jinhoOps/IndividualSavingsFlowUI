import { describe, expect, it } from 'vitest';
import {
  createCashOnlyDraft,
  enableAutomaticCash,
  materializeAllocation,
  removeItem,
  setCashAmount,
  setItemAmount,
  setItemPercentage,
  syncPlanToInvestment,
} from '../../../src/portfolio/domain/allocation';

describe('Portfolio allocation', () => {
  it('creates Phase A drafts in the aggregate scope', () => {
    expect(createCashOnlyDraft(200_000, 1).scope).toEqual({ type: 'aggregate' });
  });

  it('uses unallocated investment as automatic cash', () => {
    const draft = setItemAmount(
      createCashOnlyDraft(200_000, 1),
      { id: 'asset-1', name: '미국 인덱스', order: 0 },
      120_000,
    );

    expect(materializeAllocation(draft, 200_000)).toMatchObject({
      items: [{ id: 'asset-1', amountWon: 120_000 }],
      cashAmountWon: 80_000,
      totalAmountWon: 200_000,
    });
  });

  it('blocks amounts beyond remaining investment', () => {
    const draft = setItemAmount(
      createCashOnlyDraft(200_000, 1),
      { id: 'asset-1', name: '인덱스', order: 0 },
      150_000,
    );

    expect(() => setItemAmount(
      draft,
      { id: 'asset-2', name: '배당', order: 1 },
      60_000,
    )).toThrow('allocation-exceeds-investment');
  });

  it('requires manual cash and assets to total exactly 100 percent', () => {
    const withAsset = setItemPercentage(
      createCashOnlyDraft(300_000, 1),
      { id: 'asset-1', name: '채권', order: 0 },
      33.3,
    );
    const manual = setCashAmount(withAsset, 100_000);

    expect(manual.cashMode).toBe('manual');
    expect(manual.isApplicable).toBe(false);
    expect(enableAutomaticCash(manual).cashMode).toBe('automatic');
  });

  it('moves deleted allocation to cash', () => {
    const draft = setItemAmount(
      createCashOnlyDraft(100_000, 1),
      { id: 'asset-1', name: '금', order: 0 },
      40_000,
    );

    expect(materializeAllocation(removeItem(draft, 'asset-1'), 100_000).cashAmountWon)
      .toBe(100_000);
  });

  it('puts investment increases into cash and scales decreases by ratio', () => {
    const original = setItemAmount(
      createCashOnlyDraft(200_000, 1),
      { id: 'asset-1', name: '인덱스', order: 0 },
      120_000,
    );
    const increased = syncPlanToInvestment(original, 300_000, 2);

    expect(materializeAllocation(increased, 300_000)).toMatchObject({
      items: [{ amountWon: 120_000 }],
      cashAmountWon: 180_000,
    });

    const decreased = syncPlanToInvestment(increased, 150_000, 3);
    expect(materializeAllocation(decreased, 150_000)).toMatchObject({
      items: [{ amountWon: 60_000 }],
      cashAmountWon: 90_000,
    });
  });
});
