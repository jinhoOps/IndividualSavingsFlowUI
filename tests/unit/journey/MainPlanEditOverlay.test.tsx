import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountDraftContext } from '../../../src/auth/AccountDraftContext';
import type { MainData } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';
import { MainPlanEditOverlay } from '../../../src/journey/ui/MainPlanEditOverlay';
import { mainPlanOverlayHistoryToken } from '../../../src/journey/ui/mainPlanOverlayHistory';
import type { AccountWorkspaceSession } from '../../../src/workspace/infrastructure/accountWorkspaceSession';

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/account-map');
});

const plan: MainData = {
  schemaVersion: 2, updatedAt: 1, monthlyNetIncomeWon: 3_200_000, monthlyHousingWon: 800_000,
  monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000,
};

describe('MainPlanEditOverlay', () => {
  it('uses the Account Map Main recovery scope without automatically saving it', async () => {
    const repository: MainRepository = {
      load: vi.fn(async () => ({ status: 'current' as const, data: plan, original: plan })),
      save: vi.fn(async (data: MainData) => data), saveSetupProgress: vi.fn(async () => undefined),
      loadSetupProgress: vi.fn(() => null), clearSetupProgress: vi.fn(async () => undefined), resetInvalidWorkspace: vi.fn(async () => undefined),
    };
    const session = {
      readRecoveryDraft: (key: string) => key === 'account-map-main-overlay'
        ? { ...plan, monthlyLivingWon: 1_300_000 }
        : null,
      recordRecoveryDraft: vi.fn(),
    } as unknown as AccountWorkspaceSession;

    render(
      <AccountDraftContext.Provider value={session}>
        <MainPlanEditOverlay repository={repository} target="living" returnFocusElement={null} onActivated={() => undefined} onClosed={() => undefined} />
      </AccountDraftContext.Provider>,
    );

    expect(await screen.findByLabelText('월평균 생활비')).toHaveValue('1,300,000');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('preserves the overlay history marker when Back occurs during a pending save that fails', async () => {
    let rejectSave!: (reason: Error) => void;
    const pendingSave = new Promise<MainData>((_resolve, reject) => { rejectSave = reject; });
    const repository: MainRepository = {
      load: async () => ({ status: 'current', data: plan, original: plan }),
      save: () => pendingSave, saveSetupProgress: async () => undefined,
      loadSetupProgress: () => null, clearSetupProgress: async () => undefined, resetInvalidWorkspace: async () => undefined,
    };
    const onClosed = vi.fn();
    render(<MainPlanEditOverlay repository={repository} target="living" returnFocusElement={null} onActivated={() => undefined} onClosed={onClosed} />);
    const input = await screen.findByLabelText('월평균 생활비');
    fireEvent.change(input, { target: { value: '1200000' } });
    const token = mainPlanOverlayHistoryToken(window.history.state);
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(input).toBeDisabled());
    act(() => {
      window.history.replaceState(null, '', '/account-map');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(mainPlanOverlayHistoryToken(window.history.state)).toBe(token);
    await act(async () => { rejectSave(new Error('storage failed')); });
    expect(input).toHaveValue('1,200,000');
    expect(screen.getAllByRole('alert')[0]).toHaveTextContent('저장하지 못했습니다');
    expect(onClosed).not.toHaveBeenCalled();
  });

  it('keeps a named keyboard-dismissable dialog when loading Main fails', async () => {
    const repository: MainRepository = {
      load: async () => { throw new Error('storage unavailable'); },
      save: async (data) => data, saveSetupProgress: async () => undefined,
      loadSetupProgress: () => null, clearSetupProgress: async () => undefined, resetInvalidWorkspace: async () => undefined,
    };
    render(<MainPlanEditOverlay repository={repository} target="living" returnFocusElement={null} onActivated={() => undefined} onClosed={() => undefined} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('dialog', { name: '월 자금 계획 편집' })).toBeVisible();
    expect(screen.getByRole('button', { name: '편집기 닫기' })).toBeEnabled();
  });

  it('keeps a dirty editor open when Back discard is declined, then restores invoking focus after an accepted close', async () => {
    const repository: MainRepository = {
      load: vi.fn(async () => ({ status: 'current' as const, data: plan, original: plan })),
      save: vi.fn(async (data: MainData) => data), saveSetupProgress: vi.fn(async () => undefined),
      loadSetupProgress: vi.fn(() => null), clearSetupProgress: vi.fn(async () => undefined), resetInvalidWorkspace: vi.fn(async () => undefined),
    };
    const invokingButton = document.createElement('button');
    invokingButton.textContent = 'Main 금액 수정';
    document.body.append(invokingButton);
    const onActivated = vi.fn();
    const onClosed = vi.fn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<MainPlanEditOverlay repository={repository} target="living" returnFocusElement={invokingButton} onActivated={onActivated} onClosed={onClosed} />);

    const dialog = await screen.findByRole('dialog', { name: '월 자금 계획 편집' });
    expect(onActivated).toHaveBeenCalledOnce();
    fireEvent.change(await screen.findByLabelText('월평균 생활비'), { target: { value: '1200000' } });
    const apply = screen.getByRole('button', { name: '적용' });
    apply.focus();
    fireEvent.keyDown(apply, { key: 'Tab' });
    expect(screen.getByRole('button', { name: '편집기 닫기' })).toHaveFocus();
    // Browser Back has already selected the unmarked entry before popstate fires.
    window.history.replaceState(null, '', '/account-map');
    window.dispatchEvent(new PopStateEvent('popstate'));
    expect(confirm).toHaveBeenCalledOnce();
    expect(dialog).toBeVisible();

    confirm.mockReturnValue(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    window.history.replaceState(null, '', '/account-map');
    window.dispatchEvent(new PopStateEvent('popstate'));
    await waitFor(() => expect(onClosed).toHaveBeenCalledWith({ status: 'cancelled' }));
    expect(mainPlanOverlayHistoryToken(window.history.state)).toBeNull();
    expect(invokingButton).toHaveFocus();
    invokingButton.remove();
  });
});
