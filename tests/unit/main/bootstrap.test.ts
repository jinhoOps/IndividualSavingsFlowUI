import { describe, expect, it } from 'vitest';
import { applyDraft, bootstrapMain } from '../../../src/main/application/bootstrap';
import type { MainState } from '../../../src/main/application/mainReducer';
import { createEmptyMainData, type MainData } from '../../../src/main/domain/model';
import type {
  MainLoadResult,
  MainRepository,
  SetupProgress,
} from '../../../src/main/infrastructure/mainRepository';

function validData(overrides: Partial<MainData> = {}): MainData {
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

function repository(
  loadResult: MainLoadResult,
  progress: SetupProgress | null = null,
  persistedData?: MainData,
): MainRepository & { saveCalls: MainData[] } {
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
    discardPending: () => undefined,
    discardRecovery: () => undefined,
    acknowledgeFailedCurrent: () => undefined,
    saveCalls,
  };
}

describe('bootstrapMain', () => {
  it('starts a new setup at welcome when no data or setup progress exists', async () => {
    const state = await bootstrapMain(repository({ status: 'empty', data: null, original: null }));

    expect(state).toMatchObject({ mode: 'setup', setupStep: 'welcome', applied: null, dirty: false });
    expect(state.draft).toEqual(createEmptyMainData());
  });

  it('resumes each persisted v2 setup stage and keeps a detached draft', async () => {
    const draft = validData();

    for (const step of ['income', 'housing', 'living', 'saving-investment', 'review'] as const) {
      const state = await bootstrapMain(repository(
        { status: 'empty', data: null, original: null },
        { kind: 'initial', step, draft },
      ));

      expect(state).toMatchObject({ mode: 'setup', setupStep: step, applied: null, dirty: false });
      expect(state.draft).toEqual(draft);
      expect(state.draft).not.toBe(draft);
    }
  });

  it('opens current v2 data on the dashboard', async () => {
    const data = validData();

    const state = await bootstrapMain(repository({ status: 'current', data, original: {} }));

    expect(state).toMatchObject({ mode: 'dashboard', applied: data, setupStep: null, dirty: false });
    expect(state.draft).toEqual(data);
    expect(state.draft).not.toBe(data);
  });

  it('resumes restart setup with the persisted current plan still applied', async () => {
    const applied = validData();
    const restartDraft = validData({ monthlyHousingWon: 1_100_000 });
    const state = await bootstrapMain(repository(
      { status: 'current', data: applied, original: applied },
      { kind: 'restart', step: 'housing', draft: restartDraft },
    ));

    expect(state).toMatchObject({
      mode: 'setup',
      setupStep: 'housing',
      applied,
      draft: restartDraft,
    });
    expect(state.applied).not.toBe(applied);
    expect(state.draft).not.toBe(restartDraft);
  });

  it('ignores restart progress superseded by a newer applied revision', async () => {
    const applied = validData({ updatedAt: 20 });
    const staleRestart = validData({ updatedAt: 10, monthlyHousingWon: 1_100_000 });

    const state = await bootstrapMain(repository(
      { status: 'current', data: applied, original: applied },
      { kind: 'restart', step: 'housing', draft: staleRestart },
    ));

    expect(state).toMatchObject({
      mode: 'dashboard',
      setupStep: null,
      applied,
      draft: applied,
    });
  });

  it('resumes restart progress based on a revision newer than the current tab', async () => {
    const applied = validData({ updatedAt: 20 });
    const newerRestart = validData({ updatedAt: 30, monthlyHousingWon: 1_100_000 });

    const state = await bootstrapMain(repository(
      { status: 'current', data: applied, original: applied },
      { kind: 'restart', step: 'housing', draft: newerRestart },
    ));

    expect(state).toMatchObject({
      mode: 'setup',
      setupStep: 'housing',
      applied,
      draft: newerRestart,
    });
  });

  it('keeps current data applied while presenting a pending v2 draft for recovery', async () => {
    const current = validData({ monthlyNetIncomeWon: 3_000_000 });
    const pending = validData({ monthlyNetIncomeWon: 4_000_000 });

    const state = await bootstrapMain(repository({
      status: 'recovery',
      current,
      data: pending,
      original: {},
      source: 'pending',
    }));

    expect(state.mode).toBe('recovery');
    expect(state.applied).toEqual(current);
    expect(state.draft).toEqual(pending);
    expect(state.dirty).toBe(true);
  });

  it('presents a pending-only v2 recovery candidate without inventing applied data', async () => {
    const pending = validData();

    const state = await bootstrapMain(repository({
      status: 'recovery',
      current: null,
      data: pending,
      original: {},
      source: 'pending',
    }));

    expect(state).toMatchObject({ mode: 'recovery', applied: null, draft: pending, dirty: true });
  });

  it('enters recovery and retains malformed v2 data from a failed load', async () => {
    const original = { schemaVersion: 2, monthlyNetIncomeWon: 'bad' };
    const state = await bootstrapMain(repository({
      status: 'failed',
      data: null,
      original,
      reason: 'Stored Main v2 data has an unsupported shape.',
    }));

    expect(state.mode).toBe('recovery');
    expect(state.applied).toBeNull();
    expect(state.loadError).toMatchObject({
      message: 'Stored Main v2 data has an unsupported shape.',
      original,
    });
  });
});

describe('applyDraft', () => {
  it('returns the persisted v2 draft and recalculates its cashflow summary after saving', async () => {
    const draft = validData();
    const persisted = { ...draft, updatedAt: 1_750_000_000_000 };
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
        housingWon: 900_000,
        livingWon: 700_000,
        consumptionWon: 1_600_000,
        savingWon: 500_000,
        investmentWon: 400_000,
        plannedOutflowWon: 2_500_000,
        remainingWon: 500_000,
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
    const draft = validData({ monthlyNetIncomeWon: 4_000_000 });
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.save = async () => { throw new Error('quota exceeded'); };
    const state: MainState = {
      mode: 'dashboard', applied, draft, setupStep: null, dirty: true, saveStatus: 'idle', loadError: null,
    };

    await expect(applyDraft(state, storage)).resolves.toMatchObject({ ok: false, kind: 'storage' });
    expect(state.applied).toBe(applied);
    expect(state.applied?.monthlyNetIncomeWon).toBe(3_000_000);
  });
});
