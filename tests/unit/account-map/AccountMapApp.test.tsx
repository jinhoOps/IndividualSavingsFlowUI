import { cleanup, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

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
      save: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
    };
    const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'unavailable' as const })) };
    render(<AccountMapApp repositories={{ accountMap, main }} />);
    expect(screen.getByRole('heading', { name: '저장소를 불러오지 못했어요' })).toBeVisible();
  });
});

function repositories(options: { mainStatus?: 'found' | 'empty'; draftSourceUpdatedAt?: number } = {}) {
  const workspace = createEmptyWorkspace(1);
  const mainData = { schemaVersion: 2 as const, updatedAt: 10, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
  workspace.main.applied = mainData;
  if (options.draftSourceUpdatedAt !== undefined) {
    workspace.accountMap.draft = { schemaVersion: 1, sourceMainUpdatedAt: options.draftSourceUpdatedAt, customPurposes: [], links: [], step: 'review', updatedAt: 5 };
  }
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = {
    load: vi.fn(() => options.mainStatus === 'empty'
      ? { status: 'empty' as const }
      : { status: 'found' as const, data: mainData }),
  };
  return { accountMap, main };
}
