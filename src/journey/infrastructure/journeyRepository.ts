import {
  JOURNEY_SNAPSHOT_VERSION,
  parseJourneySnapshot,
  type JourneySnapshot,
} from '../domain/journeySnapshot';

export const JOURNEY_STORAGE_KEY = 'isf-journey-snapshot-v1';

export type JourneyLoadResult =
  | { status: 'found'; snapshot: JourneySnapshot }
  | { status: 'empty' }
  | { status: 'invalid' };

export type JourneyDestination = JourneySnapshot['destinationApp'];

export interface JourneyRepository {
  load(destination: JourneyDestination): JourneyLoadResult;
  save(snapshot: JourneySnapshot): void;
}

interface JourneyStorageEnvelope {
  version: typeof JOURNEY_SNAPSHOT_VERSION;
  snapshots: Partial<Record<JourneyDestination, JourneySnapshot>>;
}

export class BrowserJourneyRepository implements JourneyRepository {
  load(destination: JourneyDestination): JourneyLoadResult {
    try {
      const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
      if (raw === null) return { status: 'empty' };

      const storedValue: unknown = JSON.parse(raw);
      const legacySnapshot = parseJourneySnapshot(storedValue);
      if (legacySnapshot !== null) {
        return legacySnapshot.destinationApp === destination
          ? { status: 'found', snapshot: legacySnapshot }
          : { status: 'invalid' };
      }

      if (!isStorageEnvelope(storedValue)) return { status: 'invalid' };
      const snapshot = parseJourneySnapshot(storedValue.snapshots[destination]);
      return snapshot !== null && snapshot.destinationApp === destination
        ? { status: 'found', snapshot }
        : storedValue.snapshots[destination] === undefined
          ? { status: 'empty' }
          : { status: 'invalid' };
    } catch {
      return { status: 'invalid' };
    }
  }

  save(snapshot: JourneySnapshot): void {
    const storage = window.localStorage;
    const raw = storage.getItem(JOURNEY_STORAGE_KEY);
    const snapshots = raw === null ? {} : readValidSnapshots(raw);
    const envelope: JourneyStorageEnvelope = {
      version: JOURNEY_SNAPSHOT_VERSION,
      snapshots: snapshot.destinationApp === 'simulation'
        ? { simulation: snapshot }
        : { ...snapshots, portfolio: snapshot },
    };

    storage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(envelope));
  }
}

function readValidSnapshots(raw: string): JourneyStorageEnvelope['snapshots'] {
  try {
    const storedValue: unknown = JSON.parse(raw);
    const legacySnapshot = parseJourneySnapshot(storedValue);
    if (legacySnapshot !== null) {
      return { [legacySnapshot.destinationApp]: legacySnapshot };
    }
    if (!isStorageEnvelope(storedValue)) return {};

    const snapshots: JourneyStorageEnvelope['snapshots'] = {};
    for (const destination of ['simulation', 'portfolio'] as const) {
      const snapshot = parseJourneySnapshot(storedValue.snapshots[destination]);
      if (snapshot !== null && snapshot.destinationApp === destination) {
        snapshots[destination] = snapshot;
      }
    }
    return snapshots;
  } catch {
    return {};
  }
}

function isStorageEnvelope(value: unknown): value is JourneyStorageEnvelope {
  return isRecord(value)
    && value.version === JOURNEY_SNAPSHOT_VERSION
    && isRecord(value.snapshots);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
