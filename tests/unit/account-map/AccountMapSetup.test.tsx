import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import { rebaseAccountMapIntent } from '../../../src/account-map/domain/editIntent';
import type { AccountMapRepository, AccountMapWriteResult } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

afterEach(cleanup);

describe('AccountMapSetup', () => {
  it('opens a focused account overlay with nine quick institutions and direct input', () => {
    render(<AccountMapApp repositories={fixture().repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));

    const dialog = screen.getByRole('dialog', { name: '수입 연결' });
    expect(within(dialog).getByRole('button', { name: '새 계좌·보관처 추가' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: '새 계좌·보관처 추가' }));
    for (const name of ['KB국민은행', '신한은행', '하나은행', '우리은행', 'NH농협은행', 'IBK기업은행', 'KDB산업은행', '토스뱅크', '카카오뱅크']) {
      expect(within(dialog).getByRole('button', { name })).toBeVisible();
    }
    expect(within(dialog).getByRole('button', { name: '직접 입력' })).toBeVisible();
  });

  it('connects an existing location at the full first-link amount', async () => {
    const setup = fixture(true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => expect(setup.current().accountMap.draft?.links[0]).toMatchObject({
      purposeId: 'system:income', monthlyAmountWon: 2_000_000, remainder: true,
    }));
    expect(within(incomeCard).getByRole('button', { name: '다른 계좌 연결' })).toBeVisible();
  });

  it('retains the overlay selection when saving fails', async () => {
    const setup = fixture(true, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    expect(await screen.findByText('저장하지 못했어요. 입력은 그대로 두었습니다.')).toBeVisible();
    expect(screen.getByRole('dialog', { name: '수입 연결' })).toBeVisible();
  });

  it('offers restore instead of creating a duplicate archived location', () => {
    const setup = fixture(false, false, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: '새 계좌·보관처 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'KB국민은행' }));
    fireEvent.change(screen.getByRole('textbox', { name: '표시 이름' }), { target: { value: '급여통장' } });
    expect(screen.getByText('보관된 같은 항목이 있어요.')).toBeVisible();
    expect(screen.getByRole('button', { name: '기존 항목 복원해서 연결' })).toBeVisible();
  });

  it('shows a saved custom purpose as a connectable card and persists review step', async () => {
    const setup = fixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    const customCard = await screen.findByRole('heading', { name: '여행' });
    expect(within(customCard.closest('article')!).getByRole('button', { name: '연결' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '검토' }));
    await waitFor(() => expect(setup.current().accountMap.draft?.step).toBe('review'));
    expect(screen.getByRole('heading', { name: '연결 검토' })).toBeVisible();
  });

  it('keeps setup input and focuses the described recovery action for a duplicate collision', async () => {
    const setup = staleDuplicateFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    const selected = screen.getByRole('button', { name: /급여통장/ });
    fireEvent.click(selected);
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    const replay = await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    fireEvent.click(replay);

    await waitFor(() => expect(replay).toHaveFocus());
    expect(replay).toHaveAccessibleDescription(/같은 연결이 이미 있습니다/);
    expect(selected).toHaveClass('is-selected');
    expect(screen.getByRole('dialog', { name: '수입 연결' })).toBeVisible();
  });

  it('abandons stale recovery and adopts latest when the conflicted dialog is cancelled', async () => {
    const setup = staleDuplicateFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    fireEvent.click(screen.getByRole('button', { name: '취소' }));

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '수입 연결' })).not.toBeInTheDocument());
    expect(within(incomeCard).getByRole('button', { name: '다른 계좌 연결' })).toBeVisible();
  });

  it('abandons stale recovery on Escape instead of leaking it into another dialog', async () => {
    const setup = staleDuplicateFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.click(screen.getByRole('heading', { name: '주거' }).closest('article')!.querySelector('button')!);

    expect(screen.getByRole('dialog', { name: '주거 연결' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 적용' })).not.toBeInTheDocument();
  });

  it('disables both recovery actions while replay is pending', async () => {
    const setup = stalePendingFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    const replay = await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    fireEvent.click(replay);

    expect(replay).toBeDisabled();
    expect(screen.getByRole('button', { name: '최신 값 유지' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '완료' })).toBeDisabled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: '수입 연결' })).toBeVisible();
  });
});

function stalePendingFixture() {
  const setup = staleDuplicateFixture();
  const accountMap = setup.repositories.accountMap;
  const load = accountMap.load as ReturnType<typeof vi.fn>;
  const initialLoad = accountMap.load();
  if (initialLoad.status !== 'found') throw new Error('fixture workspace required');
  const latest = structuredClone(initialLoad.workspace);
  latest.revision = 2;
  latest.accountMap.draft!.links = [];
  load.mockReset()
    .mockReturnValueOnce(initialLoad)
    .mockReturnValue({ status: 'found' as const, workspace: latest, needsMigration: false });
  accountMap.save = vi.fn(async () => await new Promise<AccountMapWriteResult>(() => undefined));
  return setup;
}

function staleDuplicateFixture() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  const mainData = { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
  initial.main.applied = mainData;
  initial.locations = [{ id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1 }];
  initial.accountMap.draft = { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 1 };
  const latest = structuredClone(initial);
  latest.revision = 2;
  latest.accountMap.draft!.links = [{ id: 'latest-link', purposeId: 'system:income', locationId: 'salary', monthlyAmountWon: 2_000_000, remainder: true, status: 'active', createdAt: 2, updatedAt: 2 }];
  const accountMap: AccountMapRepository = {
    load: vi.fn()
      .mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false })
      .mockReturnValue({ status: 'found' as const, workspace: latest, needsMigration: false }),
    saveIntent: vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 })),
    save: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData })) };
  return { repositories: { accountMap, main } };
}

function fixture(withLocation = false, failSave = false, archived = false) {
  let workspace = createEmptyWorkspace(1);
  const mainData = { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
  workspace.main.applied = mainData;
  if (withLocation || archived) workspace.locations = [{ id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['income'], ...(archived ? { archivedAt: 2 } : {}), createdAt: 1, updatedAt: 1 }];
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    migrate: vi.fn(), reset: vi.fn(),
    saveIntent: vi.fn(async (revision, intent) => {
      if (failSave) return { status: 'unavailable' as const };
      const rebased = rebaseAccountMapIntent(workspace, intent);
      if (!rebased.ok) return { status: 'rejected' as const, reason: rebased.reason, ...('field' in rebased ? { field: rebased.field } : {}) };
      const result = applyAccountMapCommand(workspace, rebased.command, 20);
      if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
      workspace = { ...result.workspace, revision: revision + 1, updatedAt: 20 };
      return { status: 'saved' as const, workspace };
    }),
    save: vi.fn(async (revision, command) => {
      if (failSave) return { status: 'unavailable' as const };
      const result = applyAccountMapCommand(workspace, command, 20);
      if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
      workspace = { ...result.workspace, revision: revision + 1, updatedAt: 20 };
      return { status: 'saved' as const, workspace };
    }),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData })) };
  return { repositories: { accountMap, main }, current: (): WorkspaceDocument => workspace };
}
