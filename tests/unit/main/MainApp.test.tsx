import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEmptyMainData, type MainData, type SetupStep } from '../../../src/main/domain/model';
import {
  BrowserMainRepository,
  type MainLoadResult,
  type MainRepository,
} from '../../../src/main/infrastructure/mainRepository';
import {
  BrowserWorkspaceRepository,
} from '../../../src/workspace/infrastructure/workspaceRepository';
import {
  WORKSPACE_STORAGE_KEY,
} from '../../../src/workspace/domain/model';
import type {
  WorkspaceSaveGuard,
  WorkspaceSaveLock,
} from '../../../src/workspace/infrastructure/workspaceSaveLock';
import type { ValidationIssue } from '../../../src/main/application/mainSetupCommands';
import { MainApp } from '../../../src/main/ui/MainApp';
import { MemoryStorage } from '../simulation/MemoryStorage';

const mainAppMocks = vi.hoisted(() => ({
  reducedMotion: false,
}));

vi.mock('../../../src/components/motion/useReducedMotion', () => ({
  useReducedMotion: () => mainAppMocks.reducedMotion,
}));

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
    motionPreset,
  }: {
    draft: MainData;
    step: SetupStep;
    saving: boolean;
    onChange(draft: MainData): void;
    onStepChange(step: SetupStep): void;
    onApply(): void;
    onCancel?: () => void;
    notice?: ReactNode;
    motionPreset: 'initial-assembly' | 'none';
  }) => (
    <section aria-label="setup-flow" className="setup-flow-surface" data-motion-preset={motionPreset}>
      {notice}
      <h1 ref={(heading) => heading?.focus()} data-setup-heading tabIndex={-1}>{`setup:${step}`}</h1>
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

vi.mock('../../../src/auth/BrandWelcome', () => ({
  BrandWelcome: ({onComplete}: {onComplete(): void}) => <button onClick={onComplete}>화면을 눌러 건너뛰기</button>,
}));

vi.mock('../../../src/main/ui/dashboard/SummaryDashboard', () => ({
  SummaryDashboard: ({
    applied,
    draft,
    issues,
    onDraftChange,
    onApply,
    onCancel,
    backupStatus,
    journeyEntry,
    initialFocusPath,
  }: {
    applied: MainData;
    draft: MainData;
    issues: ValidationIssue[];
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
      {issues.length === 0 ? null : (
        <output aria-label="validation-issue-count">{issues.length}</output>
      )}
      <button type="button" onClick={() => onDraftChange({ ...draft, monthlyNetIncomeWon: 4_000_000 })}>
        edit-draft
      </button>
      <button type="button" onClick={() => onDraftChange({ ...draft, monthlyNetIncomeWon: 0 })}>
        invalidate-draft
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
  mainAppMocks.reducedMotion = false;
  const storage = new MemoryStorage();
  Object.defineProperty(window, 'localStorage', { configurable: true, value: storage });
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

async function expectSetupWelcome(): Promise<void> {
  const skip = screen.queryByRole('button', {name: '화면을 눌러 건너뛰기'});
  if (skip) fireEvent.click(skip);
  expect(await screen.findByRole('heading', {name: 'setup:welcome'})).toBeVisible();
  expect(screen.queryByTestId('main-welcome-intro')).not.toBeInTheDocument();
}

describe('MainApp', () => {
  it('opens setup immediately and saves fresh welcome progress once', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn(async () => undefined);

    render(
      <StrictMode>
        <MainApp repository={storage} />
      </StrictMode>,
    );

    await expectSetupWelcome();
    expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    expect(storage.saveSetupProgress).toHaveBeenCalledWith(
      'welcome',
      expect.objectContaining({ schemaVersion: 2 }),
      'initial',
    );
    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
  });

  it('keeps setup stable when StrictMode replays bootstrap after welcome persistence', async () => {
    let progress: ReturnType<MainRepository['loadSetupProgress']> = null;
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.load = vi.fn(storage.load);
    storage.loadSetupProgress = () => progress;
    storage.saveSetupProgress = vi.fn(async (step, draft, kind = 'initial') => {
      progress = { kind, step, draft: { ...draft }, savedAt: 10 };
    });

    render(
      <StrictMode>
        <MainApp repository={storage} />
      </StrictMode>,
    );

    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    await expectSetupWelcome();
    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(storage.load).toHaveBeenCalledOnce();
  });

  it('skips mounting the intro under reduced motion and focuses only the setup heading', async () => {
    mainAppMocks.reducedMotion = true;
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn(async () => undefined);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');

    render(<MainApp repository={storage} />);

    const heading = await screen.findByRole('heading', { name: 'setup:welcome' });
    expect(screen.queryByTestId('main-welcome-intro')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '화면을 눌러 건너뛰기' })).not.toBeInTheDocument();
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    expect(storage.saveSetupProgress).toHaveBeenCalledWith(
      'welcome',
      expect.objectContaining({ schemaVersion: 2 }),
      'initial',
    );
    await waitFor(() => expect(heading).toHaveFocus());
    expect(focus.mock.instances).not.toHaveLength(0);
    expect(focus.mock.instances.every((target) => target === heading)).toBe(true);
  });

  it.each([
    [
      'initial welcome progress',
      () => {
        const storage = repository({ status: 'empty', data: null, original: null });
        storage.loadSetupProgress = () => ({
          kind: 'initial', step: 'welcome', draft: data(3_000_000), savedAt: 10,
        });
        return storage;
      },
    ],
    [
      'restart welcome progress',
      () => {
        const applied = data(3_000_000, { updatedAt: 10 });
        const storage = repository({ status: 'current', data: applied, original: null });
        storage.loadSetupProgress = () => ({
          kind: 'restart', step: 'welcome', draft: data(3_000_000, { updatedAt: 10 }), savedAt: 10,
        });
        return storage;
      },
    ],
  ])('does not mount the brand intro for persisted %s', async (_label, createRepository) => {
    render(<MainApp repository={createRepository()} />);

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.queryByTestId('main-welcome-intro')).not.toBeInTheDocument();
  });

  it('keeps setup open without an intro on rerender', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    const view = render(<MainApp repository={storage} />);

    await expectSetupWelcome();
    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();

    view.rerender(<MainApp repository={storage} />);

    expect(screen.queryByTestId('main-welcome-intro')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
  });

  it('shows a fresh-progress warning in setup when saving fails', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn(async () => {
      throw new Error('quota');
    });
    render(<MainApp repository={storage} />);

    await expectSetupWelcome();

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(await screen.findByText(
      '설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.',
    )).toBeVisible();
  });

  it('offers restart without manual backup actions from the management menu', async () => {
    render(<MainApp repository={repository({ status: 'current', data: data(3_000_000), original: null })} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.queryByRole('menuitem', { name: '백업 내보내기' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('백업 가져오기')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('menuitem', { name: '처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 시작' }));

    await expectSetupWelcome();
    await expectSetupWelcome();
    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.getByLabelText('setup-flow')).toHaveAttribute('data-motion-preset', 'initial-assembly');
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

    await expectSetupWelcome();
    await screen.findByRole('heading', { name: 'setup:welcome' });

    expect(screen.getByLabelText('setup-flow')).toHaveAttribute('data-motion-preset', 'initial-assembly');
    expect(screen.getByTestId('main-page-frame')).toHaveClass('app-content-frame');
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
    expect(screen.getByTestId('main-page-frame')).toHaveClass('app-content-frame');
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('app-shell-launcher')).not.toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '관리 메뉴' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('백업 가져오기')).not.toBeInTheDocument();
    resolveLoad?.({ status: 'empty', data: null, original: null });

    await expectSetupWelcome();
    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
  });

  it('persists progress before moving to a v2 setup stage', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await expectSetupWelcome();
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
    await expectSetupWelcome();
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
    expect(screen.queryByLabelText('백업 가져오기')).not.toBeInTheDocument();
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

  it('reports invalid-raw download failure and cleans up its temporary anchor', async () => {
    const raw = '{malformed-workspace';
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:failed-recovery');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let connectedDuringClick = false;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click(
      this: HTMLAnchorElement,
    ) {
      connectedDuringClick = this.isConnected;
      throw new Error('download blocked');
    });
    render(<MainApp repository={repository({
      status: 'failed',
      data: null,
      original: raw,
      raw,
      source: 'current',
      reason: 'Stored workspace data is invalid.',
    })} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });
    let scheduledRevoke: TimerHandler | undefined;
    vi.spyOn(window, 'setTimeout').mockImplementation(((handler: TimerHandler) => {
      scheduledRevoke = handler;
      return 1;
    }) as typeof window.setTimeout);

    fireEvent.click(screen.getByRole('button', { name: '기존 원본 JSON 다운로드' }));

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(connectedDuringClick).toBe(true);
    expect(document.querySelector('a[download="individual-savings-flow-recovery.json"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      '원본 JSON을 다운로드하지 못했습니다. 브라우저 다운로드 설정을 확인하고 다시 시도해 주세요.',
    );

    act(() => {
      if (typeof scheduledRevoke === 'function') scheduledRevoke();
    });
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:failed-recovery');
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
    expect(screen.getByTestId('main-page-frame')).toHaveClass('app-content-frame');

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
    await expectSetupWelcome();
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
    await expectSetupWelcome();
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

    await expectSetupWelcome();
    await expectSetupWelcome();
    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.getByLabelText('setup-flow')).toHaveAttribute('data-motion-preset', 'initial-assembly');
    expect(screen.queryByRole('navigation', { name: 'ISF 앱' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simulation으로 이어가기' })).not.toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: '설정 취소' });
    expect(cancel.closest('.setup-flow-surface')).not.toBeNull();
    expect(screen.getByText('3000000')).toBeVisible();
    expect(storage.saveSetupProgress).toHaveBeenCalledWith('welcome', applied, 'restart');
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    expect(screen.getByText('4000000')).toBeVisible();

    fireEvent.click(cancel);

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('3000000');
    expect(screen.getByRole('navigation', { name: 'ISF 앱' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Simulation으로 이어가기' })).toBeEnabled();
  });

  it('keeps dashboard editing out of the setup assembly journey', async () => {
    render(<MainApp repository={repository({ status: 'current', data: data(3_000_000), original: {} })} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    expect(screen.queryByLabelText('setup-flow')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'edit-draft' }));
    expect(screen.queryByLabelText('setup-flow')).not.toBeInTheDocument();
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

    expect(screen.getByRole('button', { name: 'change-income' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    expect(screen.getByText('4000000')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole('button', { name: '설정 취소' }));
    expect(screen.getByRole('heading', { name: 'setup:welcome' })).toBeVisible();
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
    await expectSetupWelcome();
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));

    expect(screen.getByText('4000000')).toBeVisible();
    expect(await screen.findByText('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.')).toBeVisible();
    expect(screen.getByText('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.')
      .closest('.setup-flow-surface')).not.toBeNull();
  });

  it('waits for the latest setup-progress write before applying the draft', async () => {
    let releaseInitialProgress: (() => void) | undefined;
    const initialProgressGate = new Promise<void>((resolve) => {
      releaseInitialProgress = resolve;
    });
    let releaseLatestProgress: (() => void) | undefined;
    const latestProgressGate = new Promise<void>((resolve) => {
      releaseLatestProgress = resolve;
    });
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn()
      .mockImplementationOnce(() => initialProgressGate)
      .mockImplementationOnce(() => latestProgressGate);
    storage.save = vi.fn(async (draft: MainData) => ({ ...draft, updatedAt: 30 }));
    render(<MainApp repository={storage} />);
    await expectSetupWelcome();
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledOnce());
    await screen.findByRole('heading', { name: 'setup:welcome' });

    releaseInitialProgress?.();

    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    await waitFor(() => expect(storage.saveSetupProgress).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'apply-setup' }));
    await Promise.resolve();

    expect(storage.save).not.toHaveBeenCalled();
    releaseLatestProgress?.();
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
