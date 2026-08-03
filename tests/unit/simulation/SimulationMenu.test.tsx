// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulationMenu } from '../../../src/simulation/ui/SimulationMenu';

afterEach(cleanup);

describe('SimulationMenu', () => {
  it('keeps reset behind a confirmation inside the menu', () => {
    const onReset = vi.fn();
    render(<SimulationMenu onReset={onReset} resetFailed={false} />);

    fireEvent.click(screen.getByText('Simulation 메뉴'));
    fireEvent.click(screen.getByRole('button', { name: '시뮬레이션 다시 설정' }));
    expect(screen.getByRole('dialog', { name: '시뮬레이션 다시 설정' })).toBeVisible();
    expect(onReset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '다시 설정 확인' }));
    expect(onReset).toHaveBeenCalledOnce();
  });

  it('moves focus into the modal and restores it after Escape', () => {
    render(<SimulationMenu onReset={vi.fn()} resetFailed={false} />);

    fireEvent.click(screen.getByText('Simulation 메뉴'));
    const opener = screen.getByRole('button', { name: '시뮬레이션 다시 설정' });
    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    const cancel = screen.getByRole('button', { name: '취소' });
    expect(cancel).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('restores focus to the reset opener when reset fails', () => {
    function FailingMenu() {
      const [failed, setFailed] = useState(false);
      return <SimulationMenu onReset={() => setFailed(true)} resetFailed={failed} />;
    }
    render(<FailingMenu />);

    fireEvent.click(screen.getByText('Simulation 메뉴'));
    const opener = screen.getByRole('button', { name: '시뮬레이션 다시 설정' });
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: '다시 설정 확인' }));

    expect(screen.getByRole('alert')).toHaveTextContent('시뮬레이션을 다시 설정하지 못했어요.');
    expect(opener).toHaveFocus();
  });
});
