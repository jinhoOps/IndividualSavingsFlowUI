// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
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
});
