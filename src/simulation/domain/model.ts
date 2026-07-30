export const SIMULATION_SCHEMA_VERSION = 1 as const;

export interface SimulationMainSource {
  monthlySavingsWon: number;
  monthlyInvestmentWon: number;
  mainUpdatedAt: number;
}

export interface CompoundSimulationDraft {
  schemaVersion: typeof SIMULATION_SCHEMA_VERSION;
  source: SimulationMainSource;
  initialInvestmentWon: number;
  years: number;
  expectedAnnualReturnPercent: number;
  baseRatePercent: number;
  inflationOffsetPercentPoints: number;
  amountMode: 'nominal' | 'real';
  updatedAt: number;
}

export interface ProjectionPoint {
  year: number;
  month: number;
  contributedPrincipalWon: number;
  contributedPrincipalRealWon: number;
  savingsNominalWon: number;
  savingsRealWon: number;
  investmentNominalWon: number;
  investmentRealWon: number;
  currentPlanNominalWon: number;
  allSavingsNominalWon: number;
  currentPlanRealWon: number;
  allSavingsRealWon: number;
}

export interface ProjectionResult {
  points: ProjectionPoint[];
  finalCurrentPlanWon: number;
  finalAllSavingsWon: number;
  advantageOverAllSavingsWon: number;
  principalRatioPercent: number | null;
}
