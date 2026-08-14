import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AccountMapCanvas } from '../../../src/account-map/ui/AccountMapCanvas';
import type { AccountMapApplied } from '../../../src/account-map/domain/model';
import { createEmptyWorkspace } from '../../../src/workspace/domain/model';

afterEach(cleanup);

describe('AccountMapCanvas', () => {
  it('defaults to purpose layout, shows system references, and hides edge amounts before focus', () => {
    const { container } = renderCanvas();
    expect(screen.getByRole('button', { name: '목적 중심' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /생활비.*1,000,000원/ })).toBeVisible();
    expect(container.querySelector('.account-map-edge-amount')).toBeNull();
    expect(screen.getByRole('table', { name: '계좌 연결 읽기 표' })).toBeInTheDocument();
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

function renderCanvas(overrides: Partial<React.ComponentProps<typeof AccountMapCanvas>> = {}) {
  return render(canvas({ transientNodeId: null, pinnedNodeId: null, modalNodeId: null }, overrides));
}

function canvas(interaction: React.ComponentProps<typeof AccountMapCanvas>['interaction'], overrides: Partial<React.ComponentProps<typeof AccountMapCanvas>> = {}) {
  return <AccountMapCanvas applied={applied} main={main} locations={locations} interaction={interaction} viewport={{ width: 900, height: 600 }} onTransient={() => undefined} onBlur={() => undefined} onInvoke={() => undefined} onBackground={() => undefined} onLayoutChange={() => undefined} {...overrides} />;
}
