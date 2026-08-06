// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationManagementMenu } from '../../../src/simulation/ui/SimulationManagementMenu';

afterEach(cleanup);

describe('SimulationManagementMenu', () => {
  it('keeps Simulation-only reset behind confirmation', () => {
    const onReset = vi.fn();
    render(<SimulationManagementMenu onReset={() => { onReset(); return true; }} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '시뮬레이션 다시 설정' }));
    expect(screen.getByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' })).toBeVisible();
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 설정' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('shows reset failure and returns focus to the gear', async () => {
    render(<SimulationManagementMenu onReset={() => false} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('menuitem', { name: '시뮬레이션 다시 설정' }));
    fireEvent.click(screen.getByRole('button', { name: '다시 설정' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('시뮬레이션을 다시 설정하지 못했어요.');
    expect(dialog).toContainElement(screen.getByRole('alert'));
  });

  it('closes the confirmation from its backdrop and restores the gear', async () => {
    render(<SimulationManagementMenu onReset={() => true} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: '시뮬레이션 다시 설정' }));
    fireEvent.pointerDown(screen.getByRole('dialog'));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
