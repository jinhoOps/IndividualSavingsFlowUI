import { describe, expect, it } from 'vitest';
import { createEmptyMainData, type MainData } from '../../../src/main/domain/model';
import { mainReducer, type MainState } from '../../../src/main/application/mainReducer';

function appliedData(): MainData {
  const data = createEmptyMainData();
  data.incomes = [{ id: 'salary', name: '급여', amountWon: 3_000_000, allocations: [] }];
  return data;
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
  it('edits only the draft and cancel restores applied data', () => {
    const applied = appliedData();
    const initial = dashboardState(applied);

    const edited = mainReducer(initial, {
      type: 'replace-draft',
      draft: { ...initial.draft, incomes: [{ ...initial.draft.incomes[0], amountWon: 4_000_000 }] },
    });

    expect(edited.applied?.incomes[0].amountWon).toBe(3_000_000);
    expect(edited.dirty).toBe(true);

    const cancelled = mainReducer(edited, { type: 'cancel-draft' });

    expect(cancelled.draft).toEqual(applied);
    expect(cancelled.draft).not.toBe(applied);
    expect(cancelled.dirty).toBe(false);
  });

  it('restarts setup from a copy of applied data without changing the dashboard data', () => {
    const applied = appliedData();

    const restarted = mainReducer(dashboardState(applied), { type: 'restart-setup' });

    expect(restarted.mode).toBe('setup');
    expect(restarted.setupStep).toBe('welcome');
    expect(restarted.draft).toEqual(applied);
    expect(restarted.draft).not.toBe(applied);
    expect(restarted.applied).toBe(applied);
  });

  it('commits a saved copy only after save succeeds', () => {
    const original = appliedData();
    const changed = { ...original, incomes: [{ ...original.incomes[0], amountWon: 4_000_000 }] };
    const started = mainReducer(mainReducer(dashboardState(original), { type: 'replace-draft', draft: changed }), {
      type: 'save-started',
    });

    const failed = mainReducer(started, { type: 'save-failed' });
    expect(failed.applied?.incomes[0].amountWon).toBe(3_000_000);
    expect(failed.saveStatus).toBe('error');

    const saved = mainReducer(started, { type: 'save-succeeded', data: changed });
    expect(saved.applied?.incomes[0].amountWon).toBe(4_000_000);
    expect(saved.dirty).toBe(false);
    expect(saved.saveStatus).toBe('saved');
  });
});
