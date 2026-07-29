import { describe, expect, it } from 'vitest';
import { mainReducer, type MainState } from '../../../src/main/application/mainReducer';
import { createEmptyMainData, type MainData } from '../../../src/main/domain/model';

function appliedData(overrides: Partial<MainData> = {}): MainData {
  return {
    ...createEmptyMainData(),
    monthlyNetIncomeWon: 3_000_000,
    monthlyHousingWon: 900_000,
    monthlyLivingWon: 700_000,
    monthlySavingWon: 500_000,
    monthlyInvestmentWon: 400_000,
    ...overrides,
  };
}

function dashboardState(applied: MainData): MainState {
  return {
    mode: 'dashboard',
    applied,
    draft: structuredClone(applied),
    setupStep: null,
    dirty: false,
    saveStatus: 'idle',
    loadError: null,
  };
}

describe('mainReducer', () => {
  it('edits only the v2 draft and cancel restores applied data', () => {
    const applied = appliedData();
    const initial = dashboardState(applied);

    const edited = mainReducer(initial, {
      type: 'replace-draft',
      draft: { ...initial.draft, monthlyNetIncomeWon: 4_000_000 },
    });

    expect(edited.applied?.monthlyNetIncomeWon).toBe(3_000_000);
    expect(edited.dirty).toBe(true);

    const cancelled = mainReducer(edited, { type: 'cancel-draft' });

    expect(cancelled.draft).toEqual(applied);
    expect(cancelled.draft).not.toBe(applied);
    expect(cancelled.dirty).toBe(false);
  });

  it('restarts setup at welcome from a copy without changing applied data', () => {
    const applied = appliedData();

    const restarted = mainReducer(dashboardState(applied), { type: 'restart-setup' });

    expect(restarted.mode).toBe('setup');
    expect(restarted.setupStep).toBe('welcome');
    expect(restarted.draft).toEqual(applied);
    expect(restarted.draft).not.toBe(applied);
    expect(restarted.applied).toBe(applied);
  });

  it('commits a saved v2 copy only after save succeeds', () => {
    const original = appliedData();
    const changed = appliedData({ monthlyNetIncomeWon: 4_000_000 });
    const started = mainReducer(mainReducer(dashboardState(original), { type: 'replace-draft', draft: changed }), {
      type: 'save-started',
    });

    const failed = mainReducer(started, { type: 'save-failed' });
    expect(failed.applied?.monthlyNetIncomeWon).toBe(3_000_000);
    expect(failed.saveStatus).toBe('error');

    const saved = mainReducer(started, { type: 'save-succeeded', data: changed });
    expect(saved.applied?.monthlyNetIncomeWon).toBe(4_000_000);
    expect(saved.dirty).toBe(false);
    expect(saved.saveStatus).toBe('saved');
  });
});
