import { describe, expect, it } from 'vitest';
import { createProductSpring } from '../../../src/components/motion/tokens';

describe('product motion spring profiles', () => {
  it.each(['exit', 'value'] as const)('%s stays in range and moves monotonically', (role) => {
    const curve = createProductSpring(role).ease;
    const samples = Array.from({ length: 501 }, (_, index) => curve(index / 500));

    expect(samples.every((value) => value >= 0 && value <= 1)).toBe(true);
    expect(samples.every((value, index) => index === 0 || value >= samples[index - 1])).toBe(true);
  });

  it('creates an independent spring for each animation', () => {
    const first = createProductSpring('surface');
    const second = createProductSpring('surface');

    expect(first).not.toBe(second);
    expect(first.duration).toBe(260);
    expect(second.duration).toBe(260);
  });
});
