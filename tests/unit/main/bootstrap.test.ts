import { describe, expect, it } from 'vitest';
import { bootstrapMain } from '../../../src/main/application/bootstrap';
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
    saveSetupProgress: async () => undefined,
    loadSetupProgress: () => progress,
    clearSetupProgress: async () => undefined,
    resetInvalidWorkspace: async () => undefined,
    saveCalls,
  };
}

describe('bootstrapMain', () => {
  it('starts a new setup at welcome when no data or setup progress exists', async () => {
    const result = await bootstrapMain(repository({ status: 'empty', data: null, original: null }));

    expect(result.state).toMatchObject({ mode: 'setup', setupStep: 'welcome', applied: null, dirty: false });
    expect(result.state.draft).toEqual(createEmptyMainData());
  });

  it('resumes each persisted v2 setup stage and keeps a detached draft', async () => {
    const draft = validData();

    for (const step of ['income', 'housing', 'living', 'saving-investment', 'review'] as const) {
      const result = await bootstrapMain(repository(
        { status: 'empty', data: null, original: null },
        { kind: 'initial', step, draft, savedAt: 10 },
      ));

      expect(result.state).toMatchObject({ mode: 'setup', setupStep: step, applied: null, dirty: false });
      expect(result.state.draft).toEqual(draft);
      expect(result.state.draft).not.toBe(draft);
    }
  });

  it('opens current v2 data on the dashboard', async () => {
    const data = validData();

    const result = await bootstrapMain(repository({ status: 'current', data, original: {} }));

    expect(result.state).toMatchObject({ mode: 'dashboard', applied: data, setupStep: null, dirty: false });
    expect(result.state.draft).toEqual(data);
    expect(result.state.draft).not.toBe(data);
  });

  it('resumes restart setup with the persisted current plan still applied', async () => {
    const applied = validData();
    const restartDraft = validData({ monthlyHousingWon: 1_100_000 });
    const result = await bootstrapMain(repository(
      { status: 'current', data: applied, original: applied },
      { kind: 'restart', step: 'housing', draft: restartDraft, savedAt: 10 },
    ));

    expect(result.state).toMatchObject({
      mode: 'setup',
      setupStep: 'housing',
      applied,
      draft: restartDraft,
    });
    expect(result.state.applied).not.toBe(applied);
    expect(result.state.draft).not.toBe(restartDraft);
  });

  it('ignores restart progress superseded by a newer applied revision', async () => {
    const applied = validData({ updatedAt: 20 });
    const staleRestart = validData({ updatedAt: 10, monthlyHousingWon: 1_100_000 });

    const result = await bootstrapMain(repository(
      { status: 'current', data: applied, original: applied },
      { kind: 'restart', step: 'housing', draft: staleRestart, savedAt: 10 },
    ));

    expect(result.state).toMatchObject({
      mode: 'dashboard',
      setupStep: null,
      applied,
      draft: applied,
    });
  });

  it('resumes restart progress based on a revision newer than the current tab', async () => {
    const applied = validData({ updatedAt: 20 });
    const newerRestart = validData({ updatedAt: 30, monthlyHousingWon: 1_100_000 });

    const result = await bootstrapMain(repository(
      { status: 'current', data: applied, original: applied },
      { kind: 'restart', step: 'housing', draft: newerRestart, savedAt: 30 },
    ));

    expect(result.state).toMatchObject({
      mode: 'setup',
      setupStep: 'housing',
      applied,
      draft: newerRestart,
    });
  });

  it('keeps current data applied while presenting a pending v2 draft for recovery', async () => {
    const current = validData({ monthlyNetIncomeWon: 3_000_000 });
    const pending = validData({ monthlyNetIncomeWon: 4_000_000 });

    const result = await bootstrapMain(repository({
      status: 'recovery',
      current,
      data: pending,
      original: {},
      source: 'pending',
    }));

    expect(result.state.mode).toBe('recovery');
    expect(result.state.applied).toEqual(current);
    expect(result.state.draft).toEqual(pending);
    expect(result.state.dirty).toBe(true);
  });

  it('resumes setup progress saved after a recovery revision', async () => {
    const current = validData({ updatedAt: 10 });
    const recovery = validData({ updatedAt: 20 });
    const progressDraft = validData({ updatedAt: 10, monthlyLivingWon: 1_100_000 });

    const result = await bootstrapMain(repository(
      { status: 'recovery', current, data: recovery, original: recovery, source: 'history' },
      { kind: 'restart', step: 'living', draft: progressDraft, savedAt: 30 },
    ));

    expect(result.state).toMatchObject({
      mode: 'setup',
      setupStep: 'living',
      applied: current,
      draft: progressDraft,
    });
  });

  it('presents a pending-only v2 recovery candidate without inventing applied data', async () => {
    const pending = validData();

    const result = await bootstrapMain(repository({
      status: 'recovery',
      current: null,
      data: pending,
      original: {},
      source: 'pending',
    }));

    expect(result.state).toMatchObject({ mode: 'recovery', applied: null, draft: pending, dirty: true });
  });

  it('enters recovery and retains malformed v2 data from a failed load', async () => {
    const original = { schemaVersion: 2, monthlyNetIncomeWon: 'bad' };
    const result = await bootstrapMain(repository({
      status: 'failed',
      data: null,
      original,
      reason: 'Stored Main v2 data has an unsupported shape.',
    }));

    expect(result.state.mode).toBe('recovery');
    expect(result.state.applied).toBeNull();
    expect(result.state.loadError).toMatchObject({
      message: 'Stored Main v2 data has an unsupported shape.',
      original,
    });
  });

  it.each([
    [
      'empty without progress',
      { status: 'empty', data: null, original: null } as const,
      null,
      'fresh',
    ],
    [
      'empty with initial welcome progress',
      { status: 'empty', data: null, original: null } as const,
      { kind: 'initial', step: 'welcome', draft: validData(), savedAt: 10 } as const,
      'resume',
    ],
    [
      'current dashboard',
      { status: 'current', data: validData(), original: null } as const,
      null,
      'none',
    ],
    [
      'current with restart progress',
      { status: 'current', data: validData({ updatedAt: 10 }), original: null } as const,
      { kind: 'restart', step: 'welcome', draft: validData({ updatedAt: 10 }), savedAt: 10 } as const,
      'resume',
    ],
    [
      'recovery with later progress',
      {
        status: 'recovery',
        current: validData({ updatedAt: 10 }),
        data: validData({ updatedAt: 20 }),
        original: null,
        source: 'history',
      } as const,
      { kind: 'restart', step: 'living', draft: validData({ updatedAt: 10 }), savedAt: 30 } as const,
      'resume',
    ],
    [
      'failed load',
      {
        status: 'failed',
        data: null,
        original: null,
        reason: 'Stored Main v2 data has an unsupported shape.',
      } as const,
      null,
      'none',
    ],
  ])('%s yields %s', async (_name, loaded, progress, expected) => {
    await expect(bootstrapMain(repository(loaded, progress))).resolves.toMatchObject({
      introEntryReason: expected,
    });
  });
});
