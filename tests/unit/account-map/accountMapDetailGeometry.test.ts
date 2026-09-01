import { describe, expect, it } from 'vitest';
import type { PositionedNode } from '../../../src/account-map/ui/accountMapLayout';
import {
  nodeRectangle,
  positionConnectionDetail,
  rectanglesOverlap,
} from '../../../src/account-map/ui/accountMapDetailGeometry';

const node = (id: string, x: number, y: number, width = 180, height = 78): PositionedNode => ({
  id, kind: 'location', label: id, connectionCount: 0, status: 'resolved', x, y, width, height,
});

describe('Account Map connection detail geometry', () => {
  it('uses the adjacent right candidate when it is contained and clear of nodes', () => {
    expect(positionConnectionDetail(node('target', 40, 100), [node('target', 40, 100)], {
      width: 900, height: 600,
    }, { x: 0, y: 0 })).toEqual({
      left: 232, top: 100, maxBlockSize: 220, canvasHeight: 600,
    });
  });

  it('falls back to the left candidate when the adjacent right candidate is outside the canvas', () => {
    expect(positionConnectionDetail(node('target', 680, 100), [node('target', 680, 100)], {
      width: 900, height: 600,
    }, { x: 0, y: 0 })).toEqual({
      left: 356, top: 100, maxBlockSize: 220, canvasHeight: 600,
    });
  });

  it('keeps mobile detail coordinates finite and within the inset right edge', () => {
    const position = positionConnectionDetail(node('target', 100, 220), [node('target', 100, 220)], {
      width: 390, height: 700,
    }, { x: 0, y: 0 });

    expect(position.left).toBe(16);
    expect(position.top).toBe(310);
    expect(Number.isFinite(position.left)).toBe(true);
    expect(Number.isFinite(position.top)).toBe(true);
    expect(position.left + 358).toBeLessThanOrEqual(374);
  });

  it('rejects overlapping adjacent candidates and expands below the visible nodes', () => {
    const target = node('target', 300, 100);
    const position = positionConnectionDetail(target, [
      target,
      node('right', 500, 100),
      node('right-below', 500, 190),
      node('left', 0, 100),
      node('below', 300, 220),
    ], { width: 900, height: 600 }, { x: 0, y: 0 });

    expect(position).toEqual({ left: 300, top: 616, maxBlockSize: 220, canvasHeight: 852 });
  });

  it('applies pan to node rectangles before selecting an adjacent detail position', () => {
    const target = node('target', 40, 100);
    expect(nodeRectangle(target, { x: 30, y: -20 })).toEqual({ left: 70, top: 80, right: 250, bottom: 158 });
    expect(positionConnectionDetail(target, [target], { width: 900, height: 600 }, { x: 30, y: -20 }))
      .toMatchObject({ left: 262, top: 80, canvasHeight: 600 });
  });

  it('treats touching rectangles as separate while rejecting an actual overlap', () => {
    expect(rectanglesOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 })).toBe(false);
    expect(rectanglesOverlap({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 9, top: 0, right: 20, bottom: 10 })).toBe(true);
  });
});
