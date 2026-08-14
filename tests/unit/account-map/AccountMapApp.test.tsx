import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

const appMotion = vi.hoisted(() => ({
  deferClose: false,
  closeStarts: 0,
  closeComplete: null as (() => void) | null,
}));

vi.mock('../../../src/account-map/ui/motion', () => ({
  animateNodeToModal: (_rect: DOMRect, _modal: HTMLElement, options: { onComplete(): void }) => {
    options.onComplete();
    return { cancel() {} };
  },
  animateModalToNode: (_modal: HTMLElement, _rect: DOMRect, options: { onComplete(): void }) => {
    appMotion.closeStarts += 1;
    if (appMotion.deferClose) appMotion.closeComplete = options.onComplete;
    else options.onComplete();
    return { cancel() { appMotion.closeComplete = null; } };
  },
  animateMapLayout: (_root: HTMLElement, mutate: () => void, options: { onComplete(): void }) => {
    mutate();
    options.onComplete();
    return { cancel() {} };
  },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  appMotion.deferClose = false;
  appMotion.closeStarts = 0;
  appMotion.closeComplete = null;
});

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

  it('connects an existing location and adds its required role with one command', async () => {
    const setup = atomicConnectionRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const livingCard = screen.getByRole('heading', { name: '생활비' }).closest('article')!;
    fireEvent.click(within(livingCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: /급여통장/ }));
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(setup.save).toHaveBeenCalledWith(1, {
      type: 'connect-location', surface: 'draft', purposeId: 'system:living', locationId: 'salary',
    });
    expect(setup.saveIntent).not.toHaveBeenCalled();
  });

  it('creates and connects a new location with one command', async () => {
    const setup = atomicConnectionRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const savingCard = screen.getByRole('heading', { name: '저축' }).closest('article')!;
    fireEvent.click(within(savingCard).getByRole('button', { name: '연결' }));
    fireEvent.click(screen.getByRole('button', { name: '새 계좌·보관처 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '신한은행' }));
    fireEvent.change(screen.getByRole('textbox', { name: '표시 이름' }), { target: { value: '저축통장' } });
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(setup.save.mock.calls[0]?.[1]).toMatchObject({
      type: 'create-and-connect-location', surface: 'draft', purposeId: 'system:saving',
      location: { shortName: '저축통장', roles: [] },
    });
    expect(setup.saveIntent).not.toHaveBeenCalled();
  });

  it('connects an unlinked map location through one applied-surface command', async () => {
    const setup = mapConnectionRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const living = screen.getByRole('button', { name: /생활비 · 1,000,000원/ });
    fireEvent.click(living);
    fireEvent.click(living);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 추가' }));
    fireEvent.click(screen.getByRole('button', { name: /저축통장/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /이 계좌에 둘 월 금액/ }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(setup.save).toHaveBeenCalledWith(1, {
      type: 'connect-location', surface: 'applied', purposeId: 'system:living', locationId: 'savings', monthlyAmountWon: 100_000,
    });
    expect(setup.saveIntent).not.toHaveBeenCalled();
  });

  it('clears a pinned node and its edge amounts with Escape while retaining keyboard focus', () => {
    const setup = mapConnectionRepositories();
    const { container } = render(<AccountMapApp repositories={setup.repositories} />);
    const living = screen.getByRole('button', { name: /생활비 · 1,000,000원/ });

    living.focus();
    fireEvent.click(living);
    expect(living).toHaveClass('is-pinned');
    expect(container.querySelector('.account-map-edge-amount')).toHaveTextContent('1,000,000원');

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(living).not.toHaveClass('is-pinned');
    expect(container.querySelector('.account-map-edge-amount')).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(living).toHaveFocus();
  });

  it('returns a successful map-connection replay to its surviving source node', async () => {
    const setup = mapConnectionRepositories(false, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const living = screen.getByRole('button', { name: /생활비 · 1,000,000원/ });
    fireEvent.click(living);
    fireEvent.click(living);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 추가' }));
    fireEvent.click(screen.getByRole('button', { name: /저축통장/ }));
    fireEvent.change(screen.getByRole('textbox', { name: /이 계좌에 둘 월 금액/ }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '완료' }));

    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(living).toHaveFocus();
  });

  it('restores and connects an archived duplicate from the map modal with one command', async () => {
    const setup = mapConnectionRepositories(true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const living = screen.getByRole('button', { name: /생활비 · 1,000,000원/ });
    fireEvent.click(living);
    fireEvent.click(living);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.click(screen.getByRole('button', { name: '연결 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '새 계좌·보관처 추가' }));
    fireEvent.click(screen.getByRole('button', { name: '신한은행' }));
    fireEvent.change(screen.getByRole('textbox', { name: '표시 이름' }), { target: { value: '복원통장' } });
    fireEvent.change(screen.getByRole('textbox', { name: /이 계좌에 둘 월 금액/ }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '기존 항목 복원해서 연결' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(setup.save).toHaveBeenCalledWith(1, {
      type: 'restore-and-connect-location', surface: 'applied', purposeId: 'system:living', locationId: 'archived-vault', monthlyAmountWon: 100_000,
    });
  });

  it('archives a custom purpose with one command, removes its node, and focuses the map heading', async () => {
    const setup = purposeLifecycleRepositories(false);
    render(<AccountMapApp repositories={setup.repositories} />);
    const telecom = screen.getByRole('button', { name: /통신비 · 200,000원/ });
    fireEvent.click(telecom);
    fireEvent.click(telecom);
    fireEvent.click(screen.getByRole('button', { name: '통신비 더보기' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '목적 보관' }));
    fireEvent.click(screen.getByRole('button', { name: '보관하기' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(setup.save).toHaveBeenCalledWith(1, { type: 'archive-custom-purpose', purposeId: 'custom:telecom' });
    await waitFor(() => expect(screen.queryByRole('button', { name: /통신비 ·/ })).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: '목적과 계좌의 연결' })).toHaveFocus();
  });

  it('defers a successful archive replay until normal-motion close completes and then focuses the map heading', async () => {
    appMotion.deferClose = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const setup = purposeLifecycleRepositories(false, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const telecom = screen.getByRole('button', { name: /통신비 · 200,000원/ });
    const heading = screen.getByRole('heading', { name: '목적과 계좌의 연결' });
    fireEvent.click(telecom);
    fireEvent.click(telecom);
    fireEvent.click(screen.getByRole('button', { name: '통신비 더보기' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '목적 보관' }));
    fireEvent.click(screen.getByRole('button', { name: '보관하기' }));

    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('dialog', { name: '통신비 보관' })).toBeVisible();
    expect(telecom).toBeVisible();
    expect(appMotion.closeStarts).toBe(1);
    expect(heading).not.toHaveFocus();

    const complete = appMotion.closeComplete;
    expect(complete).not.toBeNull();
    act(() => complete?.());

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /통신비 ·/ })).not.toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(setup.save).toHaveBeenCalledTimes(2);
  });

  it('immediately adopts a successful reduced-motion archive replay and focuses the map heading', async () => {
    const setup = purposeLifecycleRepositories(false, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const telecom = screen.getByRole('button', { name: /통신비 · 200,000원/ });
    const heading = screen.getByRole('heading', { name: '목적과 계좌의 연결' });
    fireEvent.click(telecom);
    fireEvent.click(telecom);
    fireEvent.click(screen.getByRole('button', { name: '통신비 더보기' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '목적 보관' }));
    fireEvent.click(screen.getByRole('button', { name: '보관하기' }));

    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /통신비 ·/ })).not.toBeInTheDocument();
    expect(heading).toHaveFocus();
    expect(setup.save).toHaveBeenCalledTimes(2);
  });

  it('opens archived-purpose restore from management and returns focus without resuming links', async () => {
    const setup = purposeLifecycleRepositories(true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const managementTrigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(managementTrigger);
    expect(screen.getByText('보관된 목적 1개')).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: /통신비 · 생활비 · 200,000원/ }));

    const dialog = screen.getByRole('dialog', { name: '통신비 복원' });
    expect(dialog).toBeVisible();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    const target = screen.getByRole('textbox', { name: '월 목표 금액' });
    expect(target).toHaveValue('200000');
    expect(screen.getByRole('button', { name: '목적 복원' })).toBeDisabled();
    fireEvent.change(target, { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '목적 복원' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(setup.save).toHaveBeenCalledWith(1, { type: 'restore-custom-purpose', purposeId: 'custom:telecom', targetMonthlyWon: 100_000 });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(managementTrigger).toHaveFocus();
    expect(setup.current().accountMap.applied?.links.find(({ id }) => id === 'telecom')).toMatchObject({ status: 'suspended' });
  });

  it('preserves restore target and explicitly reapplies its scoped purpose intent after a conflict', async () => {
    const setup = purposeLifecycleRepositories(true, true);
    render(<AccountMapApp repositories={setup.repositories} />);
    const managementTrigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(managementTrigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /통신비 · 생활비/ }));
    const target = screen.getByRole('textbox', { name: '월 목표 금액' });
    fireEvent.change(target, { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '목적 복원' }));

    const replay = await screen.findByRole('button', { name: '최신 상태에서 다시 적용' });
    expect(target).toHaveValue('100000');
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeDisabled();
    expect(setup.save).toHaveBeenCalledWith(1, { type: 'restore-custom-purpose', purposeId: 'custom:telecom', targetMonthlyWon: 100_000 });

    fireEvent.click(replay);

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(2));
    expect(setup.save.mock.calls[1]).toEqual([2, {
      type: 'edit-custom-purpose', purposeId: 'custom:telecom', fields: { targetMonthlyWon: 100_000, lifecycle: 'restore' },
    }]);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(managementTrigger).toHaveFocus();
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
    expect(setup.save).toHaveBeenCalledTimes(1);
    expect(setup.saveIntent).not.toHaveBeenCalled();

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

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(2));
    expect(setup.save.mock.calls[1]).toEqual([2, expect.objectContaining({
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
    expect(setup.save).toHaveBeenCalledWith(1, {
      type: 'restore-and-connect-location', surface: 'draft', purposeId: 'system:income', locationId: 'checking',
    });
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

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(3));
    expect(setup.save.mock.calls[2]?.[0]).toBe(2);
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

    fireEvent.click(screen.getByRole('button', { name: '최신 상태에서 다시 검토' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: '최신 상태에서 다시 검토' })).not.toBeInTheDocument());
    expect(name).toHaveValue('여행');
  });

  it.each(['cancel', 'escape', 'backdrop'] as const)('abandons settled custom-purpose recovery through %s', async (method) => {
    const setup = staleDraftRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const trigger = screen.getByRole('button', { name: '세부 목적 추가' });
    trigger.focus();
    fireEvent.click(trigger);
    const name = screen.getByRole('textbox', { name: '목적 이름' });
    fireEvent.change(name, { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    await screen.findByRole('button', { name: '최신 상태에서 다시 검토' });
    name.focus();

    if (method === 'cancel') fireEvent.click(screen.getByRole('button', { name: '취소' }));
    else if (method === 'escape') fireEvent.keyDown(document, { key: 'Escape' });
    else fireEvent.pointerDown(screen.getByRole('dialog', { name: '세부 목적 추가' }).parentElement!);

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '세부 목적 추가' })).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 검토' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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
    expect(setup.save).toHaveBeenCalledTimes(1);
    expect(livingNode).toHaveFocus();
  });

  it('adopts successful replay only after normal-motion modal close restores focus', async () => {
    appMotion.deferClose = true;
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const setup = staleModalRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    const livingNode = screen.getByRole('button', { name: /생활비 · 1,000,000원/ });
    fireEvent.click(livingNode);
    fireEvent.click(livingNode);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    fireEvent.change(screen.getByRole('textbox', { name: '생활비통장 월 금액' }), { target: { value: '650000' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const dialog = screen.getByRole('dialog', { name: /생활비 편집/ });

    fireEvent.click(await screen.findByRole('button', { name: '최신 상태에서 다시 적용' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledTimes(1));
    expect(dialog).toBeVisible();
    expect(appMotion.closeStarts).toBe(1);
    expect(livingNode).not.toHaveFocus();

    const complete = appMotion.closeComplete;
    expect(complete).not.toBeNull();
    act(() => complete?.());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(livingNode).toHaveFocus();
    expect(setup.save).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '최신 상태에서 다시 적용' })).not.toBeInTheDocument();

    fireEvent.click(livingNode);
    fireEvent.click(livingNode);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    expect(screen.getByRole('textbox', { name: '생활비통장 월 금액' })).toHaveValue('650000');
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
    if (revision === 1) return { status: 'conflict' as const, currentRevision: 2 };
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
    if (revision === 2 && command.type === 'connect-location' && rejectAfterInitialize) return { status: 'rejected' as const, reason: 'target-missing' as const };
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

function atomicConnectionRepositories() {
  let workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.main.applied = mainData();
  workspace.locations = [{
    id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' },
    kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1,
  }];
  const save = vi.fn(async (revision, command) => {
    const result = applyAccountMapCommand(workspace, command, revision + 1);
    if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
    workspace = { ...result.workspace, revision: revision + 1, updatedAt: revision + 1 };
    return { status: 'saved' as const, workspace };
  });
  const saveIntent = vi.fn();
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save, saveIntent, migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save, saveIntent };
}

function mapConnectionRepositories(withArchivedDuplicate = false, conflictOnce = false) {
  let workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.main.applied = mainData();
  workspace.locations = [
    { id: 'salary', shortName: '급여통장', kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1 },
    { id: 'checking', shortName: '생활비통장', kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
    { id: 'savings', shortName: '저축통장', kind: 'bank', roles: ['saving'], createdAt: 1, updatedAt: 1 },
    ...(withArchivedDuplicate ? [{ id: 'archived-vault', shortName: '복원통장', institution: { id: 'shinhan', name: '신한은행' }, kind: 'bank' as const, roles: ['spending' as const], archivedAt: 2, createdAt: 1, updatedAt: 2 }] : []),
  ];
  workspace.accountMap.applied = {
    schemaVersion: 1, sourceMainUpdatedAt: 10, customPurposes: [],
    links: [
      { id: 'income', purposeId: 'system:income', locationId: 'salary', monthlyAmountWon: 2_000_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
      { id: 'living', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 1_000_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
    ],
    layout: 'purpose', setupCompletedAt: 1, updatedAt: 1,
  };
  const latest = structuredClone(workspace);
  latest.revision = 2;
  latest.updatedAt = 2;
  const save = vi.fn(async (revision, command) => {
    if (conflictOnce && revision === 1) {
      workspace = latest;
      return { status: 'conflict' as const, currentRevision: 2 };
    }
    const result = applyAccountMapCommand(workspace, command, revision + 1);
    if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
    workspace = { ...result.workspace, revision: revision + 1, updatedAt: revision + 1 };
    return { status: 'saved' as const, workspace };
  });
  const saveIntent = vi.fn();
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save, saveIntent, migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save, saveIntent };
}

function purposeLifecycleRepositories(archived: boolean, conflictOnce = false) {
  let workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.main.applied = mainData();
  workspace.locations = [
    { id: 'salary', shortName: '급여통장', kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1 },
    { id: 'checking', shortName: '생활비통장', kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
  ];
  workspace.accountMap.applied = {
    schemaVersion: 1, sourceMainUpdatedAt: 10,
    customPurposes: [
      { id: 'custom:food', parentId: 'system:living', name: '식비', targetMonthlyWon: archived ? 900_000 : 800_000, createdAt: 1, updatedAt: 1 },
      { id: 'custom:telecom', parentId: 'system:living', name: '통신비', targetMonthlyWon: 200_000, ...(archived ? { archivedAt: 2 } : {}), createdAt: 1, updatedAt: archived ? 2 : 1 },
    ],
    links: [
      { id: 'income', purposeId: 'system:income', locationId: 'salary', monthlyAmountWon: 2_000_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
      archived
        ? { id: 'telecom', purposeId: 'custom:telecom', locationId: 'checking', monthlyAmountWon: 200_000, remainder: false, status: 'suspended', suspendedReason: 'user', createdAt: 1, updatedAt: 2 }
        : { id: 'telecom', purposeId: 'custom:telecom', locationId: 'checking', monthlyAmountWon: 200_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
    ],
    layout: 'purpose', setupCompletedAt: 1, updatedAt: archived ? 2 : 1,
  };
  const initial = workspace;
  const latest = structuredClone(workspace);
  latest.revision = 2;
  latest.updatedAt = 2;
  latest.accountMap.applied!.customPurposes.find(({ id }) => id === 'custom:telecom')!.name = '통신비 최신';
  const save = vi.fn(async (revision, command) => {
    if (conflictOnce && revision === 1) {
      workspace = latest;
      return { status: 'conflict' as const, currentRevision: 2 };
    }
    const result = applyAccountMapCommand(workspace, command, revision + 1);
    if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
    workspace = { ...result.workspace, revision: revision + 1, updatedAt: revision + 1 };
    return { status: 'saved' as const, workspace };
  });
  const accountMap: AccountMapRepository = {
    load: conflictOnce
      ? vi.fn().mockReturnValueOnce({ status: 'found' as const, workspace: initial, needsMigration: false }).mockImplementation(() => ({ status: 'found' as const, workspace, needsMigration: false }))
      : vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save, saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: mainData() })) };
  return { repositories: { accountMap, main }, save, current: () => workspace };
}

function mainData() {
  return { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
}
