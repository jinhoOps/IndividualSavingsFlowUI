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
  it.each(['close', 'cancel', 'escape', 'save'] as const)('returns focus to the account edit action after %s', async (action) => {
    const setup = flowRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    openSalaryDetail();
    const trigger = within(screen.getByLabelText('급여 통장 월 계획 흐름')).getByRole('button', { name: '계좌 정보 편집' });
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: '급여 통장 편집' });
    if (action === 'save') {
      fireEvent.click(within(dialog).getByRole('button', { name: 'KB국민은행' }));
      fireEvent.change(within(dialog).getByRole('textbox', { name: '표시 이름' }), { target: { value: '주 수입 통장' } });
      fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    } else if (action === 'escape') {
      fireEvent.keyDown(dialog, { key: 'Escape' });
    } else {
      fireEvent.click(within(dialog).getByRole('button', { name: action === 'cancel' ? '취소' : '닫기' }));
    }
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });

  it.each(['invalid', 'unavailable'] as const)('offers a recovery destination when the workspace is %s', (status) => {
    const setup = flowRepositories();
    setup.repositories.accountMap.load = () => status === 'invalid' ? { status, raw: 'invalid workspace' } : { status };
    render(<AccountMapApp repositories={setup.repositories} />);
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: status === 'invalid' ? '자금 흐름에서 복구하기' : '다시 불러오기' }))
      .toHaveAttribute('href', status === 'invalid' ? '/apps/main/' : '/apps/account-map/');
    expect(setup.save).not.toHaveBeenCalled();
  });

  it('suspends and resumes a purpose allocation through the real completed editor', async () => {
    const setup = flowRepositories();
    const before = protectedSlices(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '생활비 배정 관리' }));
    let dialog = screen.getByRole('dialog', { name: '생활비 편집' });
    expect(within(dialog).getByText('월 기준')).toBeVisible();
    fireEvent.change(within(dialog).getByRole('combobox', { name: '생활비 통장 연결 상태' }), { target: { value: 'suspended' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap.applied!.links.find(({ id }) => id === 'living-local')).toMatchObject({ status: 'suspended', suspendedReason: 'user' });
    fireEvent.click(screen.getByRole('button', { name: '생활비 배정 관리' }));
    dialog = screen.getByRole('dialog', { name: '생활비 편집' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '생활비 통장 연결 상태' }), { target: { value: 'active' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    const resumed = setup.current().accountMap.applied!.links.find(({ id }) => id === 'living-local');
    expect(resumed).toMatchObject({ status: 'active', monthlyAmountWon: 900_000 });
    expect(resumed).not.toHaveProperty('suspendedReason');
    expect(protectedSlices(setup.current())).toEqual(before);
  });

  it.each(['최신 상태에서 다시 검토', '최신 값 유지'])('unlocks completed map reset after a conflict with %s', async (recoveryAction) => {
    const setup = flowRepositories();
    const before = structuredClone(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '월 연결 다시 만들기' }));
    setup.current().revision = 2;
    fireEvent.click(within(screen.getByRole('dialog', { name: '월 연결을 다시 만들까요?' })).getByRole('button', { name: '다시 만들기' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap).toEqual(before.accountMap);
    fireEvent.click(await screen.findByRole('button', { name: recoveryAction }));
    expect(setup.current().revision).toBe(2);
    expect(screen.getByRole('button', { name: '생활비 배정 관리' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '월 연결 다시 만들기' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '월 연결을 다시 만들까요?' })).getByRole('button', { name: '다시 만들기' }));
    await waitFor(() => expect(setup.current().accountMap).toEqual({ applied: null, draft: null }));
    expect(setup.current().revision).toBe(3);
    expect(protectedSlices(setup.current())).toEqual(protectedSlices(before));
    expect(setup.current().locations).toEqual(before.locations);
  });

  it('renders an applied flow and only opens account detail on first activation', () => {
    render(<AccountMapApp repositories={flowRepositories().repositories} />);

    expect(screen.getByRole('heading', { name: '계좌별 월 계획 흐름', level: 1 })).toBeVisible();
    expect(screen.getByRole('region', { name: '전체 연결 지도' })).toBeVisible();
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

    const dialog = screen.getByRole('dialog', { name: '급여 통장 편집' });
    expect(within(dialog).getByRole('textbox', { name: '표시 이름' })).toHaveValue('급여 통장');
    expect(within(dialog).queryByText('월 기준')).not.toBeInTheDocument();
    expect(within(dialog).getByText('계좌·보관처의 이름, 종류와 기관을 수정합니다.')).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: '보관' }));
    expect(screen.getByRole('dialog', { name: '급여 통장 보관' })).toBeVisible();
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '취소' }));
    expect(within(dialog).getByRole('textbox', { name: '표시 이름' })).toHaveValue('급여 통장');
    expect(within(dialog).queryByRole('button', { name: '연결 추가' })).not.toBeInTheDocument();
  });

  it('confirms the refreshed Main basis through the explicit stale-map action without changing transfers', async () => {
    const refreshedMain = { ...salaryLivingBrokerageFixture().main, updatedAt: 30 };
    const setup = flowRepositories(refreshedMain);
    const appliedBefore = setup.current().accountMap.applied;
    if (appliedBefore?.schemaVersion !== 3) throw new Error('expected account-flow fixture');
    const transfersBefore = structuredClone(appliedBefore.transfers);
    render(<AccountMapApp repositories={setup.repositories} />);

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('확인 필요');
    fireEvent.click(within(notice).getByRole('button', { name: '현재 Main 기준으로 확인' }));

    await waitFor(() => expect(setup.save).toHaveBeenCalledWith(1, { type: 'confirm-current-main' }));
    await waitFor(() => expect(screen.queryByText('확인 필요')).not.toBeInTheDocument());
    const appliedAfter = setup.current().accountMap.applied;
    expect(appliedAfter).toMatchObject({ sourceMainUpdatedAt: 30 });
    if (appliedAfter?.schemaVersion !== 3) throw new Error('expected account-flow fixture');
    expect(appliedAfter.transfers).toEqual(transfersBefore);
  });

  it('keeps the stale map unchanged and explains a rejected Main confirmation', async () => {
    const refreshedMain = { ...salaryLivingBrokerageFixture().main, updatedAt: 30, monthlyLivingWon: 800_000 };
    const setup = flowRepositories(refreshedMain);
    const before = structuredClone(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);

    fireEvent.click(screen.getByRole('button', { name: '현재 Main 기준으로 확인' }));

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('현재 Main 기준으로 확인하지 못했습니다.'));
    expect(screen.getByText('확인 필요')).toBeVisible();
    expect(setup.current()).toEqual(before);
  });

  it('reviews latest after a completed transfer conflict, retains input and retries on the new revision', async () => {
    const setup = flowRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    openSalaryDetail();
    fireEvent.click(within(screen.getByLabelText('급여 통장 월 계획 흐름')).getByRole('button', { name: '흐름 편집' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '950000' } });
    setup.current().revision = 2;
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible());
    expect(within(dialog).getByRole('textbox', { name: '월 이체 금액' })).toHaveValue('950,000');
    fireEvent.click(within(dialog).getByRole('button', { name: '최신 상태에서 다시 검토' }));
    expect(setup.current().revision).toBe(2);
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap.applied).toMatchObject({ transfers: expect.arrayContaining([
      expect.objectContaining({ id: 'salary-living', allocation: { kind: 'fixed', monthlyAmountWon: 950_000 } }),
    ]) });
    expect(setup.current().revision).toBe(3);
  });

  it('deletes a completed transfer only after explicit latest-state review on conflict', async () => {
    const setup = flowRepositories();
    const before = protectedSlices(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);
    openSalaryDetail();
    fireEvent.click(within(screen.getByLabelText('급여 통장 월 계획 흐름')).getByRole('button', { name: '흐름 편집' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    setup.current().revision = 2;
    fireEvent.click(within(dialog).getByRole('button', { name: '흐름 삭제' }));
    await waitFor(() => expect(within(dialog).getByRole('button', { name: '최신 상태에서 다시 검토' })).toBeVisible());
    fireEvent.click(within(dialog).getByRole('button', { name: '최신 상태에서 다시 검토' }));
    expect(setup.current().accountMap.applied).toMatchObject({ transfers: expect.arrayContaining([expect.objectContaining({ id: 'salary-living' })]) });
    fireEvent.click(within(dialog).getByRole('button', { name: '흐름 삭제' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap.applied).toMatchObject({ transfers: [expect.objectContaining({ id: 'living-brokerage' })] });
    expect(protectedSlices(setup.current())).toEqual(before);
  });

  it.each([2, 3] as const)('repairs v%s fixed purpose excess after a lower Main value and then explicitly confirms Main', async (schemaVersion) => {
    const setup = flowRepositories({ ...salaryLivingBrokerageFixture().main, updatedAt: 30, monthlyLivingWon: 800_000 });
    if (schemaVersion === 2) {
      const applied = setup.current().accountMap.applied;
      if (applied?.schemaVersion !== 3) throw new Error('expected flow fixture');
      const { transfers: _transfers, ...legacy } = applied;
      setup.current().accountMap.applied = { ...legacy, schemaVersion: 2 };
    }
    const before = protectedSlices(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '현재 Main 기준으로 확인' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeVisible());
    fireEvent.click(screen.getByRole('button', { name: '생활비 배정 관리' }));
    const dialog = screen.getByRole('dialog', { name: '생활비 편집' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '생활비 통장 월 금액' }), { target: { value: '800000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('확인 필요')).toBeVisible();
    expect(setup.current().accountMap.applied).toMatchObject({ sourceMainUpdatedAt: 10, links: expect.arrayContaining([
      expect.objectContaining({ id: 'living-local', monthlyAmountWon: 800_000 }),
    ]) });
    fireEvent.click(screen.getByRole('button', { name: '현재 Main 기준으로 확인' }));
    await waitFor(() => expect(screen.queryByText('확인 필요')).not.toBeInTheDocument());
    expect(protectedSlices(setup.current())).toEqual(before);
  });

  it('keeps suspended transfers reachable and resumes them through the completed flow editor', async () => {
    const setup = flowRepositories();
    const applied = setup.current().accountMap.applied;
    if (applied?.schemaVersion !== 3) throw new Error('expected flow fixture');
    applied.transfers[0] = { ...applied.transfers[0]!, status: 'suspended', suspendedReason: 'user' };
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '급여 통장 → 생활비 통장 흐름 관리' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '연결 상태' }), { target: { value: 'active' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap.applied).toMatchObject({ transfers: expect.arrayContaining([expect.objectContaining({ id: 'salary-living', status: 'active' })]) });
  });

  it('adds a custom purpose and a new cash location from completed allocation management', async () => {
    const setup = flowRepositories();
    const before = protectedSlices(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '생활비 배정 관리' }));
    const allocation = screen.getByRole('dialog', { name: '생활비 편집' });
    fireEvent.change(within(allocation).getByRole('textbox', { name: '생활비 통장 월 금액' }), { target: { value: '800000' } });
    fireEvent.click(within(allocation).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '세부 목적 추가' }));
    const create = screen.getByRole('dialog', { name: '세부 목적 추가' });
    fireEvent.change(within(create).getByRole('textbox', { name: '목적 이름' }), { target: { value: '교통비' } });
    fireEvent.change(within(create).getByRole('textbox', { name: '월 금액' }), { target: { value: '100000' } });
    fireEvent.click(within(create).getByRole('button', { name: '추가' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '교통비 배정 관리' }));
    const dialog = screen.getByRole('dialog', { name: '교통비 편집' });
    fireEvent.click(within(dialog).getByRole('button', { name: '연결 추가' }));
    fireEvent.click(within(dialog).getByRole('button', { name: /새 계좌·보관처 추가/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: '현금' }));
    fireEvent.change(within(dialog).getByRole('textbox', { name: '표시 이름' }), { target: { value: '교통 지갑' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '완료' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().locations).toEqual(expect.arrayContaining([expect.objectContaining({ shortName: '교통 지갑', kind: 'cash' })]));
    const purpose = setup.current().accountMap.applied!.customPurposes.find(({ name }) => name === '교통비');
    expect(setup.current().accountMap.applied!.links).toEqual(expect.arrayContaining([expect.objectContaining({ purposeId: purpose!.id, monthlyAmountWon: 100_000 })]));
    fireEvent.click(screen.getByRole('button', { name: '교통비 배정 관리' }));
    const edit = screen.getByRole('dialog', { name: '교통비 편집' });
    fireEvent.change(within(edit).getByRole('textbox', { name: '표시 이름' }), { target: { value: '대중교통' } });
    fireEvent.change(within(edit).getByRole('textbox', { name: '월 목표 금액' }), { target: { value: '90000' } });
    fireEvent.change(within(edit).getByRole('textbox', { name: '교통 지갑 월 금액' }), { target: { value: '90000' } });
    fireEvent.click(within(edit).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap.applied!.customPurposes).toEqual(expect.arrayContaining([expect.objectContaining({ id: purpose!.id, name: '대중교통', targetMonthlyWon: 90_000 })]));
    expect(protectedSlices(setup.current())).toEqual(before);
  });

  it('keeps the latest transfer after a conflict without replaying the local input', async () => {
    const setup = flowRepositories();
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '급여 통장 → 생활비 통장 흐름 관리' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '950000' } });
    setup.current().revision = 2;
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    fireEvent.click(await within(dialog).findByRole('button', { name: '최신 값 유지' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().revision).toBe(2);
    expect(setup.current().accountMap.applied).toMatchObject({ transfers: expect.arrayContaining([expect.objectContaining({ id: 'salary-living', allocation: { kind: 'fixed', monthlyAmountWon: 900_000 } })]) });
    fireEvent.click(screen.getByRole('button', { name: '급여 통장 → 생활비 통장 흐름 관리' }));
    expect(screen.getByRole('textbox', { name: '월 이체 금액' })).toHaveValue('900,000');
  });

  it('immediately makes a restored custom purpose reachable without reloading the map', async () => {
    const setup = flowRepositories();
    setup.current().accountMap.applied!.customPurposes = [{ id: 'custom:transport', parentId: 'system:living', name: '교통비', targetMonthlyWon: 100_000, archivedAt: 10, createdAt: 1, updatedAt: 10 }];
    setup.current().accountMap.applied!.links.find(({ id }) => id === 'living-local')!.monthlyAmountWon = 800_000;
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /교통비 · 생활비/ }));
    const dialog = screen.getByRole('dialog', { name: '교통비 복원' });
    fireEvent.click(within(dialog).getByRole('button', { name: '목적 복원' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '교통비 배정 관리' })).toBeVisible();
  });

  it('explains structural rejection, preserves the source and allows correcting the transfer', async () => {
    const setup = flowRepositories();
    const before = structuredClone(setup.current());
    render(<AccountMapApp repositories={setup.repositories} />);
    openSalaryDetail();
    fireEvent.click(within(screen.getByLabelText('급여 통장 월 계획 흐름')).getByRole('button', { name: '연결 추가' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: '받는 계좌' }), { target: { value: 'living' } });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '110000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(within(dialog).getByRole('alert')).toHaveTextContent('같은 두 계좌'));
    expect(setup.current()).toEqual(before);
    expect(within(dialog).getByRole('textbox', { name: '월 이체 금액' })).toHaveValue('110,000');
    fireEvent.change(within(dialog).getByRole('combobox', { name: '받는 계좌' }), { target: { value: 'brokerage' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().accountMap.applied).toMatchObject({ transfers: expect.arrayContaining([expect.objectContaining({ sourceLocationId: 'salary', targetLocationId: 'brokerage' })]) });
  });

  it('disables editing, deletion and dismissal while a completed transfer write is pending', async () => {
    const setup = flowRepositories();
    const originalSave = setup.repositories.accountMap.save;
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    setup.repositories.accountMap.save = async (revision, command) => { await held; return originalSave(revision, command); };
    render(<AccountMapApp repositories={setup.repositories} />);
    fireEvent.click(screen.getByRole('button', { name: '급여 통장 → 생활비 통장 흐름 관리' }));
    const dialog = screen.getByRole('dialog', { name: '계좌 흐름 편집' });
    fireEvent.change(within(dialog).getByRole('textbox', { name: '월 이체 금액' }), { target: { value: '950000' } });
    fireEvent.click(within(dialog).getByRole('button', { name: '저장' }));
    expect(within(dialog).getByRole('button', { name: '저장' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: '흐름 삭제' })).toBeDisabled();
    expect(dialog).toHaveFocus();
    expect(fireEvent.keyDown(dialog, { key: 'Tab' })).toBe(false);
    expect(fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })).toBe(false);
    expect(within(dialog).getByRole('button', { name: '닫기' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(dialog).toBeInTheDocument();
    release();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(setup.current().revision).toBe(2);
  });
});

function openSalaryDetail(): void {
  fireEvent.click(screen.getByRole('button', { name: /계좌 급여 통장/ }));
}

function flowRepositories(currentMain = salaryLivingBrokerageFixture().main): { repositories: { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository }; save: ReturnType<typeof vi.fn>; current(): WorkspaceDocument } {
  const fixture = salaryLivingBrokerageFixture();
  let workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.updatedAt = 10;
  workspace.main.applied = currentMain;
  workspace.locations = fixture.locations.map((location) => ({
    ...location,
    roles: location.id === 'salary' ? ['income'] : location.id === 'living' ? ['spending'] : ['investing'],
  }));
  workspace.accountMap.applied = fixture.applied;
  const save = vi.fn(async (revision: number, command: Parameters<AccountMapRepository['save']>[1]) => {
    if (revision !== workspace.revision) return { status: 'conflict' as const, currentRevision: workspace.revision };
    const applied = applyAccountMapCommand(workspace, command, 20 + revision);
    if (!applied.ok) return { status: 'rejected' as const, reason: applied.reason };
    workspace = { ...applied.workspace, revision: revision + 1 };
    return { status: 'saved' as const, workspace };
  });
  const accountMap: AccountMapRepository = {
    load: vi.fn(() => ({ status: 'found' as const, workspace, needsMigration: false })),
    save, saveIntent: vi.fn(), migrate: vi.fn(), reset: (revision) => save(revision, { type: 'reset-map' }),
  };
  const main: AccountMapMainSourceRepository = { load: vi.fn(() => ({ status: 'found' as const, data: currentMain })) };
  return { repositories: { accountMap, main }, save, current: () => workspace };
}

function protectedSlices(workspace: WorkspaceDocument) {
  return structuredClone({ main: workspace.main, simulation: workspace.simulation, portfolio: workspace.portfolio });
}
