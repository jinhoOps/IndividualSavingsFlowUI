import { describe, expect, it } from 'vitest';
import { materializeAllocation } from '../../../src/portfolio/domain/allocation';
import {
  PORTFOLIO_EXAMPLES,
  createDraftFromAllocation,
  createDraftFromExample,
} from '../../../src/portfolio/domain/portfolioExamples';

describe('portfolio examples', () => {
  it('keeps the agreed seven samples grouped by relative risk and attribute tags', () => {
    expect(PORTFOLIO_EXAMPLES.map((example) => [example.id, example.riskBand])).toEqual([
      ['schd-gold', 'defensive'],
      ['jepq-gold', 'defensive'],
      ['voo-gold', 'defensive'],
      ['qqqm-schd', 'growth'],
      ['qld-schd-gold', 'aggressive'],
      ['qld-schd-gold-70', 'aggressive'],
      ['qld-btc-gold', 'aggressive'],
    ]);
    expect(PORTFOLIO_EXAMPLES.find((example) => example.id === 'qld-btc-gold')?.tags)
      .toEqual(['인덱스 레버리지', '금', 'BTC']);
  });

  it('turns an example into an applicable aggregate draft with the agreed classifications', () => {
    const example = PORTFOLIO_EXAMPLES.find((candidate) => candidate.id === 'qld-schd-gold-70')!;
    const draft = createDraftFromExample(example, 1_000_000, 10);

    expect(draft).toMatchObject({
      scope: { type: 'aggregate' },
      cashMode: 'automatic',
      inputMode: 'percentage',
      syncedInvestmentWon: 1_000_000,
      isApplicable: true,
    });
    expect(draft.items.map((item) => [item.id, item.classification, item.order])).toEqual([
      ['QLD', 'growth', 0],
      ['SCHD', 'growth', 1],
      ['GOLD', 'stable', 2],
    ]);
    expect(materializeAllocation(draft, 1_000_000)).toMatchObject({
      cashAmountWon: 0,
      totalAmountWon: 1_000_000,
    });
  });

  it('keeps an invalid tiny allocation out of the draft', () => {
    const example = PORTFOLIO_EXAMPLES.find((candidate) => candidate.id === 'qld-schd-gold-70')!;

    expect(() => createDraftFromExample(example, 5_000, 10)).toThrow('amount-below-minimum');
  });

  it('uses the same validation path for a direct composition', () => {
    const draft = createDraftFromAllocation([
      { assetId: 'VOO', percentage: 70 },
      { assetId: 'GOLD', percentage: 30 },
    ], 200_000, 10);

    expect(materializeAllocation(draft, 200_000).items.map((item) => [item.id, item.amountWon]))
      .toEqual([['VOO', 140_000], ['GOLD', 60_000]]);
  });
});
