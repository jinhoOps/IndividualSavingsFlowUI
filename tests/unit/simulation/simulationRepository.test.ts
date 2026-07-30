import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import {
  BrowserSimulationRepository,
  SIMULATION_STORAGE_KEY,
} from '../../../src/simulation/infrastructure/simulationRepository';
import { MemoryStorage } from './MemoryStorage';

const source = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};
const draft = createDefaultSimulationDraft(source, 456);

describe('BrowserSimulationRepository', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('round-trips one valid draft without changing Main or legacy stores', () => {
    storage.setItem('isf-main-v2', '{"main":true}');
    storage.setItem('isf-rebuild-v1', '{"legacy":true}');
    const repository = new BrowserSimulationRepository(() => storage);

    expect(repository.save(draft)).toEqual({ status: 'saved' });
    expect(repository.load()).toEqual({ status: 'found', draft });
    expect(storage.getItem('isf-main-v2')).toBe('{"main":true}');
    expect(storage.getItem('isf-rebuild-v1')).toBe('{"legacy":true}');
  });

  it('reports malformed and unavailable storage separately', () => {
    storage.setItem(SIMULATION_STORAGE_KEY, '{broken');
    expect(new BrowserSimulationRepository(() => storage).load()).toEqual({ status: 'invalid' });
    expect(new BrowserSimulationRepository(() => {
      throw new DOMException('blocked', 'SecurityError');
    }).load()).toEqual({ status: 'unavailable' });
  });

  it('clears only the compound draft key', () => {
    storage.setItem(SIMULATION_STORAGE_KEY, JSON.stringify(draft));
    storage.setItem('isf-step2-saves', 'keep');
    const repository = new BrowserSimulationRepository(() => storage);

    expect(repository.clear()).toEqual({ status: 'cleared' });
    expect(storage.getItem(SIMULATION_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('isf-step2-saves')).toBe('keep');
  });
});
