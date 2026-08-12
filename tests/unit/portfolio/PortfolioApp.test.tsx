import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { PortfolioPlan } from '../../../src/portfolio/domain/model';
import type { PortfolioMainSourceRepository } from '../../../src/portfolio/infrastructure/mainSourceRepository';
import { BrowserPortfolioRepository } from '../../../src/portfolio/infrastructure/portfolioRepository';
import type {
  InvestmentLocationRepository,
  LocationWriteResult,
} from '../../../src/portfolio/infrastructure/locationRepository';
import type { PortfolioPreferencesRepository } from '../../../src/portfolio/infrastructure/portfolioPreferencesRepository';
import { PortfolioApp } from '../../../src/portfolio/ui/PortfolioApp';
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
import { MemoryStorage } from '../simulation/MemoryStorage';
import { createMemoryPortfolioRepository } from './MemoryPortfolioRepository';

const anime = vi.hoisted(() => {
  const scope = {
    add: vi.fn((callback: () => void) => callback()),
    revert: vi.fn(),
    matches: { reducedMotion: false },
  };

  return {
    animate: vi.fn((_target: unknown, _options: unknown) => ({ cancel: vi.fn() })),
    createScope: vi.fn(() => scope),
    scope,
  };
});

vi.mock('animejs', () => ({
  animate: anime.animate,
  createScope: anime.createScope,
}));

beforeEach(() => {
  anime.animate.mockImplementation((_target: unknown, _options: unknown) => ({ cancel: vi.fn() }));
  anime.scope.matches.reducedMotion = false;
});

afterEach(() => {
  cleanup();
  anime.scope.matches.reducedMotion = false;
  vi.clearAllMocks();
});

const plan: PortfolioPlan = {
  schemaVersion: 2,
  scope: { type: 'aggregate' },
  items: [{
    id: 'a', name: '인덱스', shareUnits: 600_000, order: 0,
    classification: 'growth', classificationOrigin: 'automatic',
  }],
  cashShareUnits: 400_000,
  cashMode: 'automatic',
  syncedInvestmentWon: 200_000,
  appliedAt: 1,
  updatedAt: 1,
};
const mainFound: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 200_000, mainUpdatedAt: 1 } }),
};
const zeroMain: PortfolioMainSourceRepository = {
  load: () => ({ status: 'found', source: { monthlyInvestmentWon: 0, mainUpdatedAt: 1 } }),
};
const unavailableMain: PortfolioMainSourceRepository = {
  load: () => ({ status: 'unavailable' }),
};

const investmentLocations: InvestmentLocationRepository = {
  list: () => [{
    id: 'location-isa',
    shortName: 'ISA',
    kind: 'brokerage',
    roles: ['investing'],
    portfolioStatus: 'empty',
    createdAt: 1,
    updatedAt: 1,
  }],
  create: vi.fn(async (): Promise<LocationWriteResult> => ({ status: 'unavailable' })),
  link: vi.fn(async (): Promise<LocationWriteResult> => ({ status: 'unavailable' })),
  rename: vi.fn(async (): Promise<LocationWriteResult> => ({ status: 'unavailable' })),
  archive: vi.fn(async (): Promise<LocationWriteResult> => ({ status: 'unavailable' })),
  subscribe: () => () => undefined,
};
const emptyInvestmentLocations: InvestmentLocationRepository = {
  ...investmentLocations,
  list: () => [],
};

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

describe('PortfolioApp', () => {
  it('shows only the welcome task on first run', () => {
    render(<PortfolioApp locationRepository={investmentLocations} mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository()} now={() => 1} />);
    expect(screen.getByTestId('app-shell')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-launcher')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '매달 200,000원을 어디에 투자할까요?' })).toBeVisible();
    expect(screen.getByRole('button', { name: '배분 시작하기' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: '투자 위치' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('투자 배분 도넛')).not.toBeInTheDocument();
  });

  it('applies cash-only setup review without opening a second dialog', async () => {
    const repository = createMemoryPortfolioRepository();
    render(<PortfolioApp locationRepository={investmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '배분 확인' }));
    fireEvent.click(screen.getByRole('button', { name: '이대로 시작' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: '안정 100%' })).toBeVisible();
    expect(repository.applied).not.toBeNull();
  });

  it('shows a live strategy summary during allocation and reviews every amount with its percentage', () => {
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository()} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
    const targetSheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    fireEvent.change(within(targetSheet).getByLabelText('투자 대상 이름'), { target: { value: '미국 인덱스' } });
    fireEvent.change(within(targetSheet).getByLabelText('금액'), { target: { value: '120000' } });
    fireEvent.click(within(targetSheet).getByRole('button', { name: '완료' }));
    expect(screen.queryByRole('dialog', { name: '투자 대상 추가' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '미국 인덱스 편집, 120,000원, 60%' })).toBeVisible();

    const liveSummary = screen.getByRole('region', { name: '현재 배분 요약' });
    expect(liveSummary).toHaveTextContent('매달 200,000원');
    expect(liveSummary).toHaveTextContent('성장 60%');
    expect(liveSummary).toHaveTextContent('안정 40%');

    fireEvent.click(screen.getByRole('button', { name: '배분 확인' }));

    const review = screen.getByRole('region', { name: '배분 검토' });
    expect(within(review).getByRole('heading', { name: '성장에 60%, 안정에 40% 배분해요' })).toBeVisible();
    expect(within(review).getByRole('listitem', { name: '미국 인덱스 120,000원 60%' })).toBeVisible();
    expect(within(review).getByRole('listitem', { name: '현금 80,000원 40%' })).toBeVisible();
    expect(review).not.toHaveTextContent('자동 배분');
    expect(review).not.toHaveTextContent('나중에 Portfolio에서 언제든 수정할 수 있어요.');
  });

  it('revisits a saved plan result-first', () => {
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 2} />);
    expect(screen.getByText('이번 달 투자금')).toBeVisible();
    expect(screen.getByRole('heading', { name: '안정 40%' })).toBeVisible();
    expect(screen.getByRole('heading', { name: '안정 40%' }).closest('section'))
      .toHaveClass('ui-surface', 'portfolio-summary');
    expect(screen.getByRole('button', { name: '배분 수정' }))
      .toHaveClass('portfolio-summary__edit');
    expect(screen.queryByText('저장됨')).not.toBeInTheDocument();
  });

  it('keeps an automatic classification in the applied plan until an explicit re-selection is applied', async () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    render(<PortfolioApp mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
    const classification = screen.getByRole('group', { name: '인덱스 분류' });
    fireEvent.click(within(classification).getByRole('radio', { name: '성장' }));

    expect(within(classification).getByRole('status')).toHaveTextContent('직접 선택: 성장');
    expect(repository.applied?.items[0].classificationOrigin).toBe('automatic');
    await waitFor(() => expect(repository.draft?.items[0].classificationOrigin).toBe('user'));

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' }))
      .getByRole('button', { name: '배분 적용' }));
    await waitFor(() => expect(repository.applied?.items[0].classificationOrigin).toBe('user'));
  });

  it('shows the total investment in apply confirmation only when the amount preference is enabled', () => {
    const preferencesRepository: PortfolioPreferencesRepository = {
      load: () => ({ showAmounts: true, sortMode: 'ratio' }),
      save: () => ({ status: 'saved' }),
    };
    render(
      <PortfolioApp
        mainSourceRepository={mainFound}
        repository={createMemoryPortfolioRepository({ applied: plan })}
        preferencesRepository={preferencesRepository}
        now={() => 2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
    fireEvent.click(within(screen.getByRole('group', { name: '인덱스 분류' })).getByRole('radio', { name: '안정' }));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    const dialog = screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' });
    expect(within(dialog).getByText('총 투자금')).toBeVisible();
    expect(within(dialog).getByText('200,000원')).toBeVisible();
  });

  it('opens applied editing in a modal surface without locations', () => {
    render(<PortfolioApp locationRepository={investmentLocations} mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));

    const dialog = screen.getByRole('dialog', { name: '투자 배분 수정' });
    expect(within(dialog).getByRole('heading', { name: '투자 배분 수정' })).toBeVisible();
    expect(within(dialog).queryByRole('heading', { name: '투자 위치' })).not.toBeInTheDocument();
    expect(screen.getByTestId('portfolio-result-controls')).toHaveAttribute('inert');
    expect(within(dialog).queryByRole('complementary', { name: '배분 변경' })).not.toBeInTheDocument();
  });

  it('shows apply actions only after the first allocation change', () => {
    render(<PortfolioApp locationRepository={investmentLocations} mainSourceRepository={mainFound} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 2} />);
    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
    expect(screen.queryByRole('complementary', { name: '배분 변경' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('인덱스 금액'), { target: { value: '110000' } });
    fireEvent.blur(screen.getByLabelText('인덱스 금액'));

    expect(screen.getByRole('complementary', { name: '배분 변경' })).toBeVisible();
  });

  it('animates only the applied result and not draft amount keystrokes', async () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    render(<PortfolioApp
      locationRepository={emptyInvestmentLocations}
      mainSourceRepository={mainFound}
      repository={repository}
      now={() => 2}
    />);
    fireEvent.click(screen.getByRole('button', { name: '배분 수정' }));
    anime.animate.mockClear();

    fireEvent.change(screen.getByLabelText('인덱스 금액'), { target: { value: '110000' } });
    fireEvent.blur(screen.getByLabelText('인덱스 금액'));

    expect(screen.getByTestId('portfolio-result-controls')).toHaveTextContent('안정 40%');
    expect(anime.animate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: '투자 배분을 적용할까요?' }))
      .getByRole('button', { name: '배분 적용' }));

    expect(await screen.findByRole('heading', { name: '안정 45%' })).toBeVisible();
    await waitFor(() => expect(anime.animate).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({ scaleX: [0.6, 0.55], duration: 180 }),
    ));
  });

  it('places shared investment locations after the aggregate Portfolio task', () => {
    render(<PortfolioApp
      mainSourceRepository={mainFound}
      repository={createMemoryPortfolioRepository({ applied: plan })}
      locationRepository={investmentLocations}
      now={() => 2}
    />);

    const aggregateHeading = screen.getByRole('heading', { name: '안정 40%' });
    const locationHeading = screen.getByRole('heading', { name: '투자 위치' });
    expect(aggregateHeading.compareDocumentPosition(locationHeading)
      & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const disclosure = screen.getByRole('group', { name: '투자 위치 1곳' });
    expect(disclosure).not.toHaveAttribute('open');
    fireEvent.click(screen.getByText('투자 위치 1곳'));
    expect(screen.getByText('ISA')).toBeVisible();
    expect(screen.queryByRole('button', { name: /ISA.*배분/ })).not.toBeInTheDocument();
  });

  it('preserves the plan behind a zero-investment blurred gate', () => {
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={zeroMain} repository={createMemoryPortfolioRepository({ applied: plan })} now={() => 1} />);
    expect(screen.getByTestId('portfolio-gated-content')).toHaveClass('portfolio-content--blurred');
    expect(screen.getByRole('link', { name: 'Main에서 투자금 설정' }))
      .toHaveAttribute('href', expect.stringContaining('?edit=investment'));
  });

  it('keeps loaded amount preferences consistent in a stale Main result', () => {
    const preferencesRepository: PortfolioPreferencesRepository = {
      load: () => ({ showAmounts: true, sortMode: 'ratio' }),
      save: () => ({ status: 'saved' }),
    };
    render(
      <PortfolioApp
        mainSourceRepository={unavailableMain}
        repository={createMemoryPortfolioRepository({ applied: plan })}
        preferencesRepository={preferencesRepository}
        now={() => 2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    expect(screen.getByRole('switch', { name: '금액 보기' })).toBeChecked();
    expect(screen.getByRole('heading', { name: '이번 달 투자금 200,000원' })).toBeVisible();
  });

  it('shows the newly applied plan when draft cleanup fails after the applied write', async () => {
    const repository = createMemoryPortfolioRepository();
    repository.failClearDraft = true;
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '배분 확인' }));
    fireEvent.click(screen.getByRole('button', { name: '이대로 시작' }));

    expect(await screen.findByRole('heading', { name: '안정 100%' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('배분은 적용했지만 편집 초안을 정리하지 못했습니다');
    expect(repository.applied).not.toBeNull();
  });

  it('reports a failed automatic Main synchronization write', async () => {
    const repository = createMemoryPortfolioRepository({
      applied: { ...plan, syncedInvestmentWon: 100_000 },
    });
    repository.failNextWrite();

    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('저장하지 못했습니다'));
  });

  it('persists automatic Main reconciliation once under StrictMode', async () => {
    const storage = new MemoryStorage();
    const saved = createEmptyWorkspace(400);
    saved.revision = 4;
    saved.portfolio.plans = [{ ...plan, syncedInvestmentWon: 100_000 }];
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(saved));
    const gated = firstSaveGate();
    const repository = new BrowserPortfolioRepository(new BrowserWorkspaceRepository(storage, {
      now: () => 500,
      saveLock: gated.lock,
    }));
    const saveApplied = vi.spyOn(repository, 'saveApplied');

    render(
      <StrictMode>
        <PortfolioApp
          locationRepository={emptyInvestmentLocations}
          mainSourceRepository={mainFound}
          repository={repository}
          now={() => 500}
        />
      </StrictMode>,
    );

    await gated.started;
    expect(screen.getByRole('heading', { name: '안정 70%' })).toBeVisible();
    expect(screen.queryByText('저장 중')).not.toBeInTheDocument();
    gated.release();
    await waitFor(() => {
      expect(saveApplied).toHaveBeenCalledOnce();
      const persisted = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
      expect(persisted.revision).toBe(5);
    });
  });

  it('reports an applied write failure while staying in the editor', async () => {
    const repository = createMemoryPortfolioRepository();
    repository.failNextWrite();
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '배분 확인' }));
    fireEvent.click(screen.getByRole('button', { name: '이대로 시작' }));

    expect(await screen.findByRole('heading', { name: '성장에 0%, 안정에 100% 배분해요' })).toBeVisible();
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(repository.applied).toBeNull();
  });

  it('queues draft persistence so a slower earlier save cannot win over later UI state', async () => {
    const repository = createMemoryPortfolioRepository();
    let settleFirst: ((result: { status: 'unavailable' }) => void) | undefined;
    let settleSecond: ((result: { status: 'saved' }) => void) | undefined;
    repository.saveDraft = vi.fn()
      .mockImplementationOnce(() => new Promise((resolve) => { settleFirst = resolve; }))
      .mockImplementationOnce((draft) => new Promise((resolve) => {
        settleSecond = (result) => {
          repository.draft = structuredClone(draft);
          resolve(result);
        };
    }));
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '투자 대상 추가' }));
    let targetSheet = screen.getByRole('dialog', { name: '투자 대상 추가' });
    fireEvent.change(within(targetSheet).getByLabelText('투자 대상 이름'), { target: { value: '초기 이름' } });
    fireEvent.change(within(targetSheet).getByLabelText('금액'), { target: { value: '100000' } });
    fireEvent.click(within(targetSheet).getByRole('button', { name: '완료' }));
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: '초기 이름 편집, 100,000원, 50%' }));
    targetSheet = screen.getByRole('dialog', { name: '투자 대상 수정' });
    fireEvent.change(within(targetSheet).getByLabelText('투자 대상 이름'), { target: { value: '최신 이름' } });
    fireEvent.click(within(targetSheet).getByRole('button', { name: '완료' }));
    expect(repository.saveDraft).toHaveBeenCalledTimes(1);

    settleFirst?.({ status: 'unavailable' });
    await waitFor(() => expect(repository.saveDraft).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    settleSecond?.({ status: 'saved' });
    await waitFor(() => expect(repository.draft?.items[0]?.name).toBe('최신 이름'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('persists pending draft, apply, and cleanup in invocation order', async () => {
    const storage = new MemoryStorage();
    const saved = createEmptyWorkspace(400);
    saved.revision = 4;
    storage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(saved));
    const gated = firstSaveGate();
    const repository = new BrowserPortfolioRepository(new BrowserWorkspaceRepository(storage, {
      now: () => 500,
      saveLock: gated.lock,
    }));
    render(<PortfolioApp
      locationRepository={emptyInvestmentLocations}
      mainSourceRepository={mainFound}
      repository={repository}
      now={() => 500}
    />);

    fireEvent.click(screen.getByRole('button', { name: '배분 시작하기' }));
    fireEvent.click(screen.getByRole('button', { name: '현금 200,000원 100%' }));
    fireEvent.change(screen.getByLabelText('현금 금액'), { target: { value: '200000' } });
    fireEvent.blur(screen.getByLabelText('현금 금액'));
    await gated.started;
    fireEvent.click(screen.getByRole('button', { name: '배분 확인' }));
    fireEvent.click(screen.getByRole('button', { name: '이대로 시작' }));
    gated.release();

    expect(await screen.findByRole('heading', { name: '안정 100%' })).toBeVisible();
    const persisted = JSON.parse(storage.getItem(WORKSPACE_STORAGE_KEY) ?? '') as WorkspaceDocument;
    expect(persisted).toEqual({
      ...saved,
      revision: 7,
      updatedAt: 502,
      portfolio: {
        plans: [{
          schemaVersion: 2,
          scope: { type: 'aggregate' },
          items: [],
          cashShareUnits: 1_000_000,
          cashMode: 'manual',
          syncedInvestmentWon: 200_000,
          appliedAt: 500,
          updatedAt: 500,
        }],
        draft: null,
      },
    });
  });

  it('clears only the aggregate scope on reset and waits before changing the visible state', async () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    let releaseClear: (() => void) | undefined;
    const clearGate = new Promise<void>((resolve) => { releaseClear = resolve; });
    const originalClearScope = repository.clearScope.bind(repository);
    repository.clearScope = vi.fn(async (scope) => {
      await clearGate;
      return await originalClearScope(scope);
    });
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 3} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    await waitFor(() => expect(repository.clearScope).toHaveBeenCalledWith({ type: 'aggregate' }));
    expect(screen.getByRole('heading', { name: '안정 40%' })).toBeVisible();
    releaseClear?.();
    expect(await screen.findByRole('heading', { name: '매달 200,000원을 어디에 투자할까요?' })).toBeVisible();
    expect(repository.applied).toBeNull();
  });

  it('keeps the applied result and reports an asynchronous reset failure', async () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    repository.clearScope = vi.fn(async () => ({ status: 'unavailable' as const }));
    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 3} />);

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '투자 배분 처음부터 다시' }));
    fireEvent.click(screen.getByRole('button', { name: '초기화' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.getByRole('heading', { name: '안정 40%' })).toBeVisible();
  });

  it('isolates a corrupt draft and keeps the valid applied result', () => {
    const repository = createMemoryPortfolioRepository({ applied: plan });
    repository.load = () => ({
      applied: { status: 'found', plan },
      draft: { status: 'invalid' },
    });

    render(<PortfolioApp locationRepository={emptyInvestmentLocations} mainSourceRepository={mainFound} repository={repository} now={() => 2} />);

    expect(screen.getByRole('heading', { name: '안정 40%' })).toBeVisible();
  });

  it('keeps an unavailable view-preference save out of allocation save state', () => {
    let savedPreferences: { showAmounts: boolean; sortMode: 'ratio' | 'input' } | null = null;
    const preferencesRepository: PortfolioPreferencesRepository = {
      load: () => ({ showAmounts: false, sortMode: 'ratio' }),
      save: (value) => {
        savedPreferences = value;
        return { status: 'unavailable' };
      },
    };

    render(
      <PortfolioApp
        mainSourceRepository={mainFound}
        repository={createMemoryPortfolioRepository({ applied: plan })}
        preferencesRepository={preferencesRepository}
        now={() => 2}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('radio', { name: '입력순' }));

    expect(savedPreferences).toEqual({ showAmounts: false, sortMode: 'input' });
    expect(screen.getByRole('radio', { name: '입력순' })).toBeChecked();
    expect(screen.queryByText('저장됨')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
