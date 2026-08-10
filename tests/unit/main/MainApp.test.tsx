import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MainData, SetupStep } from '../../../src/main/domain/model';
import {
  BrowserMainRepository,
  type MainLoadResult,
  type MainRepository,
} from '../../../src/main/infrastructure/mainRepository';
import {
  BrowserWorkspaceRepository,
  type WorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';
import {
  WORKSPACE_STORAGE_KEY,
  type WorkspaceDocument,
} from '../../../src/workspace/domain/model';
import type {
  WorkspaceSaveGuard,
  WorkspaceSaveLock,
} from '../../../src/workspace/infrastructure/workspaceSaveLock';
import { MainApp, setupStepForIssue } from '../../../src/main/ui/MainApp';
import { MemoryStorage } from '../simulation/MemoryStorage';

vi.mock('../../../src/main/ui/setup/SetupFlow', () => ({
  SetupFlow: ({
    draft,
    step,
    saving,
    onChange,
    onStepChange,
    onApply,
    onCancel,
    notice,
  }: {
    draft: MainData;
    step: SetupStep;
    saving: boolean;
    onChange(draft: MainData): void;
    onStepChange(step: SetupStep): void;
    onApply(): void;
    onCancel?: () => void;
    notice?: ReactNode;
  }) => (
    <section aria-label="setup-flow" className="setup-flow-surface">
      {notice}
      <h1>{`setup:${step}`}</h1>
      <output>{draft.monthlyNetIncomeWon}</output>
      <button
        type="button"
        disabled={saving}
        onClick={() => onChange({ ...draft, monthlyNetIncomeWon: 4_000_000 })}
      >
        change-income
      </button>
      <button type="button" disabled={saving} onClick={() => onStepChange('housing')}>
        next-housing
      </button>
      <button type="button" disabled={saving} onClick={onApply}>apply-setup</button>
      {onCancel ? <button type="button" aria-label="설정 취소" onClick={onCancel}>취소</button> : null}
    </section>
  ),
}));

vi.mock('../../../src/main/ui/dashboard/SummaryDashboard', () => ({
  SummaryDashboard: ({
    applied,
    draft,
    onDraftChange,
    onApply,
    onCancel,
    backupStatus,
    journeyEntry,
    initialFocusPath,
  }: {
    applied: MainData;
    draft: MainData;
    onDraftChange(draft: MainData): void;
    onApply(): void;
    onCancel(): void;
    backupStatus?: { kind: 'success' | 'error'; message: string } | null;
    journeyEntry?: ReactNode;
    initialFocusPath?: keyof MainData;
  }) => (
    <section aria-label="dashboard">
      <h1>dashboard</h1>
      <output aria-label="applied-income">{applied.monthlyNetIncomeWon}</output>
      <output aria-label="draft-income">{draft.monthlyNetIncomeWon}</output>
      <button type="button" onClick={() => onDraftChange({ ...draft, monthlyNetIncomeWon: 4_000_000 })}>
        edit-draft
      </button>
      <button type="button" onClick={onApply}>apply-dashboard</button>
      <button type="button" onClick={onCancel}>cancel-dashboard</button>
      {journeyEntry}
      {initialFocusPath ? <output aria-label="initial-focus-path">{initialFocusPath}</output> : null}
      {backupStatus === null || backupStatus === undefined ? null : (
        <p role={backupStatus.kind === 'error' ? 'alert' : 'status'}>{backupStatus.message}</p>
      )}
    </section>
  ),
}));

beforeEach(() => {
  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});

function data(monthlyNetIncomeWon: number, overrides: Partial<MainData> = {}): MainData {
  return {
    schemaVersion: 2,
    updatedAt: 1,
    monthlyNetIncomeWon,
    monthlyHousingWon: 900_000,
    monthlyLivingWon: 700_000,
    monthlySavingWon: 500_000,
    monthlyInvestmentWon: 400_000,
    ...overrides,
  };
}

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function workspace(monthlyNetIncomeWon: number, revision = 1): WorkspaceDocument {
  const applied = data(monthlyNetIncomeWon, { updatedAt: 100 });
  return {
    schemaVersion: 1,
    revision,
    updatedAt: 500,
    main: { applied, setupProgress: null },
    simulation: {
      draft: {
        schemaVersion: 2,
        source: {
          monthlySavingsWon: applied.monthlySavingWon,
          monthlyInvestmentWon: applied.monthlyInvestmentWon,
          mainUpdatedAt: applied.updatedAt,
        },
        initialInvestmentWon: 2_000_000,
        years: 20,
        expectedAnnualReturnPercent: 8,
        baseRatePercent: 2.5,
        inflationOffsetPercentPoints: -0.5,
        amountMode: 'nominal',
        updatedAt: 200,
      },
    },
    portfolio: {
      plans: [{
        schemaVersion: 2,
        scope: { type: 'location', locationId: 'loc-isa' },
        items: [{ id: 'asset-us', name: '미국 인덱스', shareUnits: 700_000, order: 0 }],
        cashShareUnits: 300_000,
        cashMode: 'automatic',
        syncedInvestmentWon: applied.monthlyInvestmentWon,
        appliedAt: 300,
        updatedAt: 300,
      }],
      draft: null,
    },
    locations: [{
      id: 'loc-isa',
      shortName: 'ISA',
      kind: 'brokerage',
      roles: ['investing'],
      createdAt: 10,
      updatedAt: 20,
    }],
    accountMap: { applied: null, draft: null, instruments: [], flows: [] },
  };
}

function backupFile(value: unknown): File {
  return new File([JSON.stringify(value)], 'workspace.json', { type: 'application/json' });
}

function backupEnvelope(value: WorkspaceDocument): unknown {
  return {
    format: 'isf-workspace-backup',
    formatVersion: 1,
    exportedAt: 900,
    workspace: value,
  };
}

function repository(result: MainLoadResult): MainRepository {
  return {
    load: async () => result,
    save: async (draft) => draft,
    saveSetupProgress: async () => undefined,
    loadSetupProgress: () => null,
    clearSetupProgress: async () => undefined,
    resetInvalidWorkspace: async () => undefined,
  };
}

describe('setupStepForIssue', () => {
  it.each([
    ['monthlyNetIncomeWon', 'income'],
    ['monthlyHousingWon', 'housing'],
    ['monthlyLivingWon', 'living'],
    ['monthlySavingWon', 'saving-investment'],
    ['monthlyInvestmentWon', 'saving-investment'],
  ] as const)('routes %s validation to %s', (path, expected) => {
    expect(setupStepForIssue(path)).toBe(expected);
  });

  it('does not invent a setup route for an unknown issue', () => {
    expect(setupStepForIssue('unknown')).toBeNull();
    expect(setupStepForIssue(undefined)).toBeNull();
  });
});

describe('MainApp', () => {
  it('exports the current whole workspace from the management menu', async () => {
    const storage = new MemoryStorage();
    const current = workspace(3_000_000, 7);
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    const workspaceRepository = new BrowserWorkspaceRepository(storage, {
      saveLock: testSerialLock(),
      now: () => 800,
    });
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:workspace-backup');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<MainApp
      repository={new BrowserMainRepository(workspaceRepository)}
      workspaceRepository={workspaceRepository}
    />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByText(/모든 앱 데이터를 한 번에 백업하고 복원/)).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: '백업 내보내기' }));

    const blob = createObjectURL.mock.calls[0]?.[0];
    const parsed = JSON.parse(await readBlob(blob as Blob));
    expect(parsed).toMatchObject({
      format: 'isf-workspace-backup',
      formatVersion: 1,
      workspace: current,
    });
    expect(Object.keys(parsed).sort()).toEqual(['exportedAt', 'format', 'formatVersion', 'workspace']);
  });

  it('confirms and atomically restores all slices before reloading Main', async () => {
    const storage = new MemoryStorage();
    const current = workspace(3_000_000, 7);
    const imported = workspace(4_000_000, 99);
    const oldRaw = '{old-main-record';
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(current));
    storage.setItem('isf-main-v2', oldRaw);
    const workspaceRepository = new BrowserWorkspaceRepository(storage, {
      saveLock: testSerialLock(),
      now: () => 800,
    });
    const setItem = vi.spyOn(storage, 'setItem');
    render(<MainApp
      repository={new BrowserMainRepository(workspaceRepository, () => 800)}
      workspaceRepository={workspaceRepository}
    />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.change(screen.getByLabelText('백업 가져오기'), {
      target: { files: [backupFile(backupEnvelope(imported))] },
    });

    expect(await screen.findByRole('heading', { name: '모든 앱 데이터를 이 백업으로 바꿀까요?' })).toBeVisible();
    expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(JSON.stringify(current));
    fireEvent.click(screen.getByRole('button', { name: '백업으로 바꾸기' }));

    expect(await screen.findByLabelText('applied-income')).toHaveTextContent('4000000');
    expect(screen.getByText('모든 앱 데이터를 백업에서 복원했습니다.')).toBeVisible();
    const saved = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(saved.revision).toBe(8);
    expect(saved.main).toEqual(imported.main);
    expect(saved.simulation).toEqual(imported.simulation);
    expect(saved.portfolio).toEqual(imported.portfolio);
    expect(saved.locations).toEqual(imported.locations);
    expect(saved.accountMap).toEqual(imported.accountMap);
    expect(setItem.mock.calls.filter(([key]) => key === WORKSPACE_STORAGE_KEY)).toHaveLength(1);
    expect(storage.getItem('isf-main-v2')).toBe(oldRaw);
    await waitFor(() => expect(screen.getByRole('button', { name: '관리 메뉴' })).toHaveFocus());
  });

  it('rejects invalid and old Main-only imports without changing the raw workspace', async () => {
    const storage = new MemoryStorage();
    const current = workspace(3_000_000, 7);
    const raw = JSON.stringify(current);
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    const workspaceRepository = new BrowserWorkspaceRepository(storage, {
      saveLock: testSerialLock(),
    });
    render(<MainApp
      repository={new BrowserMainRepository(workspaceRepository)}
      workspaceRepository={workspaceRepository}
    />);
    await screen.findByRole('heading', { name: 'dashboard' });

    for (const file of [
      new File(['{bad'], 'invalid.json', { type: 'application/json' }),
      backupFile(data(9_000_000)),
    ]) {
      fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
      fireEvent.change(screen.getByLabelText('백업 가져오기'), { target: { files: [file] } });
      expect(await screen.findByRole('alert')).toHaveTextContent('현재 데이터는 바뀌지 않았습니다.');
      expect(storage.getItem(WORKSPACE_STORAGE_KEY)).toBe(raw);
      expect(screen.queryByRole('heading', { name: '모든 앱 데이터를 이 백업으로 바꿀까요?' })).not.toBeInTheDocument();
    }
  });

  it('uses the current revision token and reports a no-change replace conflict', async () => {
    const current = workspace(3_000_000, 7);
    const imported = workspace(4_000_000, 99);
    const replace = vi.fn<WorkspaceRepository['replace']>(async () => ({
      status: 'conflict',
      currentRevision: 8,
    }));
    const workspaceRepository: Pick<WorkspaceRepository, 'load' | 'replace'> = {
      load: () => ({ status: 'found', workspace: current }),
      replace,
    };
    render(<MainApp
      repository={repository({ status: 'current', data: current.main.applied!, original: null })}
      workspaceRepository={workspaceRepository}
    />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.change(screen.getByLabelText('백업 가져오기'), {
      target: { files: [backupFile(backupEnvelope(imported))] },
    });
    await screen.findByRole('heading', { name: '모든 앱 데이터를 이 백업으로 바꿀까요?' });
    fireEvent.click(screen.getByRole('button', { name: '백업으로 바꾸기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('다른 탭에서 데이터가 변경되었습니다. 현재 데이터는 바뀌지 않았습니다.');
    expect(replace).toHaveBeenCalledWith(7, imported);
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('3000000');
  });

  it('offers dashboard backup and restart actions from the management menu', async () => {
    render(<MainApp repository={repository({ status: 'current', data: data(3_000_000), original: null })} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('menuitem', { name: '백업 내보내기' })).toBeVisible();
    expect(screen.getByLabelText('백업 가져오기')).toBeVisible();
    fireEvent.click(screen.getByRole('menuitem', { name: '처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 시작' }));

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
  });

  it('consumes a Portfolio investment edit intent once', async () => {
    window.history.replaceState(null, '', '/apps/main/?edit=investment');
    render(<MainApp repository={repository({ status: 'current', data: data(3_000_000), original: null })} />);
    await screen.findByRole('heading', { name: 'dashboard' });
    expect(screen.getByLabelText('initial-focus-path')).toHaveTextContent('monthlyInvestmentWon');
    expect(window.location.search).toBe('');
  });

  it('opens Simulation without writing a journey snapshot', async () => {
    const navigate = vi.fn();
    render(<MainApp
      repository={repository({ status: 'current', data: data(3_000_000), original: null })}
      navigate={navigate}
    />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'Simulation으로 이어가기' }));

    expect(navigate).toHaveBeenCalledWith(expect.stringContaining('/apps/simulation/'));
    expect(localStorage.getItem('isf-journey-snapshot-v1')).toBeNull();
  });

  it('hides navigation and journey actions during first setup', async () => {
    render(<MainApp repository={repository({ status: 'empty', data: null, original: null })} />);

    await screen.findByRole('heading', { name: 'setup:welcome' });

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simulation으로 이어가기' })).not.toBeInTheDocument();
  });

  it('shows loading until bootstrap finishes and then starts setup at welcome', async () => {
    let resolveLoad: ((value: MainLoadResult) => void) | undefined;
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.load = () => new Promise((resolve) => {
      resolveLoad = resolve;
    });

    render(<MainApp repository={storage} />);

    expect(screen.getByRole('status')).toHaveTextContent('자금 계획을 불러오는 중');
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByLabelText('백업 가져오기')).toBeDisabled();
    resolveLoad?.({ status: 'empty', data: null, original: null });

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
  });

  it('persists progress before moving to a v2 setup stage', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'next-housing' }));

    expect(await screen.findByRole('heading', { name: 'setup:housing' })).toBeVisible();
    expect(storage.saveSetupProgress).toHaveBeenCalledWith(
      'housing',
      expect.objectContaining({ schemaVersion: 2, monthlyNetIncomeWon: 0 }),
      'initial',
    );
  });

  it('routes failed scalar validation to its setup stage', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'apply-setup' }));

    expect(await screen.findByRole('heading', { name: 'setup:income' })).toBeVisible();
    expect(storage.saveSetupProgress).toHaveBeenCalledWith(
      'income',
      expect.objectContaining({ schemaVersion: 2, monthlyNetIncomeWon: 0 }),
      'initial',
    );
  });

  it('keeps applied and pending v2 data separate in recovery', async () => {
    render(<MainApp repository={repository({
      status: 'recovery',
      current: data(3_000_000),
      data: data(4_000_000),
      original: { pending: true },
      source: 'pending',
    })} />);

    expect(await screen.findByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByLabelText('백업 가져오기')).toBeDisabled();
    expect(screen.getByText('현재 적용 중 · 300만 원')).toBeVisible();
    expect(screen.getByText('저장 대기 중 · 400만 원')).toBeVisible();
    expect(screen.getByRole('heading', { name: '저장 복구가 필요합니다' }).closest('section')).toHaveClass('ui-surface');
    for (const name of ['기존 원본 JSON 다운로드', '저장 다시 시도', '복구 초안 버리기', '현재 계획으로 돌아가기']) {
      expect(screen.getByRole('button', { name })).toHaveClass('ui-button');
    }
  });

  it('downloads the exact invalid workspace raw from recovery', async () => {
    const raw = '{malformed-workspace';
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:workspace-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<MainApp repository={repository({
      status: 'failed',
      data: null,
      original: raw,
      raw,
      source: 'current',
      reason: 'Stored workspace data is invalid.',
    })} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '기존 원본 JSON 다운로드' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]?.[0];
    expect(blob).toBeInstanceOf(Blob);
    await expect(readBlob(blob as Blob)).resolves.toBe(raw);
  });

  it('downloads, explicitly resets, applies, and reloads an invalid workspace with production repositories', async () => {
    const raw = '{malformed-workspace';
    const oldRaw = JSON.stringify({ schemaVersion: 2, monthlyNetIncomeWon: 9_999_999 });
    const storage = new MemoryStorage();
    storage.setItem(WORKSPACE_STORAGE_KEY, raw);
    storage.setItem('isf-main-v2', oldRaw);
    const workspaceRepository = new BrowserWorkspaceRepository(storage, {
      saveLock: testSerialLock(),
      now: () => 200,
    });
    const mainRepository = new BrowserMainRepository(workspaceRepository, () => 300);
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:workspace-recovery');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const first = render(<MainApp repository={mainRepository} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '기존 원본 JSON 다운로드' }));
    const blob = createObjectURL.mock.calls[0]?.[0];
    await expect(readBlob(blob as Blob)).resolves.toBe(raw);
    fireEvent.click(screen.getByRole('button', { name: '빈 초안으로 다시 시작' }));
    await screen.findByRole('heading', { name: 'setup:welcome' });
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    fireEvent.click(screen.getByRole('button', { name: 'apply-setup' }));
    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('4000000');
    first.unmount();

    render(<MainApp repository={new BrowserMainRepository(
      new BrowserWorkspaceRepository(storage, { saveLock: testSerialLock(), now: () => 400 }),
      () => 400,
    )} />);

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('4000000');
    expect(storage.getItem('isf-main-v2')).toBe(oldRaw);
  });

  it('stays in recovery when the exact invalid workspace can no longer be reset', async () => {
    const raw = '{malformed-workspace';
    const storage = repository({
      status: 'failed',
      data: null,
      original: raw,
      raw,
      source: 'current',
      reason: 'Stored workspace data is invalid.',
    });
    storage.resetInvalidWorkspace = vi.fn(async () => {
      throw new Error('workspace changed');
    });
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '빈 초안으로 다시 시작' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.getByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();
    expect(storage.resetInvalidWorkspace).toHaveBeenCalledWith(raw);
  });

  it('retries a pending v2 recovery candidate only after explicit confirmation', async () => {
    const storage = repository({
      status: 'recovery',
      current: data(3_000_000),
      data: data(4_000_000),
      original: { pending: true },
      source: 'pending',
    });
    storage.save = vi.fn(async (draft) => ({ ...draft, updatedAt: 30 }));
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });
    expect(storage.save).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '저장 다시 시도' }));

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('4000000');
    expect(storage.save).toHaveBeenCalledWith(expect.objectContaining({
      schemaVersion: 2,
      monthlyNetIncomeWon: 4_000_000,
    }));
  });

  it('discards a pending-only recovery candidate and returns to empty setup', async () => {
    const pending = data(4_000_000);
    const storage = repository({
      status: 'recovery',
      current: null,
      data: pending,
      original: { pending: true },
      source: 'pending',
    });
    storage.clearSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '복구 초안 버리기' }));

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(storage.clearSetupProgress).toHaveBeenCalledOnce();
  });

  it('returns from recovery to the unchanged applied v2 plan', async () => {
    const pending = data(4_000_000);
    const storage = repository({
      status: 'recovery',
      current: data(3_000_000),
      data: pending,
      original: { history: true },
      source: 'history',
    });
    storage.clearSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '현재 계획으로 돌아가기' }));

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('3000000');
    expect(storage.clearSetupProgress).toHaveBeenCalledOnce();
  });

  it('keeps the applied plan when saving a changed draft is rejected', async () => {
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.save = vi.fn(async () => {
      throw new Error('quota');
    });
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'edit-draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'apply-dashboard' }));

    expect(await screen.findByLabelText('applied-income')).toHaveTextContent('3000000');
    expect(screen.getByLabelText('draft-income')).toHaveTextContent('4000000');
  });

  it('preserves a setup draft and offers an explicit retry after save failure', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.save = vi.fn()
      .mockRejectedValueOnce(new Error('quota'))
      .mockImplementationOnce(async (draft: MainData) => ({ ...draft, updatedAt: 30 }));
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));

    fireEvent.click(screen.getByRole('button', { name: 'apply-setup' }));

    const saveFailure = await screen.findByRole('alert');
    expect(saveFailure).toHaveTextContent('저장하지 못했습니다');
    expect(saveFailure).toHaveClass('ui-surface');
    expect(screen.getByText('4000000')).toBeVisible();
    const retry = screen.getByRole('button', { name: '저장 다시 시도' });
    expect(retry).toHaveClass('ui-button', 'ui-button--primary');
    fireEvent.click(retry);
    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('4000000');
    expect(storage.save).toHaveBeenCalledTimes(2);
  });

  it('shows a dashboard warning when applied setup progress cannot be cleaned up', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.save = vi.fn(async (draft: MainData) => ({ ...draft, updatedAt: 30 }));
    storage.clearSetupProgress = vi.fn(async () => {
      throw new Error('quota');
    });
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));

    fireEvent.click(screen.getByRole('button', { name: 'apply-setup' }));

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.',
    );
  });

  it('cancel restores the applied data after setup progress is cleared', async () => {
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.clearSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'edit-draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel-dashboard' }));

    await waitFor(() => expect(screen.getByLabelText('draft-income')).toHaveTextContent('3000000'));
    expect(storage.clearSetupProgress).toHaveBeenCalledOnce();
  });

  it('focuses restart setup without journey navigation and restores it on cancel', async () => {
    const applied = data(3_000_000);
    const storage = repository({ status: 'current', data: applied, original: {} });
    storage.saveSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 시작' }));

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simulation으로 이어가기' })).not.toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: '설정 취소' });
    expect(cancel.closest('.setup-flow-surface')).not.toBeNull();
    expect(screen.getByText('3000000')).toBeVisible();
    expect(storage.saveSetupProgress).toHaveBeenCalledWith('welcome', applied, 'restart');

    fireEvent.click(cancel);

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeEnabled();
  });

  it('keeps restart setup visible until a delayed progress save and queued clear both finish', async () => {
    const applied = data(3_000_000);
    let progress: ReturnType<MainRepository['loadSetupProgress']> = {
      kind: 'restart' as const,
      step: 'welcome' as const,
      draft: applied,
      savedAt: 2,
    };
    let releaseProgress: (() => void) | undefined;
    const progressGate = new Promise<void>((resolve) => {
      releaseProgress = resolve;
    });
    const storage = repository({ status: 'current', data: applied, original: applied });
    storage.loadSetupProgress = () => progress;
    storage.saveSetupProgress = vi.fn(async (step, draft) => {
      await progressGate;
      progress = { kind: 'restart', step, draft: { ...draft }, savedAt: 3 };
    });
    storage.clearSetupProgress = vi.fn(async () => {
      progress = null;
    });
    const first = render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: '설정 취소' }));
    await Promise.resolve();

    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(storage.clearSetupProgress).not.toHaveBeenCalled();
    releaseProgress?.();
    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(storage.clearSetupProgress).toHaveBeenCalledOnce();
    first.unmount();
    render(<MainApp repository={storage} />);
    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
  });

  it('does not complete restart cancel when setup-progress clear rejects', async () => {
    const applied = data(3_000_000);
    const progress = {
      kind: 'restart' as const,
      step: 'welcome' as const,
      draft: applied,
      savedAt: 2,
    };
    const storage = repository({ status: 'current', data: applied, original: applied });
    storage.loadSetupProgress = () => progress;
    storage.clearSetupProgress = vi.fn(async () => {
      throw new Error('quota');
    });
    const first = render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: '설정 취소' }));

    expect(await screen.findByText(
      '설정 진행 상황을 정리하지 못했습니다. 저장된 계획에는 영향이 없습니다.',
    )).toBeVisible();
    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    first.unmount();
    render(<MainApp repository={storage} />);
    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
  });

  it('keeps setup editing available when progress persistence fails', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn(async () => {
      throw new Error('quota');
    });
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));

    expect(screen.getByText('4000000')).toBeVisible();
    expect(await screen.findByText('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.')).toBeVisible();
    expect(screen.getByText('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.')
      .closest('.setup-flow-surface')).not.toBeNull();
  });

  it('waits for the latest setup-progress write before applying the draft', async () => {
    let releaseProgress: (() => void) | undefined;
    const progressGate = new Promise<void>((resolve) => {
      releaseProgress = resolve;
    });
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn(() => progressGate);
    storage.save = vi.fn(async (draft: MainData) => ({ ...draft, updatedAt: 30 }));
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: 'apply-setup' }));
    await Promise.resolve();

    expect(storage.save).not.toHaveBeenCalled();
    releaseProgress?.();
    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(storage.save).toHaveBeenCalledOnce();
  });
});

function testSerialLock(): WorkspaceSaveLock {
  return {
    async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
      return await task({ assertOwned: () => undefined });
    },
  };
}
