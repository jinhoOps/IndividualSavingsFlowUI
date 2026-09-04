import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AccountMapCanvas } from '../../../src/account-map/ui/AccountMapCanvas';
import { salaryLivingBrokerageFixture } from './accountFlowTestSupport';

const motion = vi.hoisted(() => ({ starts: 0, reduced: [] as boolean[] }));
vi.mock('../../../src/account-map/ui/motion', () => ({
  animateFocusedFlow: (_root: HTMLElement, reducedMotion: boolean) => {
    motion.starts += 1;
    motion.reduced.push(reducedMotion);
    return { cancel() {} };
  },
}));

afterEach(() => {
  cleanup();
  motion.starts = 0;
  motion.reduced = [];
  vi.unstubAllGlobals();
});

describe('AccountMapCanvas', () => {
  it('renders every planned transfer in deterministic table order without a mixed account total or default edge amounts', () => {
    renderCanvas();

    const rows = [...screen.getByRole('table', { name: '계좌 흐름 읽기 표' }).querySelectorAll('tbody tr')]
      .map((row) => row.textContent ?? '');
    expect(rows).toContain('급여 통장생활비 통장고정 금액 · 900,000원계획됨');
    expect(rows).toContain('생활비 통장증권 계좌남은 금액 전부 · 계획상 0원남은 금액 전부');
    expect(document.querySelectorAll('[data-account-flow-edge-amount]')).toHaveLength(0);
    expect(document.querySelectorAll('.account-flow-node--account strong')).toHaveLength(0);
  });

  it('pins the complete account flow on first activation and routes each explicit action without reactivation', () => {
    const onEditLocation = vi.fn();
    const onAddTransfer = vi.fn();
    const onEditTransfer = vi.fn();
    render(<InteractiveCanvas onEditLocation={onEditLocation} onAddTransfer={onAddTransfer} onEditTransfer={onEditTransfer} />);

    fireEvent.click(screen.getByRole('button', { name: /계좌 급여 통장/ }));

    const detail = screen.getByLabelText('급여 통장 월 계획 흐름');
    expect(within(detail).getByText('들어오는 흐름')).toBeVisible();
    expect(within(detail).getByRole('button', { name: '계좌 정보 편집' })).toBeVisible();
    fireEvent.click(within(detail).getByRole('button', { name: '계좌 정보 편집' }));
    fireEvent.click(within(detail).getByRole('button', { name: '연결 추가' }));
    fireEvent.click(within(detail).getByRole('button', { name: '흐름 편집' }));

    expect(onEditLocation).toHaveBeenCalledWith('salary');
    expect(onAddTransfer).toHaveBeenCalledWith('salary');
    expect(onEditTransfer).toHaveBeenCalledWith('salary-living');
    expect(motion.starts).toBe(1);
  });

  it('uses hover and keyboard focus as a transient equivalent without pinning or opening an editor', () => {
    const onEditLocation = vi.fn();
    render(<InteractiveCanvas onEditLocation={onEditLocation} />);
    const node = screen.getByRole('button', { name: /계좌 생활비 통장/ });

    fireEvent.focus(node);

    const detail = screen.getByLabelText('생활비 통장 월 계획 흐름');
    expect(within(detail).getByText('미리 보기')).toBeVisible();
    expect(within(detail).queryByRole('button', { name: '계좌 정보 편집' })).not.toBeInTheDocument();
    expect(onEditLocation).not.toHaveBeenCalled();
  });

  it('keeps a zero sweep visible with its rule, planned estimate, and non-balance notice', () => {
    render(<InteractiveCanvas />);
    fireEvent.click(screen.getByRole('button', { name: /계좌 생활비 통장/ }));

    const detail = screen.getByLabelText('생활비 통장 월 계획 흐름');
    expect(within(detail).getByText('남은 금액 전부 · 계획상 0원')).toBeVisible();
    expect(within(detail).getByText('월 계획 기준이며 실제 잔액·거래와 다를 수 있습니다.')).toBeVisible();
  });

  it('clears the pinned flow from the background and Escape', () => {
    render(<InteractiveCanvas />);
    fireEvent.click(screen.getByRole('button', { name: /계좌 급여 통장/ }));
    expect(screen.getByLabelText('급여 통장 월 계획 흐름')).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByLabelText('급여 통장 월 계획 흐름')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /계좌 급여 통장/ }));
    const canvas = document.querySelector<HTMLElement>('.account-flow-canvas')!;
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 5, clientY: 5 });
    expect(screen.queryByLabelText('급여 통장 월 계획 흐름')).not.toBeInTheDocument();
  });
});

function InteractiveCanvas({
  onEditLocation = () => undefined,
  onAddTransfer = () => undefined,
  onEditTransfer = () => undefined,
}: Partial<Pick<React.ComponentProps<typeof AccountMapCanvas>, 'onEditLocation' | 'onAddTransfer' | 'onEditTransfer'>>) {
  const fixture = salaryLivingBrokerageFixture();
  const [interaction, setInteraction] = useState({ transientNodeId: null as string | null, pinnedNodeId: null as string | null, modalNodeId: null as string | null });
  return <AccountMapCanvas applied={fixture.applied} main={fixture.main} locations={fixture.locations} calculation={fixture.calculation} interaction={interaction} viewport={{ width: 900, height: 600 }} onTransient={(nodeId) => setInteraction((current) => ({ ...current, transientNodeId: nodeId }))} onBlur={(nodeId) => setInteraction((current) => current.transientNodeId === nodeId ? { ...current, transientNodeId: null } : current)} onInvoke={(nodeId) => setInteraction({ transientNodeId: null, pinnedNodeId: nodeId, modalNodeId: null })} onBackground={() => setInteraction({ transientNodeId: null, pinnedNodeId: null, modalNodeId: null })} onEscape={() => setInteraction({ transientNodeId: null, pinnedNodeId: null, modalNodeId: null })} onEditLocation={onEditLocation} onAddTransfer={onAddTransfer} onEditTransfer={onEditTransfer} />;
}

function renderCanvas() { return render(<InteractiveCanvas />); }
