import { createCashOnlyDraft, setItemAmount } from './allocation';
import type { Classification, PortfolioDraft, PortfolioItemIdentity } from './model';

export type PortfolioRiskBand = 'defensive' | 'growth' | 'aggressive';
export type PortfolioExampleTag = '배당·인컴' | '인덱스' | '인덱스 레버리지' | '금' | 'BTC';
export type PortfolioAssetId = 'SCHD' | 'JEPQ' | 'VOO' | 'QQQM' | 'QLD' | 'BTC' | 'GOLD';

export interface PortfolioExampleLeg {
  assetId: PortfolioAssetId;
  percentage: number;
}

export interface PortfolioExample {
  id: string;
  title: string;
  riskBand: PortfolioRiskBand;
  tags: PortfolioExampleTag[];
  legs: PortfolioExampleLeg[];
}

interface PortfolioAsset extends PortfolioItemIdentity {
  classification: Classification;
}

export const PORTFOLIO_ASSETS: Record<PortfolioAssetId, PortfolioAsset> = {
  SCHD: { id: 'SCHD', name: 'SCHD', order: 0, classification: 'growth' },
  JEPQ: { id: 'JEPQ', name: 'JEPQ', order: 0, classification: 'growth' },
  VOO: { id: 'VOO', name: 'VOO', order: 0, classification: 'growth' },
  QQQM: { id: 'QQQM', name: 'QQQM', order: 0, classification: 'growth' },
  QLD: { id: 'QLD', name: 'QLD', order: 0, classification: 'growth' },
  BTC: { id: 'BTC', name: 'BTC', order: 0, classification: 'growth' },
  GOLD: { id: 'GOLD', name: '금(GOLD)', order: 0, classification: 'stable' },
};

export const PORTFOLIO_EXAMPLES: PortfolioExample[] = [
  {
    id: 'schd-gold', title: 'SCHD 70 · 금 30', riskBand: 'defensive',
    tags: ['배당·인컴', '인덱스', '금'],
    legs: [{ assetId: 'SCHD', percentage: 70 }, { assetId: 'GOLD', percentage: 30 }],
  },
  {
    id: 'jepq-gold', title: 'JEPQ 70 · 금 30', riskBand: 'defensive',
    tags: ['배당·인컴', '금'],
    legs: [{ assetId: 'JEPQ', percentage: 70 }, { assetId: 'GOLD', percentage: 30 }],
  },
  {
    id: 'voo-gold', title: 'VOO 70 · 금 30', riskBand: 'defensive',
    tags: ['인덱스', '금'],
    legs: [{ assetId: 'VOO', percentage: 70 }, { assetId: 'GOLD', percentage: 30 }],
  },
  {
    id: 'qqqm-schd', title: 'QQQM 70 · SCHD 30', riskBand: 'growth',
    tags: ['인덱스', '배당·인컴'],
    legs: [{ assetId: 'QQQM', percentage: 70 }, { assetId: 'SCHD', percentage: 30 }],
  },
  {
    id: 'qld-schd-gold', title: 'QLD 50 · SCHD 30 · 금 20', riskBand: 'aggressive',
    tags: ['인덱스 레버리지', '배당·인컴', '금'],
    legs: [
      { assetId: 'QLD', percentage: 50 },
      { assetId: 'SCHD', percentage: 30 },
      { assetId: 'GOLD', percentage: 20 },
    ],
  },
  {
    id: 'qld-schd-gold-70', title: 'QLD 70 · SCHD 20 · 금 10', riskBand: 'aggressive',
    tags: ['인덱스 레버리지', '배당·인컴', '금'],
    legs: [
      { assetId: 'QLD', percentage: 70 },
      { assetId: 'SCHD', percentage: 20 },
      { assetId: 'GOLD', percentage: 10 },
    ],
  },
  {
    id: 'qld-btc-gold', title: 'QLD 50 · BTC 30 · 금 20', riskBand: 'aggressive',
    tags: ['인덱스 레버리지', '금', 'BTC'],
    legs: [
      { assetId: 'QLD', percentage: 50 },
      { assetId: 'BTC', percentage: 30 },
      { assetId: 'GOLD', percentage: 20 },
    ],
  },
];

export function createDraftFromExample(
  example: PortfolioExample,
  investmentWon: number,
  now: number,
): PortfolioDraft {
  return createDraftFromAllocation(example.legs, investmentWon, now);
}

export function createDraftFromAllocation(
  legs: readonly PortfolioExampleLeg[],
  investmentWon: number,
  now: number,
): PortfolioDraft {
  if (!Number.isSafeInteger(investmentWon) || investmentWon <= 0) {
    throw new Error('invalid-investment');
  }
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('invalid-timestamp');
  if (legs.length === 0 || legs.length > 3) throw new Error('invalid-example-allocation');

  const assetIds = new Set<PortfolioAssetId>();
  let totalPercentage = 0;
  for (const leg of legs) {
    if (!Number.isInteger(leg.percentage) || leg.percentage <= 0 || leg.percentage > 100) {
      throw new Error('invalid-example-allocation');
    }
    if (assetIds.has(leg.assetId) || PORTFOLIO_ASSETS[leg.assetId] === undefined) {
      throw new Error('invalid-example-allocation');
    }
    assetIds.add(leg.assetId);
    totalPercentage += leg.percentage;
  }
  if (totalPercentage !== 100) throw new Error('invalid-example-allocation');

  let draft = createCashOnlyDraft(investmentWon, now);
  for (const [order, leg] of legs.entries()) {
    const asset = PORTFOLIO_ASSETS[leg.assetId];
    draft = setItemAmount(draft, { ...asset, order }, Math.floor(investmentWon * leg.percentage / 100));
  }

  return {
    ...draft,
    inputMode: 'percentage',
    updatedAt: now,
    items: draft.items.map((item) => ({
      ...item,
      classification: PORTFOLIO_ASSETS[item.id as PortfolioAssetId].classification,
      classificationOrigin: 'automatic',
    })),
  };
}
