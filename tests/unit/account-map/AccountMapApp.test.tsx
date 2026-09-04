import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccountMapApp } from '../../../src/account-map/ui/AccountMapApp';
import { applyAccountMapCommand } from '../../../src/account-map/domain/commands';
import type { AccountMapRepository } from '../../../src/account-map/infrastructure/accountMapRepository';
import type { AccountMapMainSourceRepository } from '../../../src/account-map/infrastructure/mainSourceRepository';
import { salaryLivingBrokerageFixture } from './accountFlowTestSupport';
import { createEmptyWorkspace, type WorkspaceDocument } from '../../../src/workspace/domain/model';

vi.mock('../../../src/account-map/ui/motion', () => ({
  animateFocusedFlow: () => ({ cancel() {} }),
  animateNodeToModal: (_source: DOMRect, _modal: HTMLElement, options: { onComplete(): void }) => { options.onComplete(); return { cancel() {} }; },
  animateModalToNode: (_modal: HTMLElement, _source: DOMRect, options: { onComplete(): void }) => { options.onComplete(); return { cancel() {} }; },
  animateConnectionDetail: () => ({ cancel() {} }),
  animateSetupStep: () => ({ cancel() {} }),
  setSetupStepFinalState: () => undefined,
}));

afterEach(cleanup);

describe('AccountMapApp completed flow map', () => {
  it('renders a V3 applied flow and only opens account detail on first activation', () => {
    render(<AccountMapApp repositories={flowRepositories().repositories} />);

    expect(screen.getAllByRole('heading', { name: '계좌별 월 계획 흐름' })).toHaveLength(2);
    expect(screen.queryByLabelText('급여 통장 월 계획 흐름')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /계좌 급여 통장/ }));

    const detail = screen.getByLabelText('급여 통장 월 계획 흐름');
    expect(within(detail).getByRole('button', { name: '계좌 정보 편집' })).toBeVisible();
    expect(within(detail).getByRole('button', { name: '연결 추가' })).toBeVisible();
  });

  it('adds a transfer through the explicit detail action without changing Main, Simulation, or Portfolio', async () => {
    const setup = flowRepositories();
    const before = protectedSlices(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);

    openSalaryDetail();
    fireEvent.click(within(screen.getByLabelText('급여 통장 월 계획 흐름')).getByRole('button', { name: '연결 추가' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '받는 계좌' }), { target: { value: 'brokerage' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '110000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledWith(1, expect.objectContaining({
      type: 'add-transfer', surface: 'applied', transfer: expect.objectContaining({
        sourceLocationId: 'salary', targetLocationId: 'brokerage', allocation: { kind: 'fixed', monthlyAmountWon: 110_000 },
      }),
    })));
    expect(await setup.save.mock.results[0]!.value).toEqual({ status: 'saved', workspace: expect.anything() });
    expect(protectedSlices(setup.current())).toEqual(before);
    expect(setup.current().accountMap.applied).toMatchObject({ schemaVersion: 3, transfers: expect.arrayContaining([
      expect.objectContaining({ sourceLocationId: 'salary', targetLocationId: 'brokerage' }),
    ]) });
  });

  it('edits a selected transfer through the typed applied command and traps the editor focus', async () => {
    const setup = flowRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);

    openSalaryDetail();
    const detail = screen.getByLabelText('급여 통장 월 계획 흐름');
    fireEvent.click(within(detail).getByRole('button', { name: '흐름 편집' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    expect(within(dialog).getByRole('button', { name: '닫기' })).toHaveFocus();
    fireEvent.change(within(dialog).getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '950000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledWith(1, {
      type: 'edit-transfer', surface: 'applied', transferId: 'salary-living', fields: {
        sourceLocationId: 'salary', targetLocationId: 'living', allocation: { kind: 'fixed', monthlyAmountWon: 950_000 }, status: 'active',
      },
    }));
  });

  it('keeps location edits behind the explicit account action and uses the location-only modal', () => {
    render(<AccountMapApp repositories={flowRepositories().repositories} />);
    openSalaryDetail();
    fireEvent.click(within(screen.getByLabelText('급여 통장 월 계획 흐름')).getByRole('button', { name: '계좌 정보 편집' }));

    const dialog = screen.getByRole('dialog', { name: '급여 통장 상세' });
    expect(within(dialog).getByRole('button', { name: '편집' })).toBeVisible();
    expect(within(dialog).queryByRole('button', { name: '연결 추가' })).not.toBeInTheDocument();
  });
});

function openSalaryDetail(): void {
  fireEvent.click(screen.getByRole('button', { name: /계좌 급여 통장/ }));
}

function flowRepositories(): { repositories: { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository }; save: ReturnType<typeof vi.fn>; current(): WorkspaceDocument } {
  const fixture = salaryLivingBrokerageFixture();
  let workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.updatedAt = 10;
  workspace.main.applied = fixture.main;
  workspace.locations = fixture.locations.map((location) => ({
    ...location,
    roles: location.id === 'salary' ? ['income'] : location.id === 'living' ? ['spending'] : ['investing'],
  }));
  workspace.accountMap.applied = fixture.applied;
  const save = vi.fn(async (revision: number, command: Parameters<AccountMapRepository['save']>[1]) => {
    const applied = applyAccountMapCommand(workspace, command, 20 + revision);
    if (!applied.ok) return { status: 'rejected' as const, reason: applied.reason };
    workspace = { ...applied.workspace, revision: revision + 1 };
    return { status: 'saved' as const, workspace };
  });
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save, saveIntent: vi.fn(), migrate: vi.fn(), reset: vi.fn(),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: fixture.main })) };
  return { repositories: { accountMap, main }, save, current: () => workspace };
}

function protectedSlices(workspace: WorkspaceDocument) {
  return structuredClone({ main: workspace.main, simulation: workspace.simulation, portfolio: workspace.portfolio });
}
