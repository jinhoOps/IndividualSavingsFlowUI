import type { JSAnimation } from 'animejs';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import type { DonutSegmentGeometry } from '../../../src/main/ui/dashboard/cashflowDonutGeometry';
import {
  commitFinalDonutGeometry,
  setCircleGeometry,
  type DonutSegmentMotionState,
} from '../../../src/main/ui/dashboard/cashflowDonutMotion';

const createCircle = (): SVGCircleElement => document.createElementNS(
  'http://www.w3.org/2000/svg',
  'circle',
);

describe('cashflow donut motion', () => {
  it('writes circle geometry as a stroke dash pair', () => {
    const circle = createCircle();

    setCircleGeometry(circle, { visiblePercentage: 37.5, dashoffset: -62.5 });

    expect(circle).toHaveAttribute('stroke-dasharray', '37.5 62.5');
    expect(circle).toHaveAttribute('stroke-dashoffset', '-62.5');
  });

  it('commits active arcs and removes exited arc state', () => {
    const consumptionCircle = createCircle();
    const remainingCircle = createCircle();
    const animation = { cancel: vi.fn() } as unknown as JSAnimation;
    const target: DonutSegmentGeometry = {
      id: 'consumption',
      visiblePercentage: 60,
      dashoffset: -0,
    };
    const states = new Map([
      ['consumption' as const, { visiblePercentage: 15, dashoffset: -10, animation }],
      ['remaining' as const, { visiblePercentage: 25, dashoffset: -75, animation }],
    ]);

    commitFinalDonutGeometry(
      ['consumption', 'remaining'],
      ['consumption'],
      new Map([['consumption', target]]),
      new Map([
        ['consumption', consumptionCircle],
        ['remaining', remainingCircle],
      ]),
      states,
    );

    expect(consumptionCircle).toHaveAttribute('stroke-dasharray', '60 40');
    expect(consumptionCircle).toHaveAttribute('stroke-dashoffset', '0');
    expect(states.get('consumption')).toEqual({
      visiblePercentage: 60,
      dashoffset: -0,
      animation: undefined,
    });
    expect(remainingCircle).toHaveAttribute('stroke-dasharray', '0 100');
    expect(remainingCircle).toHaveAttribute('stroke-dashoffset', '-100');
    expect(states.has('remaining')).toBe(false);
  });
});
