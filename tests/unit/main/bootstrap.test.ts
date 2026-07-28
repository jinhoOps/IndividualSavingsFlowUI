import { describe, expect, it } from 'vitest';
import { bootstrapMain, applyDraft } from '../../../src/main/application/bootstrap';
import type { MainState } from '../../../src/main/application/mainReducer';
import { createEmptyMainData, type MainData, type SetupStep } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';
import type { MigrationResult } from '../../../src/main/infrastructure/legacyMigration';

function validData(): MainData {
  const data = createEmptyMainData();
  data.accounts = [{ id: 'salary-account', name: '급여통장', kind: 'income' }];
  data.incomes = [{
    id: 'salary',
    name: '급여',
    amountWon: 3_000_000,
    allocations: [{ accountId: 'salary-account', amountWon: 3_000_000 }],
  }];
  return data;
}

function repository(
  loadResult: MigrationResult,
  progress: { step: SetupStep; draft: MainData } | null = null,
  persistedData?: MainData,
): MainRepository & {
  saveCalls: MainData[];
} {
  const saveCalls: MainData[] = [];
  return {
    load: async () => loadResult,
    save: async (data): Promise<MainData> => {
      saveCalls.push(data);
      return persistedData ?? data;
    },
    saveSetupProgress: () => undefined,
    loadSetupProgress: () => progress,
    clearSetupProgress: () => undefined,
    saveCalls,
  };
}

describe('bootstrapMain', () => {
  it('starts a new setup at welcome when no data or setup progress exists', async () => {
    const state = await bootstrapMain(repository({ status: 'empty', data: null, original: null }));

    expect(state).toMatchObject({ mode: 'setup', setupStep: 'welcome', applied: null, dirty: false });
    expect(state.draft).toEqual(createEmptyMainData());
  });

  it('resumes the saved setup step and draft when no applied data exists', async () => {
    const draft = validData();
    const state = await bootstrapMain(repository(
      { status: 'empty', data: null, original: null },
      { step: 'account', draft },
    ));

    expect(state).toMatchObject({ mode: 'setup', setupStep: 'account', applied: null, dirty: false });
    expect(state.draft).toEqual(draft);
    expect(state.draft).not.toBe(draft);
  });

  it('opens current or migrated data on the dashboard', async () => {
    const data = validData();

    for (const status of ['current', 'migrated'] as const) {
      const state = await bootstrapMain(repository({ status, data, original: {} }));
      expect(state).toMatchObject({ mode: 'dashboard', applied: data, setupStep: null, dirty: false });
      expect(state.draft).toEqual(data);
      expect(state.draft).not.toBe(data);
    }
  });

  it('keeps current data applied while presenting a pending draft for recovery', async () => {
    const current = validData();
    current.incomes[0].amountWon = 3_000_000;
    const pending = validData();
    pending.incomes[0].amountWon = 4_000_000;

    const state = await bootstrapMain(repository({ status: 'recovery', current, data: pending, original: {} }));

    expect(state.mode).toBe('recovery');
    expect(state.applied).toEqual(current);
    expect(state.draft).toEqual(pending);
    expect(state.dirty).toBe(true);
  });

  it('enters recovery and retains the original data when migration fails', async () => {
    const original = { bad: 'legacy-data' };
    const state = await bootstrapMain(repository({
      status: 'failed',
      data: null,
      original,
      reason: 'Legacy data has an unsupported shape.',
    }));

    expect(state.mode).toBe('recovery');
    expect(state.applied).toBeNull();
    expect(state.loadError).toMatchObject({ message: 'Legacy data has an unsupported shape.', original });
  });
});

describe('applyDraft', () => {
  it('returns the persisted draft and recalculates its cashflow summary after saving', async () => {
    const draft = validData();
    draft.expenses = [{ id: 'rent', name: '월세', amountWon: 1_000_000 }];
    draft.savings = [{ id: 'deposit', name: '적금', amountWon: 500_000 }];
    draft.investments = [{ id: 'etf', name: 'ETF', amountWon: 400_000 }];
    const persisted = { ...structuredClone(draft), updatedAt: 1_750_000_000_000 };
    const storage = repository({ status: 'empty', data: null, original: null }, null, persisted);
    const state: MainState = {
      mode: 'setup', applied: null, draft, setupStep: 'review', dirty: true, saveStatus: 'idle', loadError: null,
    };

    const result = await applyDraft(state, storage);

    expect(result).toMatchObject({
      ok: true,
      data: persisted,
      summary: {
        incomeWon: 3_000_000,
        expenseWon: 1_000_000,
        savingWon: 500_000,
        investmentWon: 400_000,
        plannedOutflowWon: 1_900_000,
        availableWon: 1_100_000,
        deficitWon: 0,
      },
    });
    if (result.ok) expect(result.data).toBe(persisted);
  });

  it('returns validation issues without saving an invalid draft', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    const state: MainState = {
      mode: 'setup', applied: null, draft: createEmptyMainData(), setupStep: 'welcome', dirty: true,
      saveStatus: 'idle', loadError: null,
    };

    await expect(applyDraft(state, storage)).resolves.toMatchObject({ ok: false, kind: 'validation' });
    expect(storage.saveCalls).toEqual([]);
  });

  it('does not replace applied data when storage rejects the draft', async () => {
    const applied = validData();
    const draft = structuredClone(applied);
    draft.incomes[0].amountWon = 4_000_000;
    draft.incomes[0].allocations[0].amountWon = 4_000_000;
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.save = async () => { throw new Error('quota exceeded'); };
    const state: MainState = {
      mode: 'dashboard', applied, draft, setupStep: null, dirty: true, saveStatus: 'idle', loadError: null,
    };

    await expect(applyDraft(state, storage)).resolves.toMatchObject({ ok: false, kind: 'storage' });
    expect(state.applied).toBe(applied);
    expect(state.applied?.incomes[0].amountWon).toBe(3_000_000);
  });
});
