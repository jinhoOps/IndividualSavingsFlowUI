import { describe, expect, it } from 'vitest';
import {
  indexAtClientX,
  indexForKey,
  tooltipPlacement,
} from '../../../src/simulation/ui/chartInteraction';

const plot = { left: 36, right: 656 };
const bounds = { left: 100, width: 340 };

describe('indexAtClientX', () => {
  it('returns no selection for an empty series or zero-width bounds', () => {
    expect(indexAtClientX({
      clientX: 150,
      bounds: { left: 100, width: 0 },
      viewBoxWidth: 680,
      plot,
      pointCount: 3,
    })).toBeNull();
    expect(indexAtClientX({
      clientX: 150,
      bounds,
      viewBoxWidth: 680,
      plot,
      pointCount: 0,
    })).toBeNull();
  });

  it('maps exact plot edges to the first and last points', () => {
    expect(indexAtClientX({
      clientX: 100 + 36 / 680 * 340,
      bounds,
      viewBoxWidth: 680,
      plot,
      pointCount: 3,
    })).toBe(0);
    expect(indexAtClientX({
      clientX: 100 + 656 / 680 * 340,
      bounds,
      viewBoxWidth: 680,
      plot,
      pointCount: 3,
    })).toBe(2);
  });

  it('clamps client positions outside the plot to boundary points', () => {
    expect(indexAtClientX({
      clientX: -100,
      bounds,
      viewBoxWidth: 680,
      plot,
      pointCount: 3,
    })).toBe(0);
    expect(indexAtClientX({
      clientX: 1_000,
      bounds,
      viewBoxWidth: 680,
      plot,
      pointCount: 3,
    })).toBe(2);
  });
});

describe('indexForKey', () => {
  it('selects boundaries for Home and End', () => {
    expect(indexForKey(1, 'home', 3)).toBe(0);
    expect(indexForKey(1, 'end', 3)).toBe(2);
  });

  it('preserves first-point selection for arrows from no current selection', () => {
    expect(indexForKey(null, 'previous', 3)).toBe(0);
    expect(indexForKey(null, 'next', 3)).toBe(0);
  });

  it('clamps arrow navigation and returns no selection for no points', () => {
    expect(indexForKey(0, 'previous', 3)).toBe(0);
    expect(indexForKey(2, 'next', 3)).toBe(2);
    expect(indexForKey(null, 'home', 0)).toBeNull();
    expect(indexForKey(null, 'end', 0)).toBeNull();
  });
});

describe('tooltipPlacement', () => {
  it('keeps a fixed tooltip inside horizontal and top chart edges', () => {
    expect(tooltipPlacement({
      anchorX: 620, anchorY: 140,
      chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
    })).toEqual({ horizontal: 'left', vertical: 'above' });
    expect(tooltipPlacement({
      anchorX: 120, anchorY: 140,
      chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
    })).toEqual({ horizontal: 'right', vertical: 'above' });
    expect(tooltipPlacement({
      anchorX: 120, anchorY: 40,
      chartWidth: 680, tooltipWidth: 240, tooltipHeight: 112,
    })).toEqual({ horizontal: 'right', vertical: 'below' });
  });
});
