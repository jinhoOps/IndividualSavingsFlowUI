import { PORTFOLIO_EXAMPLES, type PortfolioExample, type PortfolioExampleLeg, type PortfolioRiskBand } from './portfolioExamples';

export type PortfolioSamplePreset = 5 | 9 | 13;

export interface PortfolioSampleSelection {
  preset: PortfolioSamplePreset;
  example: PortfolioExample;
  exampleId: string;
  leadPercentage: number;
  riskBand: PortfolioRiskBand;
  legs: PortfolioExampleLeg[];
}

const PRESET_CONFIG: Record<PortfolioSamplePreset, { exampleId: string; leadPercentage: number }> = {
  5: { exampleId: 'schd-gold', leadPercentage: 50 },
  9: { exampleId: 'qqqm-schd', leadPercentage: 70 },
  13: { exampleId: 'qld-schd-gold', leadPercentage: 50 },
};

export function sampleForPreset(preset: PortfolioSamplePreset): PortfolioSampleSelection {
  const config = PRESET_CONFIG[preset];
  const source = PORTFOLIO_EXAMPLES.find((candidate) => candidate.id === config.exampleId);
  if (source === undefined) throw new Error(`unknown-portfolio-example:${config.exampleId}`);
  const legs = rebalanceLead(source.legs, config.leadPercentage);
  const example = {
    ...source,
    title: legs.map((leg) => `${leg.assetId === 'GOLD' ? '금' : leg.assetId} ${leg.percentage}`).join(' · '),
    legs,
  };
  return {
    preset,
    example,
    exampleId: source.id,
    leadPercentage: config.leadPercentage,
    riskBand: source.riskBand,
    legs,
  };
}

function rebalanceLead(legs: readonly PortfolioExampleLeg[], leadPercentage: number): PortfolioExampleLeg[] {
  if (legs.length < 2 || legs.some((leg) => leg.percentage <= 0)) throw new Error('invalid-example-allocation');
  const [lead, ...rest] = legs;
  const remainder = 100 - leadPercentage;
  const restTotal = rest.reduce((sum, leg) => sum + leg.percentage, 0);
  return [
    { ...lead, percentage: leadPercentage },
    ...rest.map((leg) => ({ ...leg, percentage: Math.round(remainder * leg.percentage / restTotal) })),
  ];
}
