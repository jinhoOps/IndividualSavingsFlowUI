// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  findMotionPaths,
  setRevealWidth,
  setVisualFrame,
} from '../../../src/simulation/ui/chartMotion';
import type { VisualChartGeometry } from '../../../src/simulation/ui/chartMotionGeometry';

const frame: VisualChartGeometry = {
  current: [{ x: 36, y: 249 }, { x: 656, y: 20 }],
  savings: [{ x: 36, y: 249 }, { x: 656, y: 67 }],
  bottom: 249,
};

describe('chart motion adapter', () => {
  it('finds all three visual paths and commits their exact frame and reveal width', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <svg>
        <rect class="growth-chart__reveal-clip" />
        <path data-motion-series="area" />
        <path data-motion-series="current" />
        <path data-motion-series="savings" />
      </svg>
    `;
    const paths = findMotionPaths(root);
    const clip = root.querySelector<SVGRectElement>('.growth-chart__reveal-clip');
    if (paths === null || clip === null) throw new Error('motion test fixture is incomplete');
    const geometryRef: { current: VisualChartGeometry | null } = { current: null };
    const widthRef = { current: 0 };

    setVisualFrame(paths, frame, geometryRef);
    setRevealWidth(clip, 620, widthRef);

    expect(geometryRef.current).toBe(frame);
    expect(widthRef.current).toBe(620);
    expect(paths.area.getAttribute('d')).toBe('M 36 249 L 656 20 L 656 249 L 36 249 Z');
    expect(paths.current.getAttribute('d')).toBe('M 36 249 L 656 20');
    expect(paths.savings.getAttribute('d')).toBe('M 36 249 L 656 67');
    expect(clip.getAttribute('width')).toBe('620');
  });

  it('returns null instead of partially animating when a visual path is absent', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <svg>
        <path data-motion-series="area" />
        <path data-motion-series="current" />
      </svg>
    `;

    expect(findMotionPaths(root)).toBeNull();
  });
});
