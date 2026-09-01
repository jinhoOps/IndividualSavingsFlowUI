import { describe, expect, it, vi } from 'vitest';
import {
  resetInvalidMainWorkspace,
  saveMainDraft,
  setupStepForIssue,
} from '../../../src/main/application/mainSetupCommands';
import type { MainState } from '../../../src/main/application/mainReducer';
import { createEmptyMainData, type MainData } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';

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

function state(draft: MainData, applied: MainData | null = null): MainState {
  return {
    mode: applied === null ? 'setup' : 'dashboard',
    applied,
    draft,
    setupStep: applied === null ? 'review' : null,
    dirty: true,
    saveStatus: 'idle',
    loadError: null,
  };
}

describe('saveMainDraft', () => {
  it('returns the persisted v2 draft and recalculates its cashflow summary after saving', async () => {
    const draft = validData();
    const persisted = { ...draft, updatedAt: 1_750_000_000_000 };
    const save = vi.fn(async (_data: MainData) => persisted);
    const repository = { save } as unknown as MainRepository;

    await expect(saveMainDraft(state(draft), repository)).resolves.toEqual({
      status: 'saved',
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
    expect(save).toHaveBeenCalledWith({ ...draft });
    expect(save.mock.calls[0]?.[0]).not.toBe(draft);
  });

  it('returns validation issues without saving an invalid draft', async () => {
    const save = vi.fn();
    const repository = { save } as unknown as MainRepository;

    await expect(saveMainDraft(state(createEmptyMainData()), repository)).resolves.toEqual({
      status: 'validation-failed',
      issues: [{ path: 'monthlyNetIncomeWon', code: 'income_required' }],
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('normalizes a storage rejection without replacing the applied draft', async () => {
    const error = new Error('quota exceeded');
    const applied = validData();
    const repository = {
      save: vi.fn(async () => { throw error; }),
    } as unknown as MainRepository;
    const current = state(validData({ monthlyNetIncomeWon: 4_000_000 }), applied);

    await expect(saveMainDraft(current, repository)).resolves.toEqual({
      status: 'storage-failed',
      error,
    });
    expect(current.applied).toBe(applied);
    expect(current.applied?.monthlyNetIncomeWon).toBe(3_000_000);
  });
});

describe('resetInvalidMainWorkspace', () => {
  it('returns reset only after the exact invalid raw is reset', async () => {
    const resetInvalidWorkspace = vi.fn(async () => undefined);
    const repository = { resetInvalidWorkspace } as unknown as MainRepository;

    await expect(resetInvalidMainWorkspace('{broken', repository))
      .resolves.toEqual({ status: 'reset' });
    expect(resetInvalidWorkspace).toHaveBeenCalledWith('{broken');
  });

  it('normalizes an invalid reset rejection without widening the repository contract', async () => {
    const error = new Error('workspace changed');
    const repository = {
      resetInvalidWorkspace: vi.fn(async () => { throw error; }),
    } as unknown as MainRepository;

    await expect(resetInvalidMainWorkspace('{broken', repository))
      .resolves.toEqual({ status: 'failed', error });
  });
});

describe('setupStepForIssue', () => {
  it.each([
    ['monthlyNetIncomeWon', 'income'],
    ['monthlyHousingWon', 'housing'],
    ['monthlyLivingWon', 'living'],
    ['monthlySavingWon', 'saving-investment'],
    ['monthlyInvestmentWon', 'saving-investment'],
    [undefined, null],
    ['unknown', null],
  ] as const)('maps validation path %s to %s', (path, expected) => {
    expect(setupStepForIssue(path)).toBe(expected);
  });
});
