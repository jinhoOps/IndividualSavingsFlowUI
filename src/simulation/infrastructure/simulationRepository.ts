import type { CompoundSimulationDraft } from '../domain/model';
import { parseSimulationDraft } from '../domain/validation';

export const SIMULATION_STORAGE_KEY = 'isf-simulation-compound-v1';

export type SimulationLoadResult =
  | { status: 'found'; draft: CompoundSimulationDraft }
  | { status: 'empty' }
  | { status: 'invalid' }
  | { status: 'unavailable' };

export type SimulationSaveResult = { status: 'saved' } | { status: 'unavailable' };
export type SimulationClearResult = { status: 'cleared' } | { status: 'unavailable' };

export interface SimulationRepository {
  load(): SimulationLoadResult;
  save(draft: CompoundSimulationDraft): SimulationSaveResult;
  clear(): SimulationClearResult;
}

export class BrowserSimulationRepository implements SimulationRepository {
  constructor(
    private readonly getStorage: () => Storage = () => window.localStorage,
  ) {}

  load(): SimulationLoadResult {
    try {
      const raw = this.getStorage().getItem(SIMULATION_STORAGE_KEY);
      if (raw === null) return { status: 'empty' };
      const draft = parseSimulationDraft(JSON.parse(raw));
      return draft === null ? { status: 'invalid' } : { status: 'found', draft };
    } catch (error) {
      return error instanceof SyntaxError
        ? { status: 'invalid' }
        : { status: 'unavailable' };
    }
  }

  save(draft: CompoundSimulationDraft): SimulationSaveResult {
    try {
      this.getStorage().setItem(SIMULATION_STORAGE_KEY, JSON.stringify(draft));
      return { status: 'saved' };
    } catch {
      return { status: 'unavailable' };
    }
  }

  clear(): SimulationClearResult {
    try {
      this.getStorage().removeItem(SIMULATION_STORAGE_KEY);
      return { status: 'cleared' };
    } catch {
      return { status: 'unavailable' };
    }
  }
}
