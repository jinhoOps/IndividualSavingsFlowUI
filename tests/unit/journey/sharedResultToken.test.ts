import { describe, expect, it } from 'vitest';
import { sharedResultToken } from '../../../src/journey/share/token';

describe('shared result token', () => {
  it('reads a well-formed token only from the URL fragment', () => {
    expect(sharedResultToken('#ABCD1234_ABCD1234_ABCD1234_ABCD1234')).toBe('ABCD1234_ABCD1234_ABCD1234_ABCD1234');
    expect(sharedResultToken('?token=ABCD1234_ABCD1234_ABCD1234_ABCD1234')).toBeNull();
  });
});
