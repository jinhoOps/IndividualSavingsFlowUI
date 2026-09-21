import { describe, expect, it } from 'vitest';
import { resultCardShareUrl } from '../../../src/journey/result-card/shareUrl';

describe('result card share URL', () => {
  it('keeps the capability token in the fragment rather than sending it in the page request', () => {
    expect(resultCardShareUrl('https://jinhoops.github.io', '/IndividualSavingsFlowUI/', 'a_b-c')).toBe(
      'https://jinhoops.github.io/IndividualSavingsFlowUI/apps/share/#a_b-c',
    );
  });
});
