import type { MainData } from '../../main/domain/model';

export const JOURNEY_SNAPSHOT_VERSION = 1 as const;
const MAX_DATE_TIMESTAMP_MS = 8_640_000_000_000_000;

export type JourneySnapshot =
  | {
    version: 1;
    sourceApp: 'main';
    sourceView: 'dashboard';
    destinationApp: 'simulation';
    monthlyInvestableAmountWon: number;
    mainUpdatedAt: number;
    createdAt: number;
  }
  | {
    version: 1;
    sourceApp: 'simulation';
    sourceView: 'simulation-readiness';
    destinationApp: 'portfolio';
    monthlyInvestableAmountWon: number;
    mainUpdatedAt: number;
    createdAt: number;
  };

export function createMainJourneySnapshot(data: MainData, now = Date.now()): JourneySnapshot {
  return {
    version: JOURNEY_SNAPSHOT_VERSION,
    sourceApp: 'main',
    sourceView: 'dashboard',
    destinationApp: 'simulation',
    monthlyInvestableAmountWon:
      data.monthlyNetIncomeWon
      - data.monthlyHousingWon
      - data.monthlyLivingWon
      - data.monthlySavingWon,
    mainUpdatedAt: data.updatedAt,
    createdAt: now,
  };
}

export function createPortfolioJourneySnapshot(source: JourneySnapshot, now = Date.now()): JourneySnapshot {
  return {
    version: JOURNEY_SNAPSHOT_VERSION,
    sourceApp: 'simulation',
    sourceView: 'simulation-readiness',
    destinationApp: 'portfolio',
    monthlyInvestableAmountWon: source.monthlyInvestableAmountWon,
    mainUpdatedAt: source.mainUpdatedAt,
    createdAt: now,
  };
}

export function parseJourneySnapshot(value: unknown): JourneySnapshot | null {
  if (!isRecord(value)
    || value.version !== JOURNEY_SNAPSHOT_VERSION
    || !isSafeInteger(value.monthlyInvestableAmountWon)
    || !isValidTimestamp(value.mainUpdatedAt)
    || !isValidTimestamp(value.createdAt)) {
    return null;
  }

  if (value.sourceApp === 'main'
    && value.sourceView === 'dashboard'
    && value.destinationApp === 'simulation') {
    return {
      version: JOURNEY_SNAPSHOT_VERSION,
      sourceApp: 'main',
      sourceView: 'dashboard',
      destinationApp: 'simulation',
      monthlyInvestableAmountWon: value.monthlyInvestableAmountWon,
      mainUpdatedAt: value.mainUpdatedAt,
      createdAt: value.createdAt,
    };
  }

  if (value.sourceApp === 'simulation'
    && value.sourceView === 'simulation-readiness'
    && value.destinationApp === 'portfolio') {
    return {
      version: JOURNEY_SNAPSHOT_VERSION,
      sourceApp: 'simulation',
      sourceView: 'simulation-readiness',
      destinationApp: 'portfolio',
      monthlyInvestableAmountWon: value.monthlyInvestableAmountWon,
      mainUpdatedAt: value.mainUpdatedAt,
      createdAt: value.createdAt,
    };
  }

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

function isValidTimestamp(value: unknown): value is number {
  return isSafeInteger(value) && value >= 0 && value <= MAX_DATE_TIMESTAMP_MS;
}
