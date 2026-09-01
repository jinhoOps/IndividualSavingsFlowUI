import { describe, expect, it } from 'vitest';
import { layoutAccountMap as compatibilityLayout } from '../../../src/account-map/ui/mapLayout';
import { layoutAccountMap } from '../../../src/account-map/ui/accountMapLayout';

describe('mapLayout compatibility exports', () => {
  it('keeps the legacy layout import on the extracted layout function', () => {
    expect(compatibilityLayout).toBe(layoutAccountMap);
  });
});
