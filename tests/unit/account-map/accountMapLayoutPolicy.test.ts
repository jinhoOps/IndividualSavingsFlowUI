import { describe, expect, it } from 'vitest';
import { createAccountMapLayoutPolicy } from '../../../src/account-map/ui/accountMapLayoutPolicy';

describe('Account Map layout policy', () => {
  it.each([
    [{ width: 390, height: 844 }, 'top-to-bottom', 16],
    [{ width: 768, height: 1024 }, 'top-to-bottom', 28],
    [{ width: 769, height: 1024 }, 'left-to-right', 28],
  ] as const)('chooses the intended responsive policy for %o', (viewport, direction, margin) => {
    const policy = createAccountMapLayoutPolicy(viewport);

    expect(policy).toMatchObject({ direction, margin, nodeHeight: 78 });
    expect(Number.isFinite(policy.nodeWidth)).toBe(true);
    expect(policy.nodeWidth).toBeLessThanOrEqual(210);
    expect(policy.columns).toBeGreaterThanOrEqual(1);
  });

  it('clamps a narrow measured viewport without consulting graph data', () => {
    const policy = createAccountMapLayoutPolicy({ width: 0, height: 0 });

    expect(policy.width).toBe(280);
    expect(policy.minimumHeight).toBe(360);
    expect(policy.direction).toBe('top-to-bottom');
    expect(policy.margin).toBe(16);
  });
});
