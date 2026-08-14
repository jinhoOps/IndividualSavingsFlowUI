import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { AccountMapSetup } from '../../../src/account-map/ui/AccountMapSetup';
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

  it('traps forward and reverse Tab inside the custom-purpose dialog', () => {
    render(<AccountMapApp repositories={fixture().repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    const parent = screen.getByRole('combobox', { name: '큰 목적' });
    const cancel = screen.getByRole('button', { name: '취소' });
    expect(parent).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(parent).toHaveFocus();
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

  it('abandons settled recovery and adopts latest when the conflicted dialog is cancelled', async () => {
    const setup = staleDuplicateFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    const cancel = screen.getByRole('button', { name: '취소' });
    expect(cancel).toBeEnabled();
    fireEvent.click(cancel);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '수입 연결' })).not.toBeInTheDocument());
    expect(within(incomeCard).getByRole('button', { name: '다른 계좌 연결' })).toBeVisible();
  });

  it('abandons settled recovery on Escape without leaking it into another dialog', async () => {
    const setup = staleDuplicateFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '수입 연결' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('heading', { name: '주거' }).closest('article')!.querySelector('button')!);

    expect(screen.getByRole('dialog', { name: '주거 연결' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 적용' })).not.toBeInTheDocument();
  });

  it('abandons settled connection recovery from its backdrop', async () => {
    const setup = staleDuplicateFixture();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });

    fireEvent.pointerDown(screen.getByRole('dialog', { name: '수입 연결' }).parentElement!);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '수입 연결' })).not.toBeInTheDocument());
    expect(within(incomeCard).getByRole('button', { name: '다른 계좌 연결' })).toBeVisible();
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

  it('keeps custom-purpose input mounted and blocks duplicate actions while its save is pending', () => {
    const setup = fixture();
    setup.repositories.accountMap.save = vi.fn(async () => await new Promise<AccountMapWriteResult>(() => undefined));
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    expect(screen.getByRole('button', { name: '추가' })).toBeDisabled();
    const cancel = screen.getByRole('button', { name: '취소' });
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(screen.getByRole('dialog', { name: '세부 목적 추가' }).parentElement!);
    expect(screen.getByRole('dialog', { name: '세부 목적 추가' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: '목적 이름' })).toHaveValue('여행');
  });

  it('keeps a rejected custom purpose in the dialog and focuses its described field error', async () => {
    const workspace = createEmptyWorkspace(1);
    const appliedMain = mainData();
    workspace.main.applied = appliedMain;
    const onSaveDraft = vi.fn(async () => ({
      status: 'field-error' as const,
      field: 'name' as const,
      message: '같은 큰 목적 안에 이미 같은 이름이 있습니다.',
    }));
    render(<AccountMapSetup
      workspace={workspace}
      main={appliedMain}
      draft={null}
      step="connect"
      mainChanged={false}
      saveFailed={false}
      recoveryPending={false}
      recovery={{ status: 'none' }}
      onReapply={async () => false}
      onKeepLatest={() => undefined}
      onCommitConnection={async () => false}
      onSaveDraft={onSaveDraft}
      onReview={() => undefined}
      onBack={() => undefined}
      onApply={() => undefined}
      onExit={() => undefined}
      onCancelSetup={() => undefined}
    />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    const name = screen.getByRole('textbox', { name: '목적 이름' });
    const amount = screen.getByRole('textbox', { name: '월 금액' });
    fireEvent.change(name, { target: { value: '여행' } });
    fireEvent.change(amount, { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    const dialog = await screen.findByRole('dialog', { name: '세부 목적 추가' });
    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent('같은 큰 목적 안에 이미 같은 이름이 있습니다.');
    expect(name).toHaveValue('여행');
    expect(amount).toHaveValue('100000');
    await waitFor(() => expect(name).toHaveFocus());
    expect(name).toHaveAccessibleDescription('같은 큰 목적 안에 이미 같은 이름이 있습니다.');
  });

  it('maps an app-level capacity rejection to the described amount field', async () => {
    const setup = fixture();
    setup.repositories.accountMap.save = vi.fn(async () => ({
      status: 'rejected' as const,
      reason: 'custom-target-capacity' as const,
    }));
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    const amount = screen.getByRole('textbox', { name: '월 금액' });
    fireEvent.change(amount, { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    const dialog = await screen.findByRole('dialog', { name: '세부 목적 추가' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('큰 목적의 월 금액을 넘을 수 없습니다.');
    await waitFor(() => expect(amount).toHaveFocus());
    expect(amount).toHaveAccessibleDescription('큰 목적의 월 금액을 넘을 수 없습니다.');
    expect(within(dialog).getByRole('textbox', { name: '목적 이름' })).toHaveValue('여행');
    expect(amount).toHaveValue('100000');
  });

  it('renders a storage failure inside the custom-purpose dialog and focuses the alert', async () => {
    const setup = fixture(false, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    const dialog = await screen.findByRole('dialog', { name: '세부 목적 추가' });
    const alert = within(dialog).getByRole('alert');
    expect(alert).toHaveTextContent('저장하지 못했어요. 입력은 그대로 두었습니다.');
    await waitFor(() => expect(alert).toHaveFocus());
    expect(within(dialog).getByRole('textbox', { name: '목적 이름' })).toHaveValue('여행');
    expect(within(dialog).getByRole('textbox', { name: '월 금액' })).toHaveValue('100000');
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
  accountMap.save = vi.fn(async (revision) => revision === 1
    ? { status: 'conflict' as const, currentRevision: 2 }
    : await new Promise<AccountMapWriteResult>(() => undefined));
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
    saveIntent: vi.fn(),
    save: vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 })), migrate: vi.fn(), reset: vi.fn(),
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

function mainData() {
  return { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}
