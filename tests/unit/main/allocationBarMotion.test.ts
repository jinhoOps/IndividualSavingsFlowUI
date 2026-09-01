import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import {
  applyBarMotionState,
  commitFinalBarMotion,
  createBarMotionState,
  type AllocationBarMotionState,
} from '../../../src/main/ui/setup/allocationBarMotion';
import type { CashflowBarGeometry } from '../../../src/main/ui/setup/cashflowBarGeometry';

const clippedGeometry: CashflowBarGeometry = {
  segments: [
    { id: 'consumption', startPercent: 0, widthPercent: 56.25 },
    { id: 'saving', startPercent: 56.25, widthPercent: 9.375 },
    { id: 'investment', startPercent: 65.625, widthPercent: 71.875 },
  ],
  overflowPercent: 37.5,
  desiredEndPercent: 137.5,
  visibleEndPercent: 118,
  clipped: true,
};

function createBarRoot(): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = `
    <div class="cashflow-bar__clip">
      <div class="allocation-bar__visual-track">
        <span data-segment-id="consumption"></span>
        <span data-segment-id="saving"></span>
        <span data-segment-id="investment"></span>
        <span data-segment-id="remaining"></span>
      </div>
    </div>
  `;
  return root;
}

describe('allocation bar motion', () => {
  it('applies final clip, track, and segment widths without changing segment nodes', () => {
    const root = createBarRoot();
    const remaining = root.querySelector('[data-segment-id="remaining"]');

    applyBarMotionState(root, createBarMotionState(clippedGeometry));

    expect(root.querySelector('.cashflow-bar__clip')).toHaveStyle({ width: '118%' });
    expect(root.querySelector('.allocation-bar__visual-track')).toHaveStyle({
      width: `${137.5 / 118 * 100}%`,
    });
    expect(root.querySelector('[data-segment-id="consumption"]')).toHaveStyle({
      width: `${56.25 / 137.5 * 100}%`,
    });
    expect(root.querySelector('[data-segment-id="saving"]')).toHaveStyle({
      width: `${9.375 / 137.5 * 100}%`,
    });
    expect(root.querySelector('[data-segment-id="investment"]')).toHaveStyle({
      width: `${71.875 / 137.5 * 100}%`,
    });
    expect(root.querySelector('[data-segment-id="remaining"]')).toHaveStyle({ width: '0%' });
    expect(root.querySelector('[data-segment-id="remaining"]')).toBe(remaining);
  });

  it('commits the target state, clears animation, and returns visual IDs to React', () => {
    const root = createBarRoot();
    const state: AllocationBarMotionState = {
      ...createBarMotionState(clippedGeometry),
      animation: {} as AllocationBarMotionState['animation'],
    };
    const target: AllocationBarMotionState = {
      ...state,
      remaining: 28.125,
      desiredEndPercent: 100,
      visibleEndPercent: 100,
    };
    const setVisualSegmentIds = vi.fn();

    commitFinalBarMotion(
      state,
      target,
      root,
      ['consumption', 'saving', 'investment', 'remaining'],
      setVisualSegmentIds,
    );

    expect(state).toMatchObject({ ...target, animation: undefined });
    expect(root.querySelector('.cashflow-bar__clip')).toHaveStyle({ width: '100%' });
    expect(root.querySelector('[data-segment-id="remaining"]')).toHaveStyle({ width: '28.125%' });
    expect(setVisualSegmentIds).toHaveBeenCalledWith([
      'consumption',
      'saving',
      'investment',
      'remaining',
    ]);
  });
});
