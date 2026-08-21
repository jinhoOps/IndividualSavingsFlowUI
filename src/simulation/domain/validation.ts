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
  'targetAmountWon',
  'years',
  'expectedAnnualReturnPercent',
  'baseRatePercent',
  'inflationOffsetPercentPoints',
  'amountMode',
  'updatedAt',
] as const;
const legacyDraftKeys = [
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
    targetAmountWon: targetForInitialInvestment(0),
    years: 20,
    expectedAnnualReturnPercent: 9,
    baseRatePercent: 2.75,
    inflationOffsetPercentPoints: -0.25,
    amountMode: 'nominal',
    updatedAt: now,
  };
}

export function parseSimulationDraft(value: unknown): CompoundSimulationDraft | null {
  if (!isRecord(value)) return null;
  const targetAmountWon = value.targetAmountWon;
  const parsed = parseDraftValues(value, SIMULATION_SCHEMA_VERSION, draftKeys, 0, 30);
  if (parsed === null || !isValidTarget(parsed.initialInvestmentWon, targetAmountWon)) return null;
  return {
    schemaVersion: SIMULATION_SCHEMA_VERSION,
    ...parsed,
    targetAmountWon,
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

  const legacy = parseDraftValues(value, 1, legacyDraftKeys, 1, 50)
    ?? parseDraftValues(value, 2, legacyDraftKeys, 0, 30);
  if (legacy === null) return null;

  const years = Math.min(legacy.years, 30);
  return {
    draft: {
      schemaVersion: SIMULATION_SCHEMA_VERSION,
      ...legacy,
      targetAmountWon: targetForInitialInvestment(legacy.initialInvestmentWon),
      years,
    },
    migration: legacy.years > 30 ? 'duration-capped' : 'schema-upgraded',
  };
}

function parseDraftValues(
  value: unknown,
  schemaVersion: number,
  keys: readonly string[],
  minimumYears: number,
  maximumYears: number,
): Omit<CompoundSimulationDraft, 'schemaVersion' | 'targetAmountWon'> | null {
  if (!hasExactKeys(value, keys)) return null;
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
  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.some((key) => typeof key !== 'string')) return false;
  actualKeys.sort();
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

export function targetForInitialInvestment(initialInvestmentWon: number): number | null {
  if (initialInvestmentWon < 80_000_000) return 100_000_000;
  if (initialInvestmentWon < 200_000_000) return 200_000_000;
  return null;
}

function isValidTarget(
  initialInvestmentWon: number,
  targetAmountWon: unknown,
): targetAmountWon is number | null {
  return targetAmountWon === null
    ? initialInvestmentWon >= 200_000_000
    : isPositiveSafeInteger(targetAmountWon) && targetAmountWon > initialInvestmentWon;
}

function isTwoDecimalNumber(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && Math.abs(value * 100 - Math.round(value * 100)) < Number.EPSILON * 100;
}

function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}
