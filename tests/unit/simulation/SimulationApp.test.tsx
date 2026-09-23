// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CompoundSimulationDraft, SimulationMainSource } from '../../../src/simulation/domain/model';
import { createDefaultSimulationDraft } from '../../../src/simulation/domain/validation';
import type { MainSourceRepository } from '../../../src/simulation/infrastructure/mainSourceRepository';
import type {
  SimulationLoadResult,
  SimulationRepository,
} from '../../../src/simulation/infrastructure/simulationRepository';
import { BrowserSimulationRepository } from '../../../src/simulation/infrastructure/simulationRepository';
import { SimulationApp } from '../../../src/simulation/ui/SimulationApp';
import { AccountDraftContext } from '../../../src/auth/AccountDraftContext';
import type { AccountWorkspaceSession } from '../../../src/workspace/infrastructure/accountWorkspaceSession';
import {
  WORKSPACE_STORAGE_KEY,
  createEmptyWorkspace,
  type WorkspaceDocument,
} from '../../../src/workspace/domain/model';
import { BrowserWorkspaceRepository } from '../../../src/workspace/infrastructure/workspaceRepository';
import type {
  WorkspaceSaveGuard,
  WorkspaceSaveLock,
} from '../../../src/workspace/infrastructure/workspaceSaveLock';
import { MemoryStorage } from './MemoryStorage';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const source: SimulationMainSource = {
  monthlySavingsWon: 300_000,
  monthlyInvestmentWon: 200_000,
  mainUpdatedAt: 123,
};

function mainRepository(next: SimulationMainSource): MainSourceRepository {
  return { load: () => ({ status: 'found', source: next }) };
}

function simulationRepository(loadResult: SimulationLoadResult = { status: 'empty' }) {
  const repository: SimulationRepository = {
    load: () => loadResult,
    save: vi.fn(async () => ({ status: 'saved' as const })),
    clear: vi.fn(async () => ({ status: 'cleared' as const })),
  };
  return repository;
}

function firstSaveGate(): {
  lock: WorkspaceSaveLock;
  started: Promise<void>;
  release(): void;
} {
  let release: (() => void) | undefined;
  let markStarted: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  let count = 0;
  return {
    lock: {
      async runExclusive<T>(task: (guard: WorkspaceSaveGuard) => Promise<T>): Promise<T> {
        count += 1;
        if (count === 1) {
          markStarted?.();
          await gate;
        }
        return await task({ assertOwned: () => undefined });
      },
    },
    started,
    release: () => release?.(),
  };
}

function openConditionEditor() {
  fireEvent.click(screen.getByRole('button', { name: '조건 편집' }));
  return screen.getByRole('dialog', { name: '시뮬레이션 조건' });
}

describe('SimulationApp', () => {
  it('does not remember exploration gestures from onboarding', async () => {
    const { container } = render(<SimulationApp
      mainSourceRepository={mainRepository(source)} repository={simulationRepository()}
    />);
    fireEvent.wheel(window, { deltaY: 200 });
    fireEvent.click(screen.getByRole('button', { name: '없어요' }));
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    await waitFor(() => expect(container.querySelector('.simulation-portfolio-entry')).toHaveAttribute('data-revealed', 'false'));
  });

  it('keeps sample discovery collapsed until keyboard focus, without saving or navigating', () => {
    const saved = { ...createDefaultSimulationDraft(source, 456), expectedAnnualReturnPercent: 9 };
    const repository = simulationRepository({ status: 'found', draft: saved, migration: null });
    const { container } = render(<SimulationApp
      mainSourceRepository={mainRepository(source)} repository={repository}
    />);
    const entry = container.querySelector('.simulation-portfolio-entry');
    expect(entry).toHaveAttribute('data-revealed', 'false');
    const link = screen.getByRole('link', { name: '포트폴리오 샘플 보기' });
    expect(link).toHaveAttribute('href', '/apps/portfolio/?samplePreset=9');
    fireEvent.focus(link);
    expect(entry).toHaveAttribute('data-revealed', 'true');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('keeps result conditions in a separate modal editor', () => {
    const saved = createDefaultSimulationDraft(source, 456);
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({ status: 'found', draft: saved, migration: null })}
    />);

    expect(screen.queryByRole('spinbutton', { name: '기간 숫자' })).not.toBeInTheDocument();

    const editor = openConditionEditor();
    expect(within(editor).getByRole('spinbutton', { name: '기간 숫자' })).toBeVisible();
    expect(within(editor).getByText('목표와 가정')).toBeVisible();
  });

  it('puts condition editing after the projection comparison and starts the editor with the amount basis', () => {
    const saved = createDefaultSimulationDraft(source, 456);
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({ status: 'found', draft: saved, migration: null })}
    />);

    const projection = screen.getByRole('heading', { name: '5년 동안의 자산 변화' }).closest('section');
    expect(projection).not.toBeNull();
    const comparison = projection!.querySelector('.simulation-comparison');
    expect(within(projection!).queryByRole('group', { name: '표시 금액 기준' })).not.toBeInTheDocument();
    expect(within(projection!).getByText('명목', { exact: true })).toBeVisible();
    const opener = within(projection!).getByRole('button', { name: '조건 편집' });
    expect(opener.querySelector('svg')).toBeNull();
    expect(comparison).not.toBeNull();
    expect(comparison!.compareDocumentPosition(opener) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    fireEvent.click(opener);
    const editor = screen.getByRole('dialog', { name: '시뮬레이션 조건' });
    expect(editor.querySelector('[data-surface-layout="edit"]')).toBeTruthy();
    expect(editor.querySelector('[data-surface-context]')).toBeTruthy();
    expect(editor.querySelector('[data-surface-body]')).toBeTruthy();
    expect(within(editor).getByRole('button', { name: '닫기' })).toBeVisible();
    const amountMode = within(editor).getByRole('group', { name: '표시 금액 기준' });
    const years = within(editor).getByRole('spinbutton', { name: '기간 숫자' });
    expect(amountMode.compareDocumentPosition(years) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(amountMode).getByRole('button', { name: '명목' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps the condition editor open when a target field cancels with Escape', () => {
    const saved = createDefaultSimulationDraft(source, 456);
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({ status: 'found', draft: saved, migration: null })}
    />);

    const editor = openConditionEditor();
    fireEvent.click(within(editor).getByText('목표와 가정'));
    const target = within(editor).getByRole('textbox', { name: '목표 금액' });
    fireEvent.change(target, { target: { value: '123456789' } });
    fireEvent.keyDown(target, { key: 'Escape' });

    expect(screen.getByRole('dialog', { name: '시뮬레이션 조건' })).toBeVisible();
    expect(target).toHaveValue('100,000,000');
  });

  it('coalesces cloud autosaves after a 500ms quiet period', async () => {
    vi.useFakeTimers();
    const saved = createDefaultSimulationDraft(source, 456);
    const repository = simulationRepository({ status: 'found', draft: saved, migration: null });
    const session = {
      readRecoveryDraft: () => null,
      recordRecoveryDraft: vi.fn(),
    } as unknown as AccountWorkspaceSession;
    render(
      <AccountDraftContext.Provider value={session}>
        <SimulationApp mainSourceRepository={mainRepository(source)} repository={repository} now={() => 999} />
      </AccountDraftContext.Provider>,
    );

    const years = within(openConditionEditor()).getByRole('spinbutton', { name: '기간 숫자' });
    fireEvent.change(years, { target: { value: '21' } });
    fireEvent.change(years, { target: { value: '22' } });
    expect(repository.save).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ years: 22 }));
  });

  it('keeps a cloud initial migration autosave through StrictMode replay', async () => {
    vi.useFakeTimers();
    const migrated = createDefaultSimulationDraft(source, 456);
    const repository = simulationRepository({ status: 'found', draft: migrated, migration: 'schema-upgraded' });
    const session = {
      readRecoveryDraft: () => null,
      recordRecoveryDraft: vi.fn(),
    } as unknown as AccountWorkspaceSession;

    render(
      <StrictMode>
        <AccountDraftContext.Provider value={session}>
          <SimulationApp mainSourceRepository={mainRepository(source)} repository={repository} now={() => 999} />
        </AccountDraftContext.Provider>
      </StrictMode>,
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the committed result headline stable while an accumulated amount is being edited', () => {
    const saved = createDefaultSimulationDraft(source, 456);
    const repository = simulationRepository({
      status: 'found',
      draft: saved,
      migration: null,
    });
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 999}
    />);

    const headline = screen.getByRole('heading', { name: /1억 원을 모으려면/ });
    const committedHeadline = headline.textContent;
    const editor = openConditionEditor();
    fireEvent.click(within(editor).getByText('목표와 가정'));
    const initialAmount = within(editor).getByRole('textbox', { name: '현재 모아둔 돈' });
    fireEvent.change(initialAmount, { target: { value: '20000000' } });

    expect(initialAmount).toHaveValue('20000000');
    expect(headline).toHaveTextContent(committedHeadline ?? '');
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('edits the accumulated amount from calculation basis and reopens a user goal when needed', async () => {
    const saved = {
      ...createDefaultSimulationDraft(source, 456),
      initialInvestmentWon: 200_000_000,
      targetAmountWon: 300_000_000,
    };
    const repository = simulationRepository({
      status: 'found',
      draft: saved,
      migration: null,
    });
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 999}
    />);

    const editor = openConditionEditor();
    fireEvent.click(within(editor).getByText('목표와 가정'));
    const initialAmount = within(editor).getByRole('textbox', { name: '현재 모아둔 돈' });
    expect(initialAmount).toHaveValue('200,000,000');
    fireEvent.change(initialAmount, { target: { value: '300,000,000' } });
    fireEvent.blur(initialAmount);

    expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 300_000_000,
      targetAmountWon: null,
    })));
  });

  it('completes two-stage onboarding before saving the first result', async () => {
    const repository = simulationRepository();
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 456}
    />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    expect(screen.getByTestId('simulation-page-frame')).toHaveClass('app-content-frame');
    expect(screen.getByTestId('app-shell-launcher')).not.toHaveClass('app-content-frame');
    expect(screen.getByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }).closest('section'))
      .not.toHaveClass('app-content-frame');
    fireEvent.click(screen.getByRole('button', { name: '없어요' }));
    expect(screen.getByRole('heading', {
      name: '매년 어느 정도 수익을 기대하나요?',
    })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    expect(screen.getByRole('heading', { name: /1억 원을 모으려면/ })).toBeVisible();
    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
  });

  it('resumes a migrated targetless draft at goal setup and saves only after the target is completed', async () => {
    const migrated: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 456),
      initialInvestmentWon: 200_000_000,
      targetAmountWon: null,
      years: 17,
      expectedAnnualReturnPercent: 5,
    };
    const repository = simulationRepository({
      status: 'found',
      draft: migrated,
      migration: 'schema-upgraded',
    });
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 999}
    />);

    expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: /을 모으려면|30년 안에/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '기간별 복리 성장 그래프' })).not.toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole('textbox', { name: '목표 금액' }), {
      target: { value: '300000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      initialInvestmentWon: 200_000_000,
      targetAmountWon: 300_000_000,
      years: 17,
      expectedAnnualReturnPercent: 5,
    })));
    expect(screen.getByRole('heading', { name: /3억 원을 모으려면/ })).toBeVisible();
  });

  it('restores stale-Main disclosure and retry after completing a target without current Main', async () => {
    const migrated: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 456),
      initialInvestmentWon: 200_000_000,
      targetAmountWon: null,
    };
    const load = vi.fn()
      .mockReturnValueOnce({ status: 'unavailable' as const })
      .mockReturnValueOnce({ status: 'found' as const, source });
    const repository = simulationRepository({
      status: 'found',
      draft: migrated,
      migration: 'schema-upgraded',
    });
    render(<SimulationApp
      mainSourceRepository={{ load }}
      repository={repository}
      now={() => 999}
    />);

    fireEvent.change(screen.getByRole('textbox', { name: '목표 금액' }), {
      target: { value: '300000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledOnce());
    expect(screen.getByRole('heading', { name: /3억 원을 모으려면/ })).toBeVisible();
    expect(screen.getByText('이전 Main 기준')).toBeVisible();
    expect(screen.getByRole('button', { name: '최신 Main 다시 불러오기' })).toBeVisible();
  });

  it.each(['empty', 'zero-contribution'] as const)(
    'keeps a %s Main goal entry retryable until its target save succeeds',
    async (mainState) => {
      const zeroSource = {
        ...source,
        monthlySavingsWon: 0,
        monthlyInvestmentWon: 0,
      };
      const draftSource = mainState === 'zero-contribution' ? zeroSource : source;
      const migrated: CompoundSimulationDraft = {
        ...createDefaultSimulationDraft(draftSource, 456),
        initialInvestmentWon: 200_000_000,
        targetAmountWon: null,
        years: 17,
        expectedAnnualReturnPercent: 5,
        amountMode: 'real',
      };
      const repository = simulationRepository({
        status: 'found',
        draft: migrated,
        migration: 'schema-upgraded',
      });
      repository.save = vi.fn()
        .mockResolvedValueOnce({ status: 'unavailable' as const })
        .mockResolvedValueOnce({ status: 'saved' as const });
      render(<SimulationApp
        mainSourceRepository={mainState === 'zero-contribution'
          ? mainRepository(zeroSource)
          : { load: () => ({ status: 'empty' }) }}
        repository={repository}
        now={() => 999}
      />);

      const target = screen.getByRole('textbox', { name: '목표 금액' });
      fireEvent.change(target, { target: { value: '300000000' } });
      fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        '목표를 저장하지 못했어요. 다시 시도해주세요.',
      );
      expect(screen.getByRole('heading', { name: '다음에는 얼마를 모으고 싶나요?' })).toBeVisible();
      expect(target).toHaveValue('300000000');
      expect(screen.queryByRole('heading', {
        name: 'Main에서 월 저축·투자 금액을 먼저 정해주세요.',
      })).not.toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

      await waitFor(() => expect(repository.save).toHaveBeenCalledTimes(2));
      expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({
        targetAmountWon: 300_000_000,
        years: 17,
        expectedAnnualReturnPercent: 5,
        amountMode: 'real',
      }));
      expect(screen.getByRole('heading', {
        name: 'Main에서 월 저축·투자 금액을 먼저 정해주세요.',
      })).toBeVisible();
    },
  );

  it('revisits the result directly and persists only the latest Main source', async () => {
    const saved = { ...createDefaultSimulationDraft(source, 456), initialInvestmentWon: 10_000_000 };
    const latest = { ...source, monthlySavingsWon: 900_000, mainUpdatedAt: 999 };
    const repository = simulationRepository({ status: 'found', draft: saved, migration: null });

    render(<SimulationApp
      mainSourceRepository={mainRepository(latest)}
      repository={repository}
      now={() => 1_000}
    />);

    expect(screen.queryByRole('heading', { name: '지금 모아둔 투자금이 있나요?' }))
      .not.toBeInTheDocument();
    expect(screen.getByTestId('simulation-page-frame')).toHaveClass('app-content-frame');
    expect(screen.getByTestId('app-shell-launcher')).not.toHaveClass('app-content-frame');
    expect(screen.getByRole('heading', { name: /1억 원을 모으려면/ })).toBeVisible();
    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      source: latest,
      initialInvestmentWon: 10_000_000,
      targetAmountWon: 100_000_000,
      years: 5,
    })));
    expect(repository.save).toHaveBeenCalledTimes(1);
  });

  it('keeps the last result visible when current Main storage is unavailable', () => {
    const draft = createDefaultSimulationDraft(source, 456);
    render(<SimulationApp
      mainSourceRepository={{ load: () => ({ status: 'unavailable' }) }}
      repository={simulationRepository({ status: 'found', draft, migration: null })}
    />);

    expect(screen.getByText('이전 Main 기준')).toBeVisible();
    expect(screen.getByRole('heading', { name: /1억 원을 모으려면/ })).toBeVisible();
  });

  it('retries a stale Main source in place and persists only the refreshed source', async () => {
    const draft = createDefaultSimulationDraft(source, 456);
    const latest = { ...source, monthlySavingsWon: 900_000, mainUpdatedAt: 999 };
    const load = vi.fn()
      .mockReturnValueOnce({ status: 'unavailable' as const })
      .mockReturnValueOnce({ status: 'found' as const, source: latest });
    const repository = simulationRepository({ status: 'found', draft, migration: null });
    render(<SimulationApp
      mainSourceRepository={{ load }}
      repository={repository}
      now={() => 1_000}
    />);

    fireEvent.click(screen.getByRole('button', { name: '최신 Main 다시 불러오기' }));

    await waitFor(() => expect(repository.save).toHaveBeenCalledWith(expect.objectContaining({
      source: latest,
      targetAmountWon: draft.targetAmountWon,
      years: draft.years,
      expectedAnnualReturnPercent: draft.expectedAnnualReturnPercent,
    })));
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('이전 Main 기준')).not.toBeInTheDocument();
    expect(screen.getByText(/월 저축 90만 원/)).toBeVisible();
  });

  it('keeps controls available instead of rendering a non-finite projection', () => {
    const draft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 456),
      years: 30,
      baseRatePercent: 1e100,
    };
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({ status: 'found', draft, migration: null })}
    />);

    expect(screen.getByRole('alert')).toHaveTextContent(
      '계산 결과를 표시할 수 없어요. 목표와 가정에서 입력값을 조정해주세요.',
    );
    expect(screen.queryByRole('img', { name: '기간별 복리 성장 그래프' }))
      .not.toBeInTheDocument();
    const editor = openConditionEditor();
    expect(within(editor).getByRole('spinbutton', { name: '기간 숫자' })).toBeVisible();
    expect(within(editor).getByText('목표와 가정')).toBeVisible();
  });

  it('explains a migrated duration once while preserving the result', () => {
    const draft: CompoundSimulationDraft = {
      ...createDefaultSimulationDraft(source, 456),
      years: 30,
    };
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={simulationRepository({
        status: 'found',
        draft,
        migration: 'duration-capped',
      })}
    />);

    expect(screen.getByText('기간 범위가 변경되어 30년으로 조정됐어요.')).toBeVisible();
  });

  it('resets only Simulation from its menu and returns to onboarding', async () => {
    const draft = createDefaultSimulationDraft(source, 456);
    const repository = simulationRepository({ status: 'found', draft, migration: null });
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
    />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' }))
        .getByRole('button', { name: '다시 설정' }),
    );

    await waitFor(() => expect(repository.clear).toHaveBeenCalledOnce());
    expect(await screen.findByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
  });

  it('queues saves so a slower earlier result cannot overwrite the latest UI state', async () => {
    vi.useFakeTimers();
    const repository = simulationRepository();
    let settleFirst: ((result: { status: 'unavailable' }) => void) | undefined;
    let settleSecond: ((result: { status: 'saved' }) => void) | undefined;
    repository.save = vi.fn()
      .mockReturnValueOnce(new Promise((resolve) => { settleFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { settleSecond = resolve; }));
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 456}
    />);

    fireEvent.click(screen.getByRole('button', { name: '없어요' }));
    fireEvent.click(screen.getByRole('button', { name: '결과 보기' }));
    await act(async () => undefined);
    expect(repository.save).toHaveBeenCalledTimes(1);
    fireEvent.change(within(openConditionEditor()).getByRole('spinbutton', { name: '기간 숫자' }), {
      target: { value: '25' },
    });
    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: /1억 원을 모으려면/ })).toBeVisible();
    expect(screen.queryByText('저장 중')).not.toBeInTheDocument();

    await act(async () => settleFirst?.({ status: 'unavailable' }));
    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('저장 중')).not.toBeInTheDocument();
    expect(screen.queryByText('자동 저장하지 못했어요')).not.toBeInTheDocument();
    await act(async () => settleSecond?.({ status: 'saved' }));
    act(() => vi.advanceTimersByTime(600));
    expect(screen.queryByText('저장 중')).not.toBeInTheDocument();
    expect(screen.queryByText('저장됨')).not.toBeInTheDocument();
    expect(repository.save).toHaveBeenLastCalledWith(expect.objectContaining({ years: 25 }));
  });

  it('persists a pending draft before reset and ends with the exact cleared workspace', async () => {
    const storage = new MemoryStorage();
    const saved = createEmptyWorkspace(400);
    saved.revision = 4;
    saved.main.applied = {
      schemaVersion: 2,
      updatedAt: source.mainUpdatedAt,
      monthlyNetIncomeWon: 4_000_000,
      monthlyHousingWon: 900_000,
      monthlyLivingWon: 1_000_000,
      monthlySavingWon: source.monthlySavingsWon,
      monthlyInvestmentWon: source.monthlyInvestmentWon,
    };
    saved.simulation.draft = createDefaultSimulationDraft(source, 456);
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(saved));
    const gated = firstSaveGate();
    const repository = new BrowserSimulationRepository(new BrowserWorkspaceRepository(storage, {
      now: () => 500,
      saveLock: gated.lock,
    }));
    render(<SimulationApp
      mainSourceRepository={mainRepository(source)}
      repository={repository}
      now={() => 500}
    />);

    const editor = openConditionEditor();
    fireEvent.change(within(editor).getByRole('spinbutton', { name: '기간 숫자' }), {
      target: { value: '25' },
    });
    await gated.started;
    fireEvent.click(within(editor).getByRole('button', { name: '닫기' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '시뮬레이션 조건' })).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    const dialog = await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' });
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 설정' }));

    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(dialog).toBeVisible();
    gated.release();

    expect(await screen.findByRole('heading', { name: '지금 모아둔 투자금이 있나요?' })).toBeVisible();
    const persisted = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(persisted).toEqual({
      ...saved,
      revision: 6,
      updatedAt: 501,
      simulation: { draft: null },
    });
  });

  it('keeps the current result visible and reports an asynchronous clear failure', async () => {
    const saved = createDefaultSimulationDraft(source, 456);
    const repository = simulationRepository({ status: 'found', draft: saved, migration: null });
    repository.clear = vi.fn(async () => ({ status: 'unavailable' as const }));
    render(<SimulationApp mainSourceRepository={mainRepository(source)} repository={repository} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    fireEvent.click(
      within(await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' }))
        .getByRole('button', { name: '다시 설정' }),
    );

    const dialog = await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('시뮬레이션을 다시 설정하지 못했어요.');
    expect(screen.getByRole('heading', { name: /1억 원을 모으려면/ })).toBeVisible();
  });

  it('reports reset failure in the confirmation even when Main is required', async () => {
    let settle: ((result: { status: 'unavailable' }) => void) | undefined;
    const repository = simulationRepository({ status: 'empty' });
    repository.clear = vi.fn(() => new Promise<{ status: 'unavailable' }>((resolve) => {
      settle = resolve;
    }));
    render(<SimulationApp
      mainSourceRepository={{ load: () => ({ status: 'empty' }) }}
      repository={repository}
    />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    const dialog = await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' });
    fireEvent.click(within(dialog).getByRole('button', { name: '다시 설정' }));

    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(dialog).toBeVisible();
    await waitFor(() => expect(repository.clear).toHaveBeenCalledOnce());
    settle?.({ status: 'unavailable' });
    expect(await within(dialog).findByRole('alert'))
      .toHaveTextContent('시뮬레이션을 다시 설정하지 못했어요.');
    expect(screen.getByRole('heading', { name: 'Main에서 월 저축·투자 금액을 먼저 정해주세요.' }))
      .toBeVisible();
  });

  it('routes zero Main contributions back to Main', () => {
    render(<SimulationApp
      mainSourceRepository={mainRepository({
        ...source,
        monthlySavingsWon: 0,
        monthlyInvestmentWon: 0,
      })}
      repository={simulationRepository()}
    />);

    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    expect(screen.getByTestId('simulation-page-frame')).toHaveClass('app-content-frame');
    expect(screen.getByTestId('app-shell-launcher')).not.toHaveClass('app-content-frame');
    expect(screen.getByText('Main에서 월 저축·투자 금액을 먼저 정해주세요.')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Main에서 설정하기' }))
      .toHaveAttribute('href', '/apps/main/');
  });
});
