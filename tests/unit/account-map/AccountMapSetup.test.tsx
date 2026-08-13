import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
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
});

function fixture(withLocation = false, failSave = false, archived = false) {
  let workspace = createEmptyWorkspace(1);
  const mainData = { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
  workspace.main.applied = mainData;
  if (withLocation || archived) workspace.locations = [{ id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank', roles: ['income'], ...(archived ? { archivedAt: 2 } : {}), createdAt: 1, updatedAt: 1 }];
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    migrate: vi.fn(), reset: vi.fn(),
    saveIntent: vi.fn(),
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
