import { describe, expect, it, vi } from 'vitest';
import { purgeRetiredStorage } from '../../../src/main/infrastructure/retiredStorage';

describe('purgeRetiredStorage', () => {
  it('removes the retired key without reading it', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('must not read'); }),
      removeItem: vi.fn(),
    } as unknown as Storage;
    purgeRetiredStorage(() => storage);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.removeItem).toHaveBeenCalledWith('isf-journey-snapshot-v1');
  });

  it('swallows unavailable storage and removal failures', () => {
    expect(() => purgeRetiredStorage(() => { throw new Error('blocked'); })).not.toThrow();
    expect(() => purgeRetiredStorage(() => ({
      removeItem: () => { throw new Error('quota'); },
    } as unknown as Storage))).not.toThrow();
  });
});
