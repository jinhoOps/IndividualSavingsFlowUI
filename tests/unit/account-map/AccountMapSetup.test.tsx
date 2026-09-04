import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import type { AccountTransferLink } from '../../../src/account-map/domain/model';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

type AnimeOptions = { onComplete?(): void };

const anime = vi.hoisted(() => ({
  animate: vi.fn<(target: HTMLElement, options: AnimeOptions) => { cancel(): void }>(),
  revert: vi.fn(),
}));

vi.mock('animejs', () => ({
  animate: anime.animate,
  createScope: () => ({
    matches: { reducedMotion: false },
    add: (callback: () => void) => callback(),
    revert: anime.revert,
  }),
}));

afterEach(cleanup);

beforeEach(() => {
  anime.animate.mockReset();
  anime.revert.mockReset();
  anime.animate.mockImplementation((_target, options) => {
    options.onComplete?.();
    return { cancel: vi.fn() };
  });
});

describe('AccountMapSetup', () => {
  it('starts with the read-only Main basis before locations, transfers, and review', () => {
    const { container } = render(<AccountMapApp repositories={repositories().repositories} />);

    expect(screen.getByRole('heading', { name: '월 자금 기준 확인' })).toBeVisible();
    expect(screen.getByText('들어오는 돈')).toBeVisible();
    expect(screen.getByText('나가는 돈')).toBeVisible();
    expect(screen.getByText('모으는 돈')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Main 금액 수정' })).toBeVisible();
    expect(screen.getByRole('button', { name: '이 금액으로 계속' })).toBeVisible();
    expect(screen.queryByText('월 자금의 위치를 알려주세요')).not.toBeInTheDocument();
    expect(setupAnimationCalls(container.querySelector<HTMLElement>('.account-map-setup')!)).toHaveLength(0);
    expectSetupSurfaceFinalState(container.querySelector<HTMLElement>('.account-map-setup')!);
  });

  it('persists the centered basis, locations, transfers, and review sequence and restores the prior step on Back', async () => {
    const setup = repositories();
    const { container } = render(<AccountMapApp repositories={setup.repositories} />);

    fireEvent.click(screen.getByRole('button', { name: '이 금액으로 계속' }));
    expect(await screen.findByRole('heading', { name: '돈이 머무는 곳을 연결해요' })).toBeVisible();
    expect(setup.current().accountMap.draft).toMatchObject({ schemaVersion: 2, step: 'locations' });

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByRole('heading', { name: '계좌 사이 흐름을 정해요' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByRole('heading', { name: '월 흐름을 검토해요' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    expect(await screen.findByRole('heading', { name: '계좌 사이 흐름을 정해요' })).toBeVisible();
    const surface = container.querySelector<HTMLElement>('.account-map-setup')!;
    expect(surface).toHaveStyle({ opacity: '1', transform: 'translateY(0px)' });
  });

  it('settles the actual scoped setup surface when a step rerenders and when Back cancels its animation', async () => {
    const cancel = vi.fn();
    anime.animate.mockImplementation((_target, options) => {
      options.onComplete?.();
      return { cancel };
    });
    const { container } = render(<AccountMapApp repositories={repositories().repositories} />);
    const surface = container.querySelector<HTMLElement>('.account-map-setup')!;

    fireEvent.click(screen.getByRole('button', { name: '이 금액으로 계속' }));
    await screen.findByRole('heading', { name: '돈이 머무는 곳을 연결해요' });
    expect(setupAnimationCalls(surface)).toHaveLength(1);
    expect(cancel).not.toHaveBeenCalled();
    expectSetupSurfaceFinalState(surface);

    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    await screen.findByRole('heading', { name: '계좌 사이 흐름을 정해요' });
    fireEvent.click(screen.getByRole('button', { name: '이전' }));
    await screen.findByRole('heading', { name: '돈이 머무는 곳을 연결해요' });
    expect(cancel.mock.calls.length).toBeGreaterThanOrEqual(2);
    expectSetupSurfaceFinalState(surface);
  });

  it('settles the actual scoped setup surface when cancellation throws during unmount', async () => {
    const cancel = vi.fn(() => { throw new Error('cancel failed'); });
    anime.animate.mockImplementation(() => ({ cancel }));
    const rendered = render(<AccountMapApp repositories={repositories().repositories} />);
    const surface = rendered.container.querySelector<HTMLElement>('.account-map-setup')!;
    fireEvent.click(screen.getByRole('button', { name: '이 금액으로 계속' }));
    await screen.findByRole('heading', { name: '돈이 머무는 곳을 연결해요' });

    rendered.unmount();

    expect(cancel).toHaveBeenCalledOnce();
    expectSetupSurfaceFinalState(surface);
  });

  it('settles the actual scoped setup surface when Anime.js throws synchronously', () => {
    anime.animate.mockImplementation(() => { throw new Error('Anime.js unavailable'); });
    const { container } = render(<AccountMapApp repositories={repositories().repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '이 금액으로 계속' }));

    expectSetupSurfaceFinalState(container.querySelector<HTMLElement>('.account-map-setup')!);
  });

  it('requests Main editing from the host without mutating the Main source', () => {
    const setup = repositories();
    const requestMainEdit = vi.fn();
    render(<AccountMapApp repositories={setup.repositories} onRequestMainEdit={requestMainEdit} />);

    fireEvent.click(screen.getByRole('button', { name: '생활비 Main 금액 수정' }));

    expect(requestMainEdit).toHaveBeenCalledWith('living');
    expect(setup.current().main.applied?.monthlyLivingWon).toBe(1_000_000);
  });

  it('traps reverse and forward Tab in the custom-purpose dialog and restores its trigger focus', async () => {
    render(<AccountMapApp repositories={repositories().repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '이 금액으로 계속' }));
    await screen.findByRole('heading', { name: '돈이 머무는 곳을 연결해요' });
    const trigger = screen.getByRole('button', { name: '세부 목적 추가' });

    trigger.focus();
    fireEvent.click(trigger);
    const parent = screen.getByRole('combobox', { name: '큰 목적' });
    const cancel = screen.getByRole('button', { name: '취소' });
    expect(parent).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(cancel).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(parent).toHaveFocus();

    fireEvent.click(cancel);
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps Tab and Shift+Tab on the modal while a custom-purpose save is unresolved', async () => {
    const setup = repositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '이 금액으로 계속' }));
    await screen.findByRole('heading', { name: '돈이 머무는 곳을 연결해요' });
    vi.mocked(setup.accountMap.save).mockImplementation(async () => await new Promise(() => undefined));
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    fireEvent.change(screen.getByRole('textbox', { name: '목적 이름' }), { target: { value: '여행' } });
    fireEvent.change(screen.getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    const dialog = screen.getByRole('dialog', { name: '세부 목적 추가' });
    await waitFor(() => expect(dialog).toHaveAttribute('aria-busy', 'true'));
    const tab = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab' });
    document.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(dialog).toHaveFocus();
    const reverseTab = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Tab', shiftKey: true });
    document.dispatchEvent(reverseTab);
    expect(reverseTab.defaultPrevented).toBe(true);
    expect(dialog).toHaveFocus();
  });

  it('keeps a suggestion ephemeral until its explicit acceptance creates a normal transfer', async () => {
    const setup = repositories('transfers');
    render(<AccountMapApp repositories={setup.repositories} />);

    expect(screen.getByText('확인할 제안')).toBeVisible();
    expect(setup.current().accountMap.draft?.schemaVersion).toBe(2);
    expect((setup.current().accountMap.draft as { transfers: unknown[] }).transfers).toEqual([]);

    fireEvent.click(screen.getAllByRole('button', { name: '제안 적용' })[0]!);

    await waitFor(() => expect((setup.current().accountMap.draft as { transfers: unknown[] }).transfers).toHaveLength(1));
    expect((setup.current().accountMap.draft as { transfers: Array<{ allocation: unknown }> }).transfers[0]?.allocation)
      .toMatchObject({ kind: 'fixed' });
  });

  it('removes an accepted transfer through the typed draft command before applying the map', async () => {
    const setup = repositories('transfers');
    render(<AccountMapApp repositories={setup.repositories} />);

    fireEvent.click(screen.getAllByRole('button', { name: '제안 적용' })[0]!);
    await waitFor(() => expect((setup.current().accountMap.draft as { transfers: unknown[] }).transfers).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    await waitFor(() => expect((setup.current().accountMap.draft as { transfers: unknown[] }).transfers).toHaveLength(0));
    expect(setup.accountMap.save).toHaveBeenLastCalledWith(expect.any(Number), expect.objectContaining({
      type: 'remove-transfer', surface: 'draft',
    }));
  });

  it('keeps a concurrent transfer removal in manual recovery instead of replaying it', async () => {
    const setup = repositories('transfers', [
      transfer('salary-to-brokerage', 'salary', 'brokerage', { kind: 'fixed', monthlyAmountWon: 100_000 }),
    ]);
    vi.mocked(setup.accountMap.save).mockResolvedValue({ status: 'conflict', currentRevision: 2 });
    render(<AccountMapApp repositories={setup.repositories} />);

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '여러 변경을 최신 상태에 자동으로 다시 적용하지 않습니다. 입력을 검토한 뒤 다시 저장해 주세요.',
    );
    expect(setup.accountMap.save).toHaveBeenCalledWith(expect.any(Number), expect.objectContaining({
      type: 'remove-transfer', surface: 'draft', transferId: 'salary-to-brokerage',
    }));
  });

  it.each([
    {
      name: 'a duplicate active pair',
      transfers: [transfer('existing-fixed', 'salary', 'brokerage', { kind: 'fixed', monthlyAmountWon: 100_000 })],
      next: { source: 'salary', target: 'brokerage', allocation: 'fixed' as const },
      feedback: '같은 두 계좌 사이에는 활성 흐름을 하나만 둘 수 있어요.',
    },
    {
      name: 'a directed cycle',
      transfers: [transfer('salary-to-brokerage', 'salary', 'brokerage', { kind: 'fixed', monthlyAmountWon: 100_000 })],
      next: { source: 'brokerage', target: 'salary', allocation: 'fixed' as const },
      feedback: '계좌 흐름이 순환해요. 한 방향으로 흐르도록 출발·도착을 바꿔 주세요.',
    },
    {
      name: 'a second sweep from one source',
      transfers: [transfer('existing-sweep', 'salary', 'brokerage', { kind: 'sweep' })],
      next: { source: 'salary', target: 'living', allocation: 'sweep' as const },
      feedback: '한 계좌에서 남은 금액 전부 흐름은 하나만 둘 수 있어요.',
    },
  ])('explains how to correct $name instead of showing a generic transfer save error', async ({ transfers, next, feedback }) => {
    render(<AccountMapApp repositories={repositories('transfers', transfers).repositories} />);

    addTransfer(next);

    expect(await screen.findByRole('alert')).toHaveTextContent(feedback);
    expect(screen.queryByText('저장하지 못했어요. 입력은 그대로 두었습니다.')).not.toBeInTheDocument();
  });

  it('requires an explicit source and target before saving a sweep transfer', async () => {
    const setup = repositories('transfers');
    render(<AccountMapApp repositories={setup.repositories} />);

    fireEvent.click(screen.getByRole('button', { name: '흐름 추가' }));
    fireEvent.click(screen.getByRole('radio', { name: '남은 금액 전부' }));
    expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    fireEvent.change(screen.getByRole('combobox', { name: '보내는 계좌' }), { target: { value: 'salary' } });
    fireEvent.change(screen.getByRole('combobox', { name: '받는 계좌' }), { target: { value: 'brokerage' } });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect((setup.current().accountMap.draft as { transfers: Array<{ allocation: unknown }> }).transfers)
      .toContainEqual(expect.objectContaining({ allocation: { kind: 'sweep' } })));
  });

  it('renders AccountFlowCalculator warnings in review without treating them as a storage error', () => {
    render(<AccountMapApp repositories={repositories('review').repositories} />);

    expect(screen.getByRole('heading', { name: '월 흐름을 검토해요' })).toBeVisible();
    expect(screen.getByText('배정되지 않은 금액 2,000,000원')).toBeVisible();
    expect(screen.getByText('남은 금액 전부 · 계획상 0원')).toBeVisible();
  });
});

function repositories(
  step: 'basis' | 'transfers' | 'review' = 'basis',
  transfers: readonly AccountTransferLink[] = [],
) {
  let workspace = createEmptyWorkspace(1);
  const main = {
    schemaVersion: 2 as const,
    updatedAt: 10,
    monthlyNetIncomeWon: 2_000_000,
    monthlyHousingWon: 500_000,
    monthlyLivingWon: 1_000_000,
    monthlySavingWon: 300_000,
    monthlyInvestmentWon: 200_000,
  };
  workspace.main.applied = main;
  if (step === 'transfers') {
    workspace.locations = [
      { id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1 },
      { id: 'living', shortName: '생활비통장', institution: { id: 'shinhan', name: '신한은행' }, kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
      { id: 'brokerage', shortName: '증권계좌', institution: { name: '미래증권' }, kind: 'brokerage', roles: ['saving', 'investing'], createdAt: 1, updatedAt: 1 },
    ];
    workspace.accountMap.draft = {
      schemaVersion: 2,
      sourceMainUpdatedAt: 10,
      customPurposes: [],
      links: [
        activeLink('income', 'system:income', 'salary', 2_000_000),
        activeLink('living', 'system:living', 'living', 1_000_000),
        activeLink('saving', 'system:saving', 'brokerage', 300_000),
        activeLink('investing', 'system:investing', 'brokerage', 200_000),
      ],
      transfers: [...structuredClone(transfers)],
      step,
      updatedAt: 1,
    };
  }
  if (step === 'review') {
    workspace.locations = [
      { id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['income'], createdAt: 1, updatedAt: 1 },
      { id: 'living', shortName: '생활비통장', institution: { id: 'shinhan', name: '신한은행' }, kind: 'bank', roles: ['spending'], createdAt: 1, updatedAt: 1 },
    ];
    workspace.accountMap.draft = {
      schemaVersion: 2,
      sourceMainUpdatedAt: 10,
      customPurposes: [],
      links: [
        activeLink('income', 'system:income', 'salary', 2_000_000),
        activeLink('living', 'system:living', 'living', 1_000_000),
      ],
      transfers: [{
        id: 'living-sweep',
        sourceLocationId: 'living',
        targetLocationId: 'salary',
        allocation: { kind: 'sweep' },
        status: 'active',
        createdAt: 1,
        updatedAt: 1,
      }],
      step: 'review',
      updatedAt: 1,
    };
  }
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    migrate: vi.fn(),
    reset: vi.fn(),
    saveIntent: vi.fn(),
    save: vi.fn(async (revision, command) => {
      const result = applyAccountMapCommand(workspace, command, 20);
      if (!result.ok) return { status: 'rejected' as const, reason: result.reason };
      workspace = { ...result.workspace, revision: revision + 1, updatedAt: 20 };
      return { status: 'saved' as const, workspace };
    }),
  };
  const mainSource: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: main })) };
  return { repositories: { accountMap, main: mainSource }, accountMap, current: (): WorkspaceDocument => workspace };
}

function addTransfer(input: { source: string; target: string; allocation: 'fixed' | 'sweep' }): void {
  fireEvent.click(screen.getByRole('button', { name: '흐름 추가' }));
  fireEvent.change(screen.getByRole('combobox', { name: '보내는 계좌' }), { target: { value: input.source } });
  fireEvent.change(screen.getByRole('combobox', { name: '받는 계좌' }), { target: { value: input.target } });
  if (input.allocation === 'sweep') fireEvent.click(screen.getByRole('radio', { name: '남은 금액 전부' }));
  else fireEvent.change(screen.getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '100000' } });
  fireEvent.click(screen.getByRole('button', { name: '저장' }));
}

function transfer(
  id: string,
  sourceLocationId: string,
  targetLocationId: string,
  allocation: AccountTransferLink['allocation'],
): AccountTransferLink {
  return { id, sourceLocationId, targetLocationId, allocation, status: 'active', createdAt: 1, updatedAt: 1 };
}

function expectSetupSurfaceFinalState(surface: HTMLElement): void {
  expect(surface.style.opacity).toBe('1');
  expect(surface.style.transform).toBe('translateY(0px)');
}

function setupAnimationCalls(surface: HTMLElement): unknown[][] {
  return anime.animate.mock.calls.filter(([target]) => target === surface);
}

function activeLink(id: string, purposeId: 'system:income' | 'system:living' | 'system:saving' | 'system:investing', locationId: string, monthlyAmountWon: number) {
  return { id, purposeId, locationId, monthlyAmountWon, remainder: true, status: 'active' as const, createdAt: 1, updatedAt: 1 };
}
