import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useReducer, useState } from 'react';
import { AccountMapCanvas } from '../../../src/account-map/ui/AccountMapCanvas';
import { accountMapReducer, type AccountMapState } from '../../../src/account-map/application/reducer';
import type { AccountMapApplied } from '../../../src/account-map/domain/model';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

const controlledMotion = vi.hoisted(() => ({
  closeComplete: null as (() => void) | null,
  closeStarts: 0,
  connectionStarts: 0,
  connectionCancels: 0,
  connectionOptions: [] as { reducedMotion: boolean }[],
}));

vi.mock('../../../src/account-map/ui/motion', () => ({
  animateNodeToModal: (_rect: DOMRect, _modal: HTMLElement, options: { onComplete(): void }) => {
    options.onComplete();
    return { cancel() {} };
  },
  animateModalToNode: (_modal: HTMLElement, _rect: DOMRect, options: { onComplete(): void }) => {
    controlledMotion.closeStarts += 1;
    controlledMotion.closeComplete = options.onComplete;
    return { cancel() { controlledMotion.closeComplete = null; } };
  },
  animateConnectionDetail: (_root: HTMLElement, options: { reducedMotion: boolean; onComplete(): void }) => {
    controlledMotion.connectionStarts += 1;
    controlledMotion.connectionOptions.push({ reducedMotion: options.reducedMotion });
    return { cancel() { controlledMotion.connectionCancels += 1; } };
  },
}));

afterEach(() => {
  cleanup();
  controlledMotion.closeComplete = null;
  controlledMotion.closeStarts = 0;
  controlledMotion.connectionStarts = 0;
  controlledMotion.connectionCancels = 0;
  controlledMotion.connectionOptions = [];
  vi.unstubAllGlobals();
});

describe('AccountMapCanvas', () => {
  it('shows system references without a layout selector and hides edge amounts before focus', () => {
    const { container } = renderCanvas();
    expect(screen.queryByRole('group', { name: '지도 정렬' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '목적 중심' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '계좌 중심' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '지도 확대 수준' })).toBeVisible();
    expect(screen.getByRole('button', {
      name: '목적 · 생활비 · 1,000,000원 · 활성 연결 1개 · 연결 필요',
    })).toBeVisible();
    expect(screen.getByRole('button', {
      name: '계좌·보관처 · 생활비통장 · 활성 월 연결 합계 700,000원 · 활성 연결 1개 · 연결 완료',
    })).toBeVisible();
    expect(container.querySelector('.account-map-edge-amount')).toBeNull();
    expect(screen.getByRole('table', { name: '계좌 연결 읽기 표' })).toBeInTheDocument();
  });

  it('keeps the screen-reader linear table out of the keyboard tab order', () => {
    renderCanvas();
    expect(screen.getByRole('table', { name: '계좌 연결 읽기 표' })).not.toHaveAttribute('tabindex');
  });

  it('announces the primary-income status exactly once only on the real anchored location', () => {
    renderCanvas();

    const anchoredName = screen.getByRole('button', { name: /급여통장/ }).getAttribute('aria-label') ?? '';
    expect(anchoredName).toBe('계좌·보관처 · 급여통장 · 주 수입 계좌 · 활성 월 연결 합계 2,000,000원 · 활성 연결 1개 · 연결 완료');
    expect(anchoredName.match(/주 수입 계좌/gu)).toHaveLength(1);

    cleanup();
    renderCanvas({
      applied: { ...applied, links: applied.links.filter(({ purposeId }) => purposeId !== 'system:income') },
    });
    expect(screen.getByRole('button', {
      name: '계좌·보관처 · 급여통장 · 활성 월 연결 합계 0원 · 활성 연결 0개 · 연결 완료',
    })).toBeVisible();
  });

  it('reveals connected edge amounts on equivalent focus and invocation', () => {
    const onTransient = vi.fn();
    const { container, rerender } = renderCanvas({ onTransient });
    fireEvent.focus(screen.getByRole('button', { name: /생활비.*1,000,000원/ }));
    expect(onTransient).toHaveBeenCalledWith('system:living');
    rerender(canvas({ transientNodeId: 'system:living', pinnedNodeId: null, modalNodeId: null }, { onTransient }));
    expect(container.querySelector('.account-map-edge-amount')).toHaveTextContent('700,000원');
  });

  it('shows a static active-link monthly composition for a focused location without animation', () => {
    const onTransient = vi.fn();
    const { rerender } = renderCanvas({ onTransient });
    const location = screen.getByRole('button', { name: /급여통장.*2,000,000원/ });

    fireEvent.focus(location);
    expect(onTransient).toHaveBeenCalledWith('location:salary');
    rerender(canvas({ transientNodeId: 'location:salary', pinnedNodeId: null, modalNodeId: null }, { onTransient }));

    expect(screen.getByText('월 연결 구성')).toBeVisible();
    expect(screen.getByText('월 계획 연결 기준 · 실제 잔액·거래·계좌 간 이동이 아님')).toBeVisible();
    const detail = screen.getByLabelText('급여통장 월 연결 구성');
    expect(within(detail).getByText('수입')).toBeVisible();
    expect(within(detail).getByText(/100%/)).toBeVisible();
    expect(controlledMotion.connectionStarts).toBe(0);
  });

  it('renders the approved empty detail copy for a zero-total location', () => {
    render(canvas(
      { transientNodeId: 'location:vault', pinnedNodeId: null, modalNodeId: null },
      {
        locations: [
          ...locations,
          { id: 'vault', shortName: '비상금함', kind: 'cash', roles: ['saving'], createdAt: 1, updatedAt: 1 },
        ],
      },
    ));

    const detail = screen.getByLabelText('비상금함 월 연결 구성');
    expect(within(detail).getByText('활성 월 연결이 없습니다.')).toBeVisible();
    expect(within(detail).queryByRole('list')).not.toBeInTheDocument();
  });

  it('summarizes zoom-hidden custom and repeated active links in overview detail', () => {
    const composedApplied = structuredClone(applied);
    composedApplied.customPurposes.push({
      id: 'custom:trip', parentId: 'system:living', name: '여행', targetMonthlyWon: 400_000,
      createdAt: 1, updatedAt: 1,
    });
    composedApplied.links.push(
      {
        id: 'trip-first', purposeId: 'custom:trip', locationId: 'salary', monthlyAmountWon: 100_000,
        remainder: false, status: 'active', createdAt: 1, updatedAt: 1,
      },
      {
        id: 'trip-second', purposeId: 'custom:trip', locationId: 'salary', monthlyAmountWon: 300_000,
        remainder: true, status: 'active', createdAt: 1, updatedAt: 1,
      },
    );

    function InteractiveCanvas() {
      const [interaction, setInteraction] = useState({
        transientNodeId: null as string | null,
        pinnedNodeId: null as string | null,
        modalNodeId: null as string | null,
      });
      return canvas(interaction, {
        applied: composedApplied,
        onTransient: (nodeId) => setInteraction((current) => ({ ...current, transientNodeId: nodeId })),
      });
    }

    render(<InteractiveCanvas />);
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    fireEvent.focus(screen.getByRole('button', { name: /급여통장/ }));

    const detail = screen.getByLabelText('급여통장 월 연결 구성');
    expect(within(detail).getByText('2,400,000원')).toBeVisible();
    expect(within(detail).getByText('여행')).toBeVisible();
    expect(within(detail).getByText('2,000,000원 · 83%')).toBeVisible();
    expect(within(detail).getByText('400,000원 · 17%')).toBeVisible();
  });

  it('pins a location with one animation before a second activation opens its existing modal', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    function InteractiveCanvas() {
      const [interaction, setInteraction] = useState({ transientNodeId: null as string | null, pinnedNodeId: null as string | null, modalNodeId: null as string | null });
      return canvas(interaction, {
        onInvoke: (nodeId) => setInteraction((current) => current.pinnedNodeId === nodeId
          ? { ...current, modalNodeId: nodeId }
          : { transientNodeId: null, pinnedNodeId: nodeId, modalNodeId: null }),
      });
    }
    render(<InteractiveCanvas />);
    const location = screen.getByRole('button', { name: /급여통장.*2,000,000원/ });

    fireEvent.click(location);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('월 연결 구성')).toBeVisible();
    expect(within(screen.getByLabelText('급여통장 월 연결 구성')).getByText(/100%/)).toBeVisible();
    expect(controlledMotion.connectionStarts).toBe(1);
    expect(controlledMotion.connectionOptions).toEqual([{ reducedMotion: false }]);

    fireEvent.click(location);
    expect(screen.getByRole('dialog', { name: '급여통장 상세' })).toBeVisible();
    expect(controlledMotion.connectionStarts).toBe(1);
  });

  it('passes reduced motion to the pin-only detail animation while rendering the final detail immediately', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })));
    function InteractiveCanvas() {
      const [interaction, setInteraction] = useState({ transientNodeId: null as string | null, pinnedNodeId: null as string | null, modalNodeId: null as string | null });
      return canvas(interaction, {
        onInvoke: (nodeId) => setInteraction({ transientNodeId: null, pinnedNodeId: nodeId, modalNodeId: null }),
      });
    }
    render(<InteractiveCanvas />);
    fireEvent.click(screen.getByRole('button', { name: /급여통장.*2,000,000원/ }));

    expect(within(screen.getByLabelText('급여통장 월 연결 구성')).getByText(/100%/)).toBeVisible();
    expect(controlledMotion.connectionOptions).toEqual([{ reducedMotion: true }]);
  });

  it('cancels the pinned-location animation when transient focus replaces its rendered detail', () => {
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })));
    function InteractiveCanvas() {
      const [interaction, setInteraction] = useState({ transientNodeId: null as string | null, pinnedNodeId: null as string | null, modalNodeId: null as string | null });
      return <>
        <button type="button" onClick={() => setInteraction({ transientNodeId: null, pinnedNodeId: 'location:salary', modalNodeId: null })}>급여통장 고정</button>
        <button type="button" onClick={() => setInteraction((current) => ({ ...current, transientNodeId: 'location:checking' }))}>생활비통장 집중</button>
        {canvas(interaction)}
      </>;
    }
    render(<InteractiveCanvas />);

    fireEvent.click(screen.getByRole('button', { name: '급여통장 고정' }));
    expect(controlledMotion.connectionStarts).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: '생활비통장 집중' }));

    expect(screen.getByLabelText('생활비통장 월 연결 구성')).toBeVisible();
    expect(controlledMotion.connectionCancels).toBe(1);
  });

  it('keeps purpose focus on its existing relationship detail without account composition', () => {
    render(canvas({ transientNodeId: 'system:living', pinnedNodeId: null, modalNodeId: null }));
    expect(screen.getByText('700,000원', { selector: '.account-map-edge-amount' })).toBeVisible();
    expect(screen.queryByText('월 연결 구성')).not.toBeInTheDocument();
  });

  it('supports semantic zoom without restoring a layout control', () => {
    renderCanvas();
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(screen.getByText('전체 보기')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(screen.getByText('기본 보기')).toBeVisible();
    expect(screen.queryAllByRole('button', { name: /중심$/ })).toHaveLength(0);
  });

  it.each(['transient', 'pinned'] as const)(
    'clears a %s target through the background contract when semantic zoom hides it',
    (targetKind) => {
      const customApplied = structuredClone(applied);
      customApplied.customPurposes.push({
        id: 'custom:trip', parentId: 'system:living', name: '여행', targetMonthlyWon: 100_000,
        createdAt: 1, updatedAt: 1,
      });
      customApplied.links.push({
        id: 'trip', purposeId: 'custom:trip', locationId: 'checking', monthlyAmountWon: 100_000,
        remainder: true, status: 'active', createdAt: 1, updatedAt: 1,
      });
      const onBackground = vi.fn();
      renderCanvas({
        applied: customApplied,
        interaction: {
          transientNodeId: targetKind === 'transient' ? 'custom:trip' : null,
          pinnedNodeId: targetKind === 'pinned' ? 'custom:trip' : null,
          modalNodeId: null,
        },
        onBackground,
      });

      fireEvent.click(screen.getByRole('button', { name: '축소' }));

      expect(onBackground).toHaveBeenCalledTimes(1);
    },
  );

  it('announces overall status amounts without active-link wording', () => {
    renderCanvas({
      main: { ...main, monthlyNetIncomeWon: 2_100_000 },
    });
    expect(screen.getByRole('button', {
      name: '전체 상태 · 미배정 · 전체 미배정 100,000원 · 활성 연결 0개 · 미배정',
    })).toBeVisible();

    cleanup();
    renderCanvas({
      main: { ...main, monthlyNetIncomeWon: 1_900_000 },
    });
    expect(screen.getByRole('button', {
      name: '전체 상태 · 부족함 · 전체 부족 100,000원 · 활성 연결 0개 · 부족함',
    })).toBeVisible();
  });

  it('pans the map only after dragging empty canvas space', () => {
    const onBackground = vi.fn();
    const { container } = renderCanvas({ onBackground });
    const canvasElement = container.querySelector('.account-map-canvas')!;
    const content = container.querySelector('.account-map-canvas__content') as HTMLElement;

    fireEvent(canvasElement, new MouseEvent('pointerdown', { bubbles: true, clientX: 20, clientY: 30 }));
    fireEvent(canvasElement, new MouseEvent('pointermove', { bubbles: true, clientX: 60, clientY: 55 }));
    fireEvent(canvasElement, new MouseEvent('pointerup', { bubbles: true, clientX: 60, clientY: 55 }));

    expect(content).toHaveStyle({ transform: 'translate(40px, 25px)' });
    expect(onBackground).not.toHaveBeenCalled();

    fireEvent(canvasElement, new MouseEvent('pointerdown', { bubbles: true, clientX: 10, clientY: 10 }));
    fireEvent(canvasElement, new MouseEvent('pointerup', { bubbles: true, clientX: 10, clientY: 10 }));
    expect(onBackground).toHaveBeenCalledTimes(1);
  });

  it('pans horizontal touch drags without taking over vertical touch scroll intent', () => {
    const { container } = renderCanvas();
    const canvasElement = container.querySelector('.account-map-canvas')!;
    const content = container.querySelector('.account-map-canvas__content') as HTMLElement;

    fireEvent.touchStart(canvasElement, { touches: [{ clientX: 20, clientY: 30 }] });
    fireEvent.touchMove(canvasElement, { touches: [{ clientX: 90, clientY: 34 }] });
    fireEvent.touchEnd(canvasElement);
    expect(content).toHaveStyle({ transform: 'translate(70px, 4px)' });

    cleanup();
    const { container: verticalContainer } = renderCanvas();
    const verticalCanvas = verticalContainer.querySelector('.account-map-canvas')!;
    const verticalContent = verticalContainer.querySelector('.account-map-canvas__content') as HTMLElement;
    fireEvent.touchStart(verticalCanvas, { touches: [{ clientX: 20, clientY: 30 }] });
    fireEvent.touchMove(verticalCanvas, { touches: [{ clientX: 24, clientY: 100 }] });
    fireEvent.touchEnd(verticalCanvas);
    expect(verticalContent).toHaveStyle({ transform: 'translate(0px, 0px)' });
  });

  it('keeps overview DOM topology representative-only and restores an invokable unlinked location at default zoom', () => {
    const topologyApplied = structuredClone(applied);
    topologyApplied.links.push({
      id: 'living-backup', purposeId: 'system:living', locationId: 'checking-backup', monthlyAmountWon: 300_000,
      remainder: false, status: 'active', createdAt: 1, updatedAt: 1,
    });
    const topologyLocations = [
      ...locations,
      { id: 'checking-backup', shortName: '보조생활비', kind: 'bank' as const, roles: ['spending' as const], createdAt: 1, updatedAt: 1 },
      { id: 'vault', shortName: '비상금함', kind: 'cash' as const, roles: ['saving' as const], createdAt: 1, updatedAt: 1 },
    ];
    const onInvoke = vi.fn();
    const { container } = renderCanvas({ applied: topologyApplied, locations: topologyLocations, onInvoke });

    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(screen.getByText('전체 보기')).toBeVisible();
    expect(screen.getByRole('button', { name: '계좌·보관처 · 생활비통장 · 활성 월 연결 합계 700,000원 · 활성 연결 1개 · 연결 완료' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /보조생활비/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /비상금함/ })).not.toBeInTheDocument();
    expect(container.querySelectorAll('.account-map-node--location')).toHaveLength(2);
    expect(container.querySelectorAll('.account-map-edges path')).toHaveLength(2);
    expect(container.querySelectorAll('.account-map-linear-table tbody tr')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    const unlinked = screen.getByRole('button', {
      name: '계좌·보관처 · 비상금함 · 활성 월 연결 합계 0원 · 활성 연결 0개 · 연결 완료',
    });
    expect(screen.getByRole('button', { name: /보조생활비/ })).toBeVisible();
    expect(unlinked).toBeVisible();
    fireEvent.click(unlinked);
    expect(onInvoke).toHaveBeenCalledWith('location:vault');
  });

  it('uses canonical account-first headers and location-then-purpose rows', () => {
    const reversedApplied = { ...applied, links: [...applied.links].reverse(), layout: 'account' as const };
    renderCanvas({ applied: reversedApplied });

    const table = screen.getByRole('table', { name: '계좌 연결 읽기 표' });
    expect([...table.querySelectorAll('th')].map((header) => header.textContent)).toEqual(['계좌·보관처', '목적', '월 금액', '상태']);
    expect([...table.querySelectorAll('tbody tr')].map((row) => row.textContent)).toEqual([
      '급여통장수입2,000,000원연결됨',
      '생활비통장생활비700,000원연결됨',
    ]);
  });

  it('opens detail only after invoking an already pinned node', () => {
    function InteractiveCanvas() {
      const [interaction, setInteraction] = useState({ transientNodeId: null as string | null, pinnedNodeId: null as string | null, modalNodeId: null as string | null });
      return canvas(interaction, {
        onInvoke: (nodeId) => setInteraction((current) => current.pinnedNodeId === nodeId
          ? { ...current, modalNodeId: nodeId }
          : { transientNodeId: null, pinnedNodeId: nodeId, modalNodeId: null }),
        onModalClose: () => setInteraction((current) => ({ ...current, modalNodeId: null })),
      });
    }
    render(<InteractiveCanvas />);
    const node = screen.getByRole('button', { name: /생활비.*1,000,000원/ });
    fireEvent.click(node);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(node);
    expect(screen.getByRole('dialog', { name: '생활비 상세' })).toBeVisible();
  });

  it('keeps connection editing inside the node modal instead of a persistent map toolbar', () => {
    function InteractiveCanvas() {
      const [interaction, setInteraction] = useState({ transientNodeId: null as string | null, pinnedNodeId: null as string | null, modalNodeId: null as string | null });
      return canvas(interaction, {
        onInvoke: (nodeId) => setInteraction((current) => current.pinnedNodeId === nodeId
          ? { ...current, modalNodeId: nodeId }
          : { transientNodeId: null, pinnedNodeId: nodeId, modalNodeId: null }),
      });
    }
    render(<InteractiveCanvas />);
    expect(screen.queryByRole('button', { name: '연결 추가' })).not.toBeInTheDocument();
    const node = screen.getByRole('button', { name: /생활비.*1,000,000원/ });
    fireEvent.click(node);
    fireEvent.click(node);
    fireEvent.click(screen.getByRole('button', { name: '편집' }));
    expect(screen.getByRole('button', { name: '연결 추가' })).toBeVisible();
  });

  it('finishes a settled recovery close and restores focus before the parent reducer adopts latest', () => {
    const onKeepLatest = vi.fn();
    const onModalClose = vi.fn();

    function RecoveringCanvas() {
      const [state, dispatch] = useReducer(accountMapReducer, initialMapState());
      if (state.mode !== 'map') return <p>setup</p>;
      return <>
        {canvas(state.interaction, {
          applied: state.applied,
          main: state.main,
          locations: state.workspace.locations,
          recovery: state.recovery,
          onInvoke: (nodeId) => dispatch({ type: 'node-invoked', nodeId }),
          onKeepLatest: () => {
            onKeepLatest();
            dispatch({ type: 'latest-kept' });
          },
          onModalClose: () => {
            onModalClose();
            dispatch({ type: 'modal-closed' });
          },
        })}
        <button type="button" onClick={() => {
          const latest = structuredClone(state.workspace);
          latest.revision = 2;
          dispatch({
            type: 'save-manual-conflicted', latest, action: 'edit-node',
            targets: [{ kind: 'node', id: 'system:living' }], reason: 'compound-edit',
          });
        }}>simulate conflict</button>
      </>;
    }

    render(<RecoveringCanvas />);
    const source = screen.getByRole('button', { name: /생활비.*1,000,000원/ });
    fireEvent.click(source);
    fireEvent.click(source);
    fireEvent.click(screen.getByRole('button', { name: 'simulate conflict' }));
    const dialog = screen.getByRole('dialog', { name: '생활비 상세' });
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(dialog.parentElement!);

    expect(dialog).toBeVisible();
    expect(controlledMotion.closeStarts).toBe(1);
    expect(onKeepLatest).not.toHaveBeenCalled();
    expect(onModalClose).not.toHaveBeenCalled();

    const complete = controlledMotion.closeComplete;
    expect(complete).not.toBeNull();
    act(() => complete?.());

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onKeepLatest).toHaveBeenCalledTimes(1);
    expect(onModalClose).toHaveBeenCalledTimes(1);
    expect(source).toHaveFocus();
  });
});

const applied: AccountMapApplied = {
  schemaVersion: 1,
  sourceMainUpdatedAt: 1,
  customPurposes: [],
  links: [
    { id: 'income', purposeId: 'system:income', locationId: 'salary', monthlyAmountWon: 2_000_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
    { id: 'living', purposeId: 'system:living', locationId: 'checking', monthlyAmountWon: 700_000, remainder: true, status: 'active', createdAt: 1, updatedAt: 1 },
  ],
  layout: 'purpose', setupCompletedAt: 1, updatedAt: 1,
};

const main = { schemaVersion: 2 as const, updatedAt: 1, monthlyNetIncomeWon: 2_000_000, monthlyHousingWon: 500_000, monthlyLivingWon: 1_000_000, monthlySavingWon: 300_000, monthlyInvestmentWon: 200_000 };
const locations = [
  { id: 'salary', shortName: '급여통장', institution: { id: 'kb-kookmin', name: 'KB국민은행' }, kind: 'bank' as const, roles: ['income' as const], createdAt: 1, updatedAt: 1 },
  { id: 'checking', shortName: '생활비통장', institution: { id: 'hana', name: '하나은행' }, kind: 'bank' as const, roles: ['spending' as const], createdAt: 1, updatedAt: 1 },
];

function initialMapState(): AccountMapState {
  const workspace = createEmptyWorkspace(1);
  workspace.revision = 1;
  workspace.main.applied = main;
  workspace.locations = structuredClone(locations);
  workspace.accountMap.applied = structuredClone(applied);
  return {
    mode: 'map', workspace, main, applied: structuredClone(applied),
    interaction: { transientNodeId: null, pinnedNodeId: null, modalNodeId: null },
    save: { status: 'idle' },
    recovery: { status: 'none' },
  };
}

function renderCanvas(overrides: Partial<React.ComponentProps<typeof AccountMapCanvas>> = {}) {
  return render(canvas({ transientNodeId: null, pinnedNodeId: null, modalNodeId: null }, overrides));
}

function canvas(interaction: React.ComponentProps<typeof AccountMapCanvas>['interaction'], overrides: Partial<React.ComponentProps<typeof AccountMapCanvas>> = {}) {
  return <AccountMapCanvas applied={applied} main={main} locations={locations} interaction={interaction} viewport={{ width: 900, height: 600 }} onTransient={() => undefined} onBlur={() => undefined} onInvoke={() => undefined} onBackground={() => undefined} onEscape={() => undefined} {...overrides} />;
}
