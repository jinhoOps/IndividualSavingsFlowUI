import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

afterEach(cleanup);

describe('AccountMapApp', () => {
  it('gates setup when Main has no applied plan', () => {
    render(<AccountMapApp repositories={repositories({ mainStatus: 'empty' })} />);
    expect(screen.getByRole('heading', { name: '월 자금 계획이 먼저 필요해요' })).toBeVisible();
    expect(screen.getByRole('link', { name: '월 자금 계획 만들기' })).toBeVisible();
  });

  it('uses purpose-first copy without source or destination terminology', () => {
    render(<AccountMapApp repositories={repositories()} />);
    expect(screen.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '수입' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: '연결' })).toHaveLength(5);
    expect(screen.queryByText(/source|destination|출발|도착/i)).not.toBeInTheDocument();
  });

  it('resumes review and warns when Main changed after the draft', () => {
    const setup = repositories({ draftSourceUpdatedAt: 5 });
    render(<AccountMapApp repositories={setup} />);
    expect(screen.getByText('Main의 월 금액이 바뀌었어요')).toBeVisible();
    expect(screen.getByRole('heading', { name: '연결 검토' })).toBeVisible();
  });

  it('shows unavailable storage without replacing user state with setup', () => {
    const accountMap: AccountMapRepository = {
      load: vi.fn(() => ({ status: 'unavailable' as const })),
      save: vi.fn(), saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
    };
    const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'unavailable' as const })) };
    render(<AccountMapApp repositories={{ accountMap, main }} />);
    expect(screen.getByRole('heading', { name: '저장소를 불러오지 못했어요' })).toBeVisible();
  });

  it('reloads a stale setup save but waits for explicit replay before writing latest', async () => {
    const setup = staleSetupRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    const selected = screen.getByRole('button', { name: /급여통장/ });
    fireEvent.click(selected);
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: '수입 연결' })).toBeVisible();
    expect(selected).toHaveClass('is-selected');
    expect(setup.saveIntent).toHaveBeenCalledTimes(1);
    expect(setup.save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '최신 상태에서 다시 적용' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledWith(2, expect.objectContaining({
      type: 'connect-location', purposeId: 'system:income', locationId: 'salary',
    })));
    expect(screen.queryByRole('dialog', { name: '수입 연결' })).not.toBeInTheDocument();
    expect(within(incomeCard).getByRole('button', { name: '다른 계좌 연결' })).toBeVisible();
  });

  it('recovers the first stale setup connection explicitly without replacing its input', async () => {
    const setup = staleFreshSetupRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    const selected = screen.getByRole('button', { name: /급여통장/ });
    fireEvent.click(selected);
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    const replay = await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });
    expect(screen.getByRole('dialog', { name: '수입 연결' })).toBeVisible();
    expect(selected).toHaveClass('is-selected');
    expect(setup.save).toHaveBeenCalledTimes(1);
    expect(setup.saveIntent).not.toHaveBeenCalled();

    fireEvent.click(replay);

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(3));
    expect(setup.save.mock.calls[1]).toEqual([2, expect.objectContaining({ type: 'save-draft' })]);
    expect(setup.save.mock.calls[2]).toEqual([3, expect.objectContaining({
      type: 'connect-location', purposeId: 'system:income', locationId: 'salary',
    })]);
    expect(screen.queryByRole('dialog', { name: '수입 연결' })).not.toBeInTheDocument();
  });

  it('does not initialize a hidden draft when fresh replay finds a latest applied map', async () => {
    const setup = staleFreshSetupRepositories(true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' }));

    expect(await screen.findByText(/편집 대상이 최신 상태에 없습니다/)).toBeVisible();
    expect(setup.save).toHaveBeenCalledTimes(1);
  });

  it('routes stale connection prerequisites to manual review instead of generic failure', async () => {
    const setup = stalePrerequisiteRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: '새 계좌·보관처 추가' }));
    fireEvent.click(screen.getByRole('button', { name: 'KB국민은행' }));
    fireEvent.change(screen.getByRole('textbox', { name: '표시 이름' }), { target: { value: '급여통장' } });
    fireEvent.click(screen.getByRole('button', { name: '기존 항목 복원해서 연결' }));

    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: '수입 연결' })).toBeVisible();
    expect(screen.queryByText('저장하지 못했어요. 입력은 그대로 두었습니다.')).not.toBeInTheDocument();
    expect(setup.save).toHaveBeenCalledTimes(1);
  });

  it('keeps exact initialized revision when fresh replay later collides', async () => {
    const setup = staleFreshSetupRepositories(false, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const incomeCard = screen.getByRole('heading', { name: '수입' }).closest('article')!;
    fireEvent.click(within(incomeCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));
    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' }));
    expect(await screen.findByText(/편집 대상이 최신 상태에 없습니다/)).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '최신 값 유지' }));
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(4));
    expect(setup.save.mock.calls[3]?.[0]).toBe(3);
  });

  it('shows stale layout recovery on the map surface without auto-replaying', async () => {
    const setup = staleLayoutRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '계좌 중심' }));

    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible();
    expect(screen.queryByText(/저장하지 못했습니다/)).not.toBeInTheDocument();
    expect(setup.save).toHaveBeenCalledTimes(1);
    const purposeLayout = screen.getByRole('button', { name: '목적 중심' });
    expect(purposeLayout).toBeDisabled();
    fireEvent.click(purposeLayout);
    expect(setup.save).toHaveBeenCalledTimes(1);
  });

  it('blocks setup mutation actions until a cancellation conflict is resolved', async () => {
    const setup = staleDraftRepositories();
    const reset = vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 }));
    setup.repositories.accountMap.reset = reset;
    render(<AccountMapApp repositories={setup.repositories} />);

    fireEvent.click(screen.getByRole('button', { name: '설정 취소' }));
    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible();

    const cancelSetup = screen.getByRole('button', { name: '설정 취소' });
    const review = screen.getByRole('button', { name: '검토' });
    const addPurpose = screen.getByRole('button', { name: '세부 목적 추가' });
    expect(cancelSetup).toBeDisabled();
    expect(review).toBeDisabled();
    expect(addPurpose).toBeDisabled();
    for (const connect of screen.getAllByRole('button', { name: '연결' })) expect(connect).toBeDisabled();
    fireEvent.click(cancelSetup);
    fireEvent.click(review);
    fireEvent.click(addPurpose);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: '월 자금의 위치를 알려주세요' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: '세부 목적 추가' })).not.toBeInTheDocument();
  });

  it('shows reset conflict on the map surface without a generic management failure', async () => {
    const setup = staleLayoutRepositories();
    setup.repositories.accountMap.reset = vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 }));
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '월 연결 다시 만들기' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 만들기' }));

    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible();
    expect(screen.queryByText('초기화하지 못했습니다. 현재 지도는 유지됩니다.')).not.toBeInTheDocument();
  });

  it('keeps custom-purpose input in its dialog after a stale draft save', async () => {
    const setup = staleDraftRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    const name = screen.getByRole('textbox', { name: '목적 이름' });
    fireEvent.change(name, { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: '세부 목적 추가' })).toBeVisible();
    expect(name).toHaveValue('여행');
    expect(screen.queryByText('저장하지 못했어요. 입력은 그대로 두었습니다.')).not.toBeInTheDocument();

    const cancel = screen.getByRole('button', { name: '취소' });
    expect(cancel).toBeDisabled();
    fireEvent.click(cancel);
    expect(screen.getByRole('dialog', { name: '세부 목적 추가' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '최신 상태에서 다시 검토' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '최신 상태에서 다시 검토' })).not.toBeInTheDocument());
    expect(name).toHaveValue('여행');
    expect(cancel).toBeEnabled();
  });

  it('explicitly keeps latest and closes custom-purpose recovery without orphaning it', async () => {
    const setup = staleDraftRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    await screen.findByRole('button', { name: '최신 값 유지' });

    fireEvent.click(screen.getByRole('button', { name: '최신 값 유지' }));

    expect(screen.queryByRole('dialog', { name: '세부 목적 추가' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 검토' })).not.toBeInTheDocument();
  });

  it('keeps modal edits and waits for explicit replay of a stale field intent', async () => {
    const setup = staleModalRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const livingNode = screen.getByRole('button', { name: /생활비 · 1,000,000원/ });
    fireEvent.click(livingNode);
    fireEvent.click(livingNode);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    const amount = screen.getByRole('textbox', { name: '생활비통장 월 금액' });
    fireEvent.change(amount, { target: { value: '650000' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    const replay = await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });
    expect(amount).toHaveValue('650000');
    expect(setup.saveIntent).toHaveBeenCalledTimes(1);
    expect(setup.save).not.toHaveBeenCalled();

    fireEvent.click(replay);

    await waitFor(() => expect(setup.save).toHaveBeenCalledWith(2, {
      type: 'edit-link', linkId: 'living-link', fields: { monthlyAmountWon: 650_000 },
    }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /생활비 편집/ })).not.toBeInTheDocument());
  });

  it('keeps compound modal input for latest review and never snapshot-replays it automatically', async () => {
    const setup = staleCompoundModalRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const locationNode = screen.getByRole('button', { name: '생활비통장' });
    fireEvent.click(locationNode);
    fireEvent.click(locationNode);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    const label = screen.getByRole('textbox', { name: '표시 이름' });
    const amount = screen.getByRole('textbox', { name: '생활비 월 금액' });
    fireEvent.change(label, { target: { value: '새생활비' } });
    fireEvent.change(amount, { target: { value: '650000' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible();
    expect(label).toHaveValue('새생활비');
    expect(amount).toHaveValue('650000');
    expect(setup.save).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 적용' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '최신 상태에서 다시 검토' }));
    expect(setup.save).toHaveBeenCalledTimes(1);
    expect(label).toHaveValue('새생활비');
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(2));
    expect(setup.save.mock.calls[1]?.[0]).toBe(2);
  });

  it('keeps typed compound modal input when latest moved back to setup', async () => {
    const setup = staleCompoundModalRepositories(true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const locationNode = screen.getByRole('button', { name: '생활비통장' });
    fireEvent.click(locationNode);
    fireEvent.click(locationNode);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    const label = screen.getByRole('textbox', { name: '표시 이름' });
    const amount = screen.getByRole('textbox', { name: '생활비 월 금액' });
    fireEvent.change(label, { target: { value: '새생활비' } });
    fireEvent.change(amount, { target: { value: '650000' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' }));

    expect(screen.getByRole('dialog')).toBeVisible();
    expect(label).toHaveValue('새생활비');
    expect(amount).toHaveValue('650000');
    expect(screen.getByText(/편집 대상이 최신 상태에 없습니다/)).toBeVisible();
  });

  it('keeps archive replacement input when its latest remainder target disappeared', async () => {
    const setup = staleArchiveRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const locationNode = screen.getByRole('button', { name: '생활비통장' });
    fireEvent.click(locationNode);
    fireEvent.click(locationNode);
    fireEvent.click(screen.getByRole('button', { name: '보관' }));
    const replacement = screen.getByRole('combobox', { name: '새 나머지 계좌' });
    fireEvent.change(replacement, { target: { value: 'backup-link' } });
    fireEvent.click(screen.getByRole('button', { name: '보관하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 검토' }));

    expect(screen.getByRole('dialog', { name: /생활비통장 보관/ })).toBeVisible();
    expect(replacement).toHaveValue('backup-link');
    expect(screen.getByText(/편집 대상이 최신 상태에 없습니다/)).toBeVisible();
  });

});

function staleArchiveRepositories() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.locations = [
    { id: 'checking', shortName: '생활비통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
    { id: 'backup', shortName: '비상통장', institution: { id: 'hana', name: '하나은행' }, kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
  ];
  initial.accountMap.applied = {
    schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [],
    links: [
      { id: 'living-link', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
      { id: 'backup-link', purposeId: 'system:living', locationId: 'backup', monthlyAmountWon: 300_000, remainder: false, status: 'active', createdAt: 1, updatedAt: 1 },
    ],
    layout: 'purpose', setupCompletedAt: 1, updatedAt: 1,
  };
  const latest = structuredClone(initial);
  latest.revision = 2;
  latest.accountMap.applied!.links = latest.accountMap.applied!.links.filter(({ id }) => id !== 'backup-link');
  const accountMap: AccountMapRepository = {
    load: vi.fn().mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false }).mockReturnValue({ status: 'found' as const, workspace: latest, needsMigration: false }),
    save: vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 })),
    saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main } };
}

function staleCompoundModalRepositories(latestWithoutApplied = false) {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.locations = [{ id: 'checking', shortName: '생활비통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 }];
  initial.accountMap.applied = {
    schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [],
    links: [{ id: 'living-link', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 }],
    layout: 'purpose', setupCompletedAt: 1, updatedAt: 1,
  };
  const latest: WorkspaceDocument = { ...structuredClone(initial), revision: 2, updatedAt: 2 };
  if (latestWithoutApplied) {
    latest.accountMap.applied = null;
    latest.accountMap.draft = { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 2 };
  }
  const load = vi.fn()
    .mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false })
    .mockImplementation(() => ({ status: 'found' as const, workspace: latest, needsMigration: false }));
  const save = vi.fn(async (revision, command) => {
    if (revision === 1) return { status: 'conflict' as const, currentRevision: 2 };
    const result = applyAccountMapCommand(latest, command, 3);
    if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
    return { status: 'saved' as const, workspace: { ...result.workspace, revision: 3 } };
  });
  const accountMap: AccountMapRepository = { load, save, saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn() };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save };
}

function staleModalRepositories() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.locations = [{ id: 'checking', shortName: '생활비통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 }];
  initial.accountMap.applied = {
    schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [],
    links: [{ id: 'living-link', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 }],
    layout: 'purpose', setupCompletedAt: 1, updatedAt: 1,
  };
  const latest: WorkspaceDocument = { ...structuredClone(initial), revision: 2, updatedAt: 2 };
  const load = vi.fn()
    .mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false })
    .mockImplementation(() => ({ status: 'found' as const, workspace: latest, needsMigration: false }));
  const saveIntent = vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 }));
  const save = vi.fn(async (revision, command) => {
    const workspace = structuredClone(latest);
    workspace.revision = revision + 1;
    workspace.updatedAt = 3;
    const amount = command.type === 'edit-link' ? command.fields.monthlyAmountWon : undefined;
    if (amount !== undefined) workspace.accountMap.applied!.links[0]!.monthlyAmountWon = amount;
    return { status: 'saved' as const, workspace };
  });
  const accountMap: AccountMapRepository = { load, save, saveIntent, migrate: vi.fn(), reset: vi.fn() };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save, saveIntent };
}

function staleSetupRepositories() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.locations = [{
    id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' },
    kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1,
  }];
  initial.accountMap.draft = {
    schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 1,
  };
  let current: WorkspaceDocument = initial;
  const latest: WorkspaceDocument = { ...structuredClone(initial), revision: 2, updatedAt: 2 };
  const load = vi.fn()
    .mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false })
    .mockImplementation(() => ({ status: 'found' as const, workspace: latest, needsMigration: false }));
  const saveIntent = vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 }));
  const save = vi.fn(async (revision, command) => {
    const result = applyAccountMapCommand(latest, command, 3);
    if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
    current = { ...result.workspace, revision: revision + 1, updatedAt: 3 };
    return { status: 'saved' as const, workspace: current };
  });
  const accountMap: AccountMapRepository = {
    load, save, saveIntent, migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = {
    load: vi.fn(() => ({ status: 'found' as const, data: mainData() })),
  };
  return { repositories: { accountMap, main }, save, saveIntent, current: () => current };
}

function staleFreshSetupRepositories(latestHasApplied = false, rejectAfterInitialize = false) {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.locations = [{
    id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' },
    kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1,
  }];
  const latest: WorkspaceDocument = { ...structuredClone(initial), revision: 2, updatedAt: 2 };
  if (latestHasApplied) latest.accountMap.applied = {
    schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], layout: 'purpose', setupCompletedAt: 2, updatedAt: 2,
  };
  let current = latest;
  const load = vi.fn()
    .mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false })
    .mockImplementation(() => ({ status: 'found' as const, workspace: latest, needsMigration: false }));
  const save = vi.fn(async (revision, command) => {
    if (revision === 1) return { status: 'conflict' as const, currentRevision: 2 };
    if (revision === 3 && command.type === 'connect-location' && rejectAfterInitialize) return { status: 'rejected' as const, reason: 'target-missing' as const };
    const result = applyAccountMapCommand(current, command, revision + 1);
    if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
    current = { ...result.workspace, revision: revision + 1, updatedAt: revision + 1 };
    return { status: 'saved' as const, workspace: current };
  });
  const saveIntent = vi.fn();
  const accountMap: AccountMapRepository = { load, save, saveIntent, migrate: vi.fn(), reset: vi.fn() };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save, saveIntent };
}

function staleLayoutRepositories() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.accountMap.applied = { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], layout: 'purpose', setupCompletedAt: 1, updatedAt: 1 };
  const latest = structuredClone(initial);
  latest.revision = 2;
  const load = vi.fn().mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false }).mockReturnValue({ status: 'found' as const, workspace: latest, needsMigration: false });
  const save = vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 }));
  const accountMap: AccountMapRepository = { load, save, saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn() };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save };
}

function staleDraftRepositories() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.accountMap.draft = { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 1 };
  const latest = structuredClone(initial);
  latest.revision = 2;
  const load = vi.fn().mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false }).mockReturnValue({ status: 'found' as const, workspace: latest, needsMigration: false });
  const accountMap: AccountMapRepository = { load, save: vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 })), saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn() };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main } };
}

function stalePrerequisiteRepositories() {
  const initial = createEmptyWorkspace(1);
  initial.revision = 1;
  initial.main.applied = mainData();
  initial.locations = [{ id: 'checking', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['income'], archivedAt: 2, createdAt: 1, updatedAt: 2 }];
  initial.accountMap.draft = { schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [], links: [], step: 'connect', updatedAt: 1 };
  const latest: WorkspaceDocument = { ...structuredClone(initial), revision: 2, updatedAt: 2 };
  const load = vi.fn()
    .mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false })
    .mockReturnValue({ status: 'found' as const, workspace: latest, needsMigration: false });
  const save = vi.fn(async () => ({ status: 'conflict' as const, currentRevision: 2 }));
  const accountMap: AccountMapRepository = { load, save, saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn() };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save };
}

function repositories(options: { mainStatus?: 'found' | 'empty'; draftSourceUpdatedAt?: number } = {}) {
  const workspace = createEmptyWorkspace(1);
  const appliedMain = mainData();
  workspace.main.applied = appliedMain;
  if (options.draftSourceUpdatedAt !== undefined) {
    workspace.accountMap.draft = { schemaVersion: 1, sourceMainUpdatedAt: options.draftSourceUpdatedAt, customPurposes: [], links: [], step: 'review', updatedAt: 5 };
  }
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save: vi.fn(), saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = {
    load: vi.fn(() => options.mainStatus === 'empty'
      ? { status: 'empty' as const }
      : { status: 'found' as const, data: appliedMain }),
  };
  return { accountMap, main };
}

function mainData() {
  return { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}
