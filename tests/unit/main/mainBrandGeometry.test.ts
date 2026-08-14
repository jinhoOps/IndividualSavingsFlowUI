import { render } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { createElement, type ComponentType } from 'react';
import { describe, expect, it } from 'vitest';

describe('main brand geometry', () => {
  it('defines three rising bars and one rising trend with intentional intermediate variance', async () => {
    const { MAIN_BRAND_GEOMETRY } = await import('../../../shared/brand/mainBrandGeometry.js');

    expect(MAIN_BRAND_GEOMETRY.bars).toHaveLength(3);
    expect(MAIN_BRAND_GEOMETRY.bars.map((bar) => bar.height)).toEqual([82, 143, 188]);
    expect(MAIN_BRAND_GEOMETRY.trend.points).toHaveLength(5);
    expect(MAIN_BRAND_GEOMETRY.trend.points.map((point) => point.x)).toEqual([174, 215, 256, 297, 338]);
    expect(MAIN_BRAND_GEOMETRY.bars.map((bar) => bar.x + bar.width / 2)).toEqual([174, 256, 338]);

    const [first, dip, second, variance, final] = MAIN_BRAND_GEOMETRY.trend.points;
    expect(first.x).toBeLessThan(dip.x);
    expect(dip.x).toBeLessThan(second.x);
    expect(second.x).toBeLessThan(variance.x);
    expect(variance.x).toBeLessThan(final.x);
    expect(MAIN_BRAND_GEOMETRY.trend.points.filter((point) => point.y === 132)).toEqual([
      { id: 'bar-3-final', x: 338, y: 132 },
    ]);
    expect(Math.min(...MAIN_BRAND_GEOMETRY.trend.points.map((point) => point.y))).toBe(132);
  });

  it('renders the shared trend as a decorative polyline ending in a dot', async () => {
    const module = await import('../../../src/main/ui/brand/MainBrandIcon');
    const MainBrandIcon = module.MainBrandIcon as ComponentType;
    const { container } = render(createElement(MainBrandIcon));

    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('focusable', 'false');
    expect(svg).not.toHaveAttribute('role');

    const trend = svg?.querySelector('[data-brand-trend]');
    expect(trend?.tagName.toLowerCase()).toBe('polyline');
    expect(trend).toHaveAttribute('points', '174,236 215,264 256,204 297,216 338,132');
    expect(trend).toHaveAttribute('stroke-linecap', 'round');
    expect(trend).toHaveAttribute('stroke-linejoin', 'round');

    const terminalDot = svg?.querySelector('[data-brand-terminal-dot]');
    expect(terminalDot?.tagName.toLowerCase()).toBe('circle');
    expect(terminalDot).toHaveAttribute('cx', '338');
    expect(terminalDot).toHaveAttribute('cy', '132');
  });
});
