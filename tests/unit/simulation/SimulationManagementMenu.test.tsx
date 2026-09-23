// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationManagementMenu } from '../../../src/simulation/ui/SimulationManagementMenu';

afterEach(cleanup);

const anime = vi.hoisted(() => ({
  animate: vi.fn((_target: unknown, options: Record<string, unknown>) => {
    if (typeof options.onComplete === 'function') options.onComplete();
    return { cancel: vi.fn() };
  }),
}));

vi.mock('animejs', () => ({ animate: anime.animate }));

describe('SimulationManagementMenu', () => {
  it('keeps Simulation-only reset behind confirmation', async () => {
    const onReset = vi.fn();
    render(<SimulationManagementMenu onReset={() => { onReset(); return true; }} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    expect(await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' })).toBeVisible();
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 설정' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('shows reset failure and returns focus to the gear', async () => {
    render(<SimulationManagementMenu onReset={() => false} />);
    fireEvent.click(screen.getByRole('button', { name: '관리 메뉴' }));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' }))
      .getByRole('button', { name: '다시 설정' }));

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('시뮬레이션을 다시 설정하지 못했어요.');
    expect(dialog).toContainElement(screen.getByRole('alert'));
  });

  it('closes the confirmation from its backdrop and restores the gear', async () => {
    render(<SimulationManagementMenu onReset={() => true} />);
    const trigger = screen.getByRole('button', { name: '관리 메뉴' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    fireEvent.pointerDown(await screen.findByRole('dialog', { name: '시뮬레이션을 다시 설정할까요?' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
