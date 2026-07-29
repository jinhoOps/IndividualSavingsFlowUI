import {
  parseJourneySnapshot,
  type JourneySnapshot,
} from '../domain/journeySnapshot';

export const JOURNEY_STORAGE_KEY = 'isf-journey-snapshot-v1';

export type JourneyLoadResult =
  | { status: 'found'; snapshot: JourneySnapshot }
  | { status: 'empty' }
  | { status: 'invalid' };

export interface JourneyRepository {
  load(): JourneyLoadResult;
  save(snapshot: JourneySnapshot): void;
}

export class BrowserJourneyRepository implements JourneyRepository {
  load(): JourneyLoadResult {
    const raw = window.localStorage.getItem(JOURNEY_STORAGE_KEY);
    if (raw === null) return { status: 'empty' };

    try {
      const snapshot = parseJourneySnapshot(JSON.parse(raw));
      return snapshot === null ? { status: 'invalid' } : { status: 'found', snapshot };
    } catch {
      return { status: 'invalid' };
    }
  }

  save(snapshot: JourneySnapshot): void {
    window.localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify(snapshot));
  }
}
