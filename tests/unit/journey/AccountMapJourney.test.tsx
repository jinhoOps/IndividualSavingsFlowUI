import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { salaryLivingBrokerageFixture } from '../account-map/accountFlowTestSupport';
import type { MainData } from '../../../src/main/domain/model';
import type { MainRepository } from '../../../src/main/infrastructure/mainRepository';
import { AccountMapJourney } from '../../../src/journey/ui/AccountMapJourney';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

vi.mock('../../../src/account-map/ui/motion', () => ({
  animateFocusedFlow: () => ({ cancel() {} }),
  animateNodeToModal: (_source: DOMRect, _modal: HTMLElement, options: { onComplete(): void }) => { options.onComplete(); return { cancel() {} }; },
  animateModalToNode: (_modal: HTMLElement, _source: DOMRect, options: { onComplete(): void }) => { options.onComplete(); return { cancel() {} }; },
  animateConnectionDetail: () => ({ cancel() {} }),
  animateSetupStep: () => ({ cancel() {} }),
  setSetupStepFinalState: () => undefined,
}));

afterEach(() => {
  cleanup();
  window.history.replaceState(null, '', '/account-map');
});

describe('AccountMapJourney', () => {
  it('keeps the real Account Map mounted but inert while Main saves, then reloads a map-level confirmation without an Account Map write', async () => {
    const setup = repositoriesWithStaleMain();
    render(<AccountMapJourney repositories={setup.repositories} mainRepository={setup.mainRepository} />);
    const trigger = screen.getByRole('button', { name: 'Main 금액 수정' });
    fireEvent.click(trigger);

    const background = screen.getByTestId('account-map-journey-background');
    await screen.findByRole('dialog', { name: '월 자금 계획 편집' });
    await waitFor(() => expect(background).toHaveAttribute('inert'));
    expect(background).toHaveAttribute('aria-hidden', 'true');
    fireEvent.change(screen.getByLabelText('월평균 생활비'), { target: { value: '1200000' } });
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    window.history.replaceState(null, '', '/account-map');
    window.dispatchEvent(new PopStateEvent('popstate'));

    await waitFor(() => expect(setup.mainSave).toHaveBeenCalledOnce());
    await waitFor(() => expect(background).not.toHaveAttribute('inert'));
    expect(screen.getByRole('status')).toHaveTextContent('확인 필요');
    expect(screen.getByRole('status')).toHaveTextContent('Main 기준이 바뀌었어요. 흐름을 확인해 주세요.');
    expect(setup.accountMapSave).not.toHaveBeenCalled();
  });
});

function repositoriesWithStaleMain(): {
  repositories: { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository };
  mainRepository: MainRepository;
  mainSave: ReturnType<typeof vi.fn>;
  accountMapSave: ReturnType<typeof vi.fn>;
} {
  const fixture = salaryLivingBrokerageFixture();
  let workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.updatedAt = 10;
  workspace.main.applied = { ...fixture.main, updatedAt: 20 };
  workspace.locations = structuredClone(fixture.locations);
  workspace.accountMap.applied = { ...structuredClone(fixture.applied), sourceMainUpdatedAt: 1 };
  const accountMapSave = vi.fn(async (revision: number, command: Parameters<AccountMapRepository['save']>[1]) => {
    const saved = applyAccountMapCommand(workspace, command, 50);
    if (!saved.ok) return { status: 'rejected' as const, reason: saved.reason };
    workspace = { ...saved.workspace, revision: revision + 1 };
    return { status: 'saved' as const, workspace };
  });
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save: accountMapSave,
    saveIntent: vi.fn(),
    migrate: vi.fn(),
    reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = {
    load: vi.fn(() => ({ status: 'found' as const, data: structuredClone(workspace.main.applied!) })),
  };
  const mainSave = vi.fn(async (data: MainData) => {
    const saved = { ...data, updatedAt: 21 };
    workspace = { ...workspace, revision: 2, main: { ...workspace.main, applied: saved } };
    return saved;
  });
  const mainRepository: MainRepository = {
    load: vi.fn(async () => ({ status: 'current' as const, data: structuredClone(workspace.main.applied!), original: workspace.main.applied })),
    save: mainSave,
    saveSetupProgress: vi.fn(async () => undefined),
    loadSetupProgress: vi.fn(() => null),
    clearSetupProgress: vi.fn(async () => undefined),
    resetInvalidWorkspace: vi.fn(async () => undefined),
  };
  return { repositories: { accountMap, main }, mainRepository, mainSave, accountMapSave };
}
