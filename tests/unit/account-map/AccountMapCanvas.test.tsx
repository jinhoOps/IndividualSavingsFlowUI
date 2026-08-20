import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
  animateMapLayout: (_root: HTMLElement, mutate: () => void, options: { onComplete(): void }) => {
    mutate();
    options.onComplete();
    return { cancel() {} };
  },
}));

afterEach(() => {
  cleanup();
  controlledMotion.closeComplete = null;
  controlledMotion.closeStarts = 0;
});

describe('AccountMapCanvas', () => {
  it('defaults to purpose layout, shows system references, and hides edge amounts before focus', () => {
    const { container } = renderCanvas();
    expect(screen.getByRole('button', { name: '목적 중심' })).toHaveAttribute('aria-pressed', 'true');
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

  it('reveals connected edge amounts on equivalent focus and invocation', () => {
    const onTransient = vi.fn();
    const { container, rerender } = renderCanvas({ onTransient });
    fireEvent.focus(screen.getByRole('button', { name: /생활비.*1,000,000원/ }));
    expect(onTransient).toHaveBeenCalledWith('system:living');
    rerender(canvas({ transientNodeId: 'system:living', pinnedNodeId: null, modalNodeId: null }, { onTransient }));
    expect(container.querySelector('.account-map-edge-amount')).toHaveTextContent('700,000원');
  });

  it('supports semantic zoom and account layout controls', () => {
    const onLayoutChange = vi.fn();
    renderCanvas({ onLayoutChange });
    fireEvent.click(screen.getByRole('button', { name: '축소' }));
    expect(screen.getByText('전체 보기')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '확대' }));
    expect(screen.getByText('기본 보기')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '계좌 중심' }));
    expect(onLayoutChange).toHaveBeenCalledWith('account');
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

  it('blocks layout mutations while stale recovery is visible', () => {
    const onLayoutChange = vi.fn();
    renderCanvas({
      onLayoutChange,
      recovery: { status: 'manual', latest: createEmptyWorkspace(2), action: 'layout-change', targets: [], reason: 'compound-edit' },
    });

    const accountLayout = screen.getByRole('button', { name: '계좌 중심' });
    expect(accountLayout).toBeDisabled();
    fireEvent.click(accountLayout);
    expect(onLayoutChange).not.toHaveBeenCalled();
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
  return <AccountMapCanvas applied={applied} main={main} locations={locations} interaction={interaction} viewport={{ width: 900, height: 600 }} onTransient={() => undefined} onBlur={() => undefined} onInvoke={() => undefined} onBackground={() => undefined} onEscape={() => undefined} onLayoutChange={() => undefined} {...overrides} />;
}
