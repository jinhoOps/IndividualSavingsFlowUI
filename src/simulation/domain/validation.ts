import {
  SIMULATION_SCHEMA_VERSION,
  type CompoundSimulationDraft,
  type SimulationDraftMigration,
  type SimulationMainSource,
} from './model';

const draftKeys = [
  'schemaVersion',
  'source',
  'initialInvestmentWon',
  'years',
  'expectedAnnualReturnPercent',
  'baseRatePercent',
  'inflationOffsetPercentPoints',
  'amountMode',
  'updatedAt',
] as const;
const sourceKeys = [
  'monthlySavingsWon',
  'monthlyInvestmentWon',
  'mainUpdatedAt',
] as const;

export function createDefaultSimulationDraft(
  source: SimulationMainSource,
  now: number,
): CompoundSimulationDraft {
  return {
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    source,
    initialInvestmentWon: 0,
    years: 20,
    expectedAnnualReturnPercent: 9,
    baseRatePercent: 2.75,
    inflationOffsetPercentPoints: -0.25,
    amountMode: 'nominal',
    updatedAt: now,
  };
}

export function parseSimulationDraft(value: unknown): CompoundSimulationDraft | null {
  const parsed = parseDraftValues(value, SIMULATION_SCHEMA_VERSION, 0, 30);
  return parsed === null ? null : {
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    ...parsed,
  };
}

export interface StoredSimulationDraftParseResult {
  draft: CompoundSimulationDraft;
  migration: SimulationDraftMigration | null;
}

export function parseStoredSimulationDraft(
  value: unknown,
): StoredSimulationDraftParseResult | null {
  const current = parseSimulationDraft(value);
  if (current !== null) return { draft: current, migration: null };

  const legacy = parseDraftValues(value, 1, 1, 50);
  if (legacy === null) return null;

  const years = Math.min(legacy.years, 30);
  return {
    draft: {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      ...legacy,
      years,
    },
    migration: legacy.years > 30 ? 'duration-capped' : 'schema-upgraded',
  };
}

function parseDraftValues(
  value: unknown,
  schemaVersion: number,
  minimumYears: number,
  maximumYears: number,
): Omit<CompoundSimulationDraft, 'schemaVersion'> | null {
  if (!hasExactKeys(value, draftKeys)) return null;
  if (!hasExactKeys(value.source, sourceKeys)) return null;

  const source = value.source;
  if (
    !isNonnegativeSafeInteger(source.monthlySavingsWon)
    || !isNonnegativeSafeInteger(source.monthlyInvestmentWon)
    || !isPositiveSafeInteger(source.mainUpdatedAt)
    || value.schemaVersion !== schemaVersion
    || !isNonnegativeSafeInteger(value.initialInvestmentWon)
    || !isIntegerInRange(value.years, minimumYears, maximumYears)
    || !isTwoDecimalNumber(value.expectedAnnualReturnPercent)
    || value.expectedAnnualReturnPercent < 0
    || value.expectedAnnualReturnPercent > 30
    || !isTwoDecimalNumber(value.baseRatePercent)
    || value.baseRatePercent <= -100
    || !isTwoDecimalNumber(value.inflationOffsetPercentPoints)
    || value.baseRatePercent + value.inflationOffsetPercentPoints <= -100
    || (value.amountMode !== 'nominal' && value.amountMode !== 'real')
    || !isPositiveSafeInteger(value.updatedAt)
  ) {
    return null;
  }

  return {
    source: {
      monthlySavingsWon: source.monthlySavingsWon,
      monthlyInvestmentWon: source.monthlyInvestmentWon,
      mainUpdatedAt: source.mainUpdatedAt,
    },
    initialInvestmentWon: value.initialInvestmentWon,
    years: value.years,
    expectedAnnualReturnPercent: value.expectedAnnualReturnPercent,
    baseRatePercent: value.baseRatePercent,
    inflationOffsetPercentPoints: value.inflationOffsetPercentPoints,
    amountMode: value.amountMode,
    updatedAt: value.updatedAt,
  };
}

function hasExactKeys<const Keys extends readonly string[]>(
  value: unknown,
  keys: Keys,
): value is Record<Keys[number], unknown> {
  if (!isRecord(value)) return false;
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  return actualKeys.length === expectedKeys.length
    && actualKeys.every((key, index) => key === expectedKeys[index]);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonnegativeSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function isTwoDecimalNumber(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Math.abs(value * 100 - Math.round(value * 100)) < Number.EPSILON * 100;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}
