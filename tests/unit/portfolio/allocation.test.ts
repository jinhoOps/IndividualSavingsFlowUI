import { describe, expect, it } from 'vitest';
import {
  createCashOnlyDraft,
  enableAutomaticCash,
  materializeAllocation,
  removeItem,
  orderedResultItems,
  setCashAmount,
  setItemAmount,
  setItemClassification,
  setItemPercentage,
  syncPlanToInvestment,
  largestResultItem,
} from '../../../src/portfolio/domain/allocation';

describe('Portfolio allocation', () => {
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

  it('classifies a new item as automatically growth', () => {
    const draft = setItemAmount(
      createCashOnlyDraft(100_000, 1),
      { id: 'asset-1', name: '미국 인덱스', order: 0 },
      50_000,
    );

    expect(draft.items).toMatchObject([{
      id: 'asset-1',
      classification: 'growth',
      classificationOrigin: 'automatic',
    }]);
  });

  it('recommends a new classification only while the item remains automatic', () => {
    const automatic = setItemAmount(
      createCashOnlyDraft(100_000, 1),
      { id: 'asset-1', name: '미국 인덱스', order: 0 },
      50_000,
    );
    const renamedAutomatic = setItemAmount(
      automatic,
      { id: 'asset-1', name: '금현물', order: 0 },
      50_000,
    );
    const userClassified = setItemClassification(renamedAutomatic, 'asset-1', 'growth', 'user');
    const renamedUserClassified = setItemAmount(
      userClassified,
      { id: 'asset-1', name: '미국 국채 ETF', order: 0 },
      50_000,
    );

    expect(renamedAutomatic.items[0]).toMatchObject({ classification: 'stable', classificationOrigin: 'automatic' });
    expect(renamedUserClassified.items[0]).toMatchObject({ classification: 'growth', classificationOrigin: 'user' });
  });

  it('orders result items by ratio and places cash after tied investments', () => {
    const items = orderedResultItems([
      { id: 'asset-2', name: '두번째', shareUnits: 400_000, order: 1, classification: 'growth', classificationOrigin: 'automatic' },
      { id: 'asset-1', name: '첫번째', shareUnits: 400_000, order: 0, classification: 'stable', classificationOrigin: 'user' },
    ], 400_000, 'ratio');

    expect(items.map((item) => item.id)).toEqual(['asset-1', 'asset-2', 'cash']);
  });

  it('keeps input order and puts cash last in input results', () => {
    const items = orderedResultItems([
      { id: 'asset-2', name: '두번째', shareUnits: 200_000, order: 1, classification: 'growth', classificationOrigin: 'automatic' },
      { id: 'asset-1', name: '첫번째', shareUnits: 600_000, order: 0, classification: 'stable', classificationOrigin: 'user' },
    ], 200_000, 'input');

    expect(items.map((item) => item.id)).toEqual(['asset-1', 'asset-2', 'cash']);
  });

  it('uses the first current result item when the largest shares tie', () => {
    const ordered = orderedResultItems([
      { id: 'asset-2', name: '두번째', shareUnits: 400_000, order: 1, classification: 'growth', classificationOrigin: 'automatic' },
      { id: 'asset-1', name: '첫번째', shareUnits: 400_000, order: 0, classification: 'stable', classificationOrigin: 'user' },
    ], 400_000, 'ratio');

    expect(largestResultItem(ordered)).toMatchObject({ id: 'asset-1', isCash: false });
    expect(largestResultItem([])).toBeNull();
  });
});
