import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MainData, SetupStep } from '../../../src/main/domain/model';
import type {
  MainLoadResult,
  MainRepository,
} from '../../../src/main/infrastructure/mainRepository';
import { MainApp, setupStepForIssue } from '../../../src/main/ui/MainApp';

vi.mock('../../../src/main/ui/setup/SetupFlow', () => ({
  SetupFlow: ({
    draft,
    step,
    saving,
    onChange,
    onStepChange,
    onApply,
  }: {
    draft: MainData;
    step: SetupStep;
    saving: boolean;
    onChange(draft: MainData): void;
    onStepChange(step: SetupStep): void;
    onApply(): void;
  }) => (
    <section aria-label="setup-flow">
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
    onRestart,
    backupStatus,
  }: {
    applied: MainData;
    draft: MainData;
    onDraftChange(draft: MainData): void;
    onApply(): void;
    onCancel(): void;
    onRestart(): void;
    backupStatus?: { kind: 'success' | 'error'; message: string } | null;
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
      <button type="button" onClick={onRestart}>restart-setup</button>
      {backupStatus === null || backupStatus === undefined ? null : (
        <p role={backupStatus.kind === 'error' ? 'alert' : 'status'}>{backupStatus.message}</p>
      )}
    </section>
  ),
}));

afterEach(cleanup);

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

function repository(result: MainLoadResult): MainRepository {
  return {
    load: async () => result,
    save: async (draft) => draft,
    saveSetupProgress: () => undefined,
    loadSetupProgress: () => null,
    clearSetupProgress: () => undefined,
    discardPending: () => undefined,
    discardRecovery: () => undefined,
    acknowledgeFailedCurrent: () => undefined,
    acknowledgeFailedPending: () => undefined,
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
  it('shows loading until bootstrap finishes and then starts setup at welcome', async () => {
    let resolveLoad: ((value: MainLoadResult) => void) | undefined;
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.load = () => new Promise((resolve) => {
      resolveLoad = resolve;
    });

    render(<MainApp repository={storage} />);

    expect(screen.getByRole('status')).toHaveTextContent('자금 계획을 불러오는 중');
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
    expect(screen.getByText('현재 적용 중 · 300만 원')).toBeVisible();
    expect(screen.getByText('저장 대기 중 · 400만 원')).toBeVisible();
  });

  it('acknowledges malformed current data so setup progress resumes after reload', async () => {
    const raw = '{malformed-v2';
    let acknowledged = false;
    let progress: { kind: 'initial'; step: SetupStep; draft: MainData } | null = null;
    const storage = repository({
      status: 'failed',
      data: null,
      original: raw,
      raw,
      reason: 'Stored main data is not valid JSON.',
    });
    storage.load = async () => acknowledged
      ? { status: 'empty', data: null, original: null }
      : {
        status: 'failed',
        data: null,
        original: raw,
        raw,
        reason: 'Stored main data is not valid JSON.',
      };
    storage.acknowledgeFailedCurrent = vi.fn(() => {
      acknowledged = true;
    });
    storage.saveSetupProgress = vi.fn((step, draft) => {
      progress = { kind: 'initial', step, draft: { ...draft } };
    });
    storage.loadSetupProgress = () => progress;
    const first = render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '빈 초안으로 다시 시작' }));
    await screen.findByRole('heading', { name: 'setup:welcome' });
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    expect(screen.getByText('4000000')).toBeVisible();
    first.unmount();
    render(<MainApp repository={storage} />);

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.getByText('4000000')).toBeVisible();
    expect(screen.queryByRole('heading', { name: '저장 복구가 필요합니다' })).not.toBeInTheDocument();
    expect(storage.acknowledgeFailedCurrent).toHaveBeenCalledWith(raw);
  });

  it('acknowledges malformed pending data so setup progress resumes after reload', async () => {
    const raw = '{malformed-pending';
    let acknowledged = false;
    let progress: { kind: 'initial'; step: SetupStep; draft: MainData } | null = null;
    const failed = {
      status: 'failed',
      data: null,
      original: raw,
      raw,
      source: 'pending',
      reason: 'Stored main data is not valid JSON.',
    } satisfies MainLoadResult;
    const storage = repository(failed);
    storage.acknowledgeFailedCurrent = vi.fn();
    storage.load = async () => acknowledged
      ? { status: 'empty', data: null, original: null }
      : failed;
    const acknowledgeFailedPending = vi.fn(() => {
      acknowledged = true;
    });
    storage.acknowledgeFailedPending = acknowledgeFailedPending;
    storage.saveSetupProgress = vi.fn((step, draft) => {
      progress = { kind: 'initial', step, draft: { ...draft } };
    });
    storage.loadSetupProgress = () => progress;
    const first = render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '빈 초안으로 다시 시작' }));
    await screen.findByRole('heading', { name: 'setup:welcome' });
    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));
    expect(screen.getByText('4000000')).toBeVisible();
    first.unmount();
    render(<MainApp repository={storage} />);

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.getByText('4000000')).toBeVisible();
    expect(screen.queryByRole('heading', { name: '저장 복구가 필요합니다' })).not.toBeInTheDocument();
    expect(acknowledgeFailedPending).toHaveBeenCalledWith(raw);
    expect(storage.acknowledgeFailedCurrent).not.toHaveBeenCalled();
  });

  it('stays in recovery when malformed pending quarantine cannot be written', async () => {
    const raw = '{malformed-pending';
    const failed = {
      status: 'failed',
      data: null,
      original: raw,
      raw,
      source: 'pending',
      reason: 'Stored main data is not valid JSON.',
    } satisfies MainLoadResult;
    const storage = repository(failed);
    const acknowledgeFailedPending = vi.fn(() => {
      throw new Error('quota');
    });
    storage.acknowledgeFailedPending = acknowledgeFailedPending;
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '빈 초안으로 다시 시작' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.getByRole('heading', { name: '저장 복구가 필요합니다' })).toBeVisible();
    expect(acknowledgeFailedPending).toHaveBeenCalledWith(raw);
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
    storage.discardPending = vi.fn();
    storage.discardRecovery = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '복구 초안 버리기' }));

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(storage.discardRecovery).toHaveBeenCalledWith(pending.updatedAt);
    expect(storage.discardPending).toHaveBeenCalledWith(pending.updatedAt);
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
    storage.discardPending = vi.fn();
    storage.discardRecovery = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: '저장 복구가 필요합니다' });

    fireEvent.click(screen.getByRole('button', { name: '현재 계획으로 돌아가기' }));

    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('3000000');
    expect(storage.discardRecovery).toHaveBeenCalledWith(pending.updatedAt);
    expect(storage.discardPending).toHaveBeenCalledWith(pending.updatedAt);
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

    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.getByText('4000000')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '저장 다시 시도' }));
    expect(await screen.findByRole('heading', { name: 'dashboard' })).toBeVisible();
    expect(screen.getByLabelText('applied-income')).toHaveTextContent('4000000');
    expect(storage.save).toHaveBeenCalledTimes(2);
  });

  it('shows a dashboard warning when applied setup progress cannot be cleaned up', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.save = vi.fn(async (draft: MainData) => ({ ...draft, updatedAt: 30 }));
    storage.clearSetupProgress = vi.fn(() => {
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

  it('cancel restores the applied v2 data and discards pending recovery', async () => {
    const storage = repository({ status: 'current', data: data(3_000_000), original: {} });
    storage.discardPending = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'edit-draft' }));
    fireEvent.click(screen.getByRole('button', { name: 'cancel-dashboard' }));

    expect(screen.getByLabelText('draft-income')).toHaveTextContent('3000000');
    expect(storage.discardPending).toHaveBeenCalledOnce();
  });

  it('restarts setup from applied v2 data at welcome and persists restart progress', async () => {
    const applied = data(3_000_000);
    const storage = repository({ status: 'current', data: applied, original: {} });
    storage.saveSetupProgress = vi.fn();
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'dashboard' });

    fireEvent.click(screen.getByRole('button', { name: 'restart-setup' }));

    expect(await screen.findByRole('heading', { name: 'setup:welcome' })).toBeVisible();
    expect(screen.getByText('3000000')).toBeVisible();
    expect(storage.saveSetupProgress).toHaveBeenCalledWith('welcome', applied, 'restart');
  });

  it('keeps setup editing available when progress persistence fails', async () => {
    const storage = repository({ status: 'empty', data: null, original: null });
    storage.saveSetupProgress = vi.fn(() => {
      throw new Error('quota');
    });
    render(<MainApp repository={storage} />);
    await screen.findByRole('heading', { name: 'setup:welcome' });

    fireEvent.click(screen.getByRole('button', { name: 'change-income' }));

    expect(screen.getByText('4000000')).toBeVisible();
    expect(screen.getByText('설정 진행 상황을 저장하지 못했습니다. 이 화면에서는 계속 입력할 수 있습니다.')).toBeVisible();
  });
});
