import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

afterEach(cleanup);

describe('AccountMapSetup', () => {
  it('starts with the read-only Main basis before locations, transfers, and review', () => {
    render(<AccountMapApp repositories={repositories().repositories} />);

    expect(screen.getByRole('heading', { name: '월 자금 기준 확인' })).toBeVisible();
    expect(screen.getByText('들어오는 돈')).toBeVisible();
    expect(screen.getByText('나가는 돈')).toBeVisible();
    expect(screen.getByText('모으는 돈')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Main 금액 수정' })).toBeVisible();
    expect(screen.getByRole('button', { name: '이 금액으로 계속' })).toBeVisible();
    expect(screen.queryByText('월 자금의 위치를 알려주세요')).not.toBeInTheDocument();
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

  it('requests Main editing from the host without mutating the Main source', () => {
    const setup = repositories();
    const requestMainEdit = vi.fn();
    render(<AccountMapApp repositories={setup.repositories} onRequestMainEdit={requestMainEdit} />);

    fireEvent.click(screen.getByRole('button', { name: '생활비 Main 금액 수정' }));

    expect(requestMainEdit).toHaveBeenCalledWith('living');
    expect(setup.current().main.applied?.monthlyLivingWon).toBe(1_000_000);
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

function repositories(step: 'basis' | 'transfers' | 'review' = 'basis') {
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
      transfers: [],
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
  return { repositories: { accountMap, main: mainSource }, current: (): WorkspaceDocument => workspace };
}

function activeLink(id: string, purposeId: 'system:income' | 'system:living' | 'system:saving' | 'system:investing', locationId: string, monthlyAmountWon: number) {
  return { id, purposeId, locationId, monthlyAmountWon, remainder: true, status: 'active' as const, createdAt: 1, updatedAt: 1 };
}
