import { describe, expect, it } from 'vitest';
import { partitionAppNavigation } from '../../../src/journey/ui/appNavigationOverflow';

const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ id }));

describe('partitionAppNavigation', () => {
  it('keeps four or five items direct when their measured width fits', () => {
    expect(partitionAppNavigation(items.slice(0, 4), 'd', 188)).toEqual({
      visible: items.slice(0, 4),
      overflow: [],
    });
    expect(partitionAppNavigation(items.slice(0, 5), 'e', 236)).toEqual({
      visible: items.slice(0, 5),
      overflow: [],
    });
  });

  it('reserves a more target and keeps a trailing current item direct', () => {
    expect(partitionAppNavigation(items.slice(0, 5), 'e', 188)).toEqual({
      visible: [items[0], items[1], items[4]],
      overflow: [items[2], items[3]],
    });
  });

  it('preserves source order when the current item already fits', () => {
    expect(partitionAppNavigation(items.slice(0, 5), 'b', 188)).toEqual({
      visible: [items[0], items[1], items[2]],
      overflow: [items[3], items[4]],
    });
  });

  it('uses a four-item fallback before measurement and retains current', () => {
    expect(partitionAppNavigation(items, 'f', undefined)).toEqual({
      visible: [items[0], items[1], items[2], items[5]],
      overflow: [items[3], items[4]],
    });
  });

  it('keeps only the current item when no direct slot fits', () => {
    expect(partitionAppNavigation(items.slice(0, 5), 'e', 0)).toEqual({
      visible: [items[4]],
      overflow: items.slice(0, 4),
    });
    expect(partitionAppNavigation(items.slice(0, 5), 'missing', -1)).toEqual({
      visible: [],
      overflow: items.slice(0, 5),
    });
  });
});
