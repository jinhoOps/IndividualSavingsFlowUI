import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';
import { useMainPlanEditorController } from '../../../src/main/ui/useMainPlanEditorController';

afterEach(cleanup);

const plan: MainData = {
  schemaVersion: 2,
  updatedAt: 1,
  monthlyNetIncomeWon: 3_200_000,
  monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000,
  monthlySavingWon: 300_000,
  monthlyInvestmentWon: 200_000,
};

describe('useMainPlanEditorController', () => {
  it('saves only through the Main repository and keeps an invalid draft visible for correction', async () => {
    const save = vi.fn(async (next: MainData) => ({ ...next, updatedAt: 2 }));
    const repository: MainRepository = {
      load: vi.fn(async () => ({ status: 'current' as const, data: plan, original: plan })),
      save,
      saveSetupProgress: vi.fn(async () => undefined),
      loadSetupProgress: vi.fn(() => null),
      clearSetupProgress: vi.fn(async () => undefined),
      resetInvalidWorkspace: vi.fn(async () => undefined),
    };
    const { result } = renderHook(() => useMainPlanEditorController({ repository }));

    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => result.current.changeDraft({ ...plan, monthlyNetIncomeWon: 0 }));
    await act(async () => expect(await result.current.save()).toMatchObject({ status: 'validation-failed' }));
    expect(save).not.toHaveBeenCalled();
    expect(result.current.draft?.monthlyNetIncomeWon).toBe(0);

    act(() => result.current.changeDraft({ ...plan, monthlyNetIncomeWon: 4_000_000 }));
    await act(async () => expect(await result.current.save()).toMatchObject({ status: 'saved' }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ monthlyNetIncomeWon: 4_000_000 }));
  });
});
