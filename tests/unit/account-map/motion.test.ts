import { beforeEach, describe, expect, it, vi } from 'vitest';

const { animate, update, createLayout } = vi.hoisted(() => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  const update = vi.fn(() => ({ cancel: vi.fn() }));
  const createLayout = vi.fn(() => ({ update, revert: vi.fn() }));
  return { animate, update, createLayout };
});
vi.mock('animejs', () => ({ animate, createLayout }));

import { animateMapLayout, animateModalToNode, animateNodeToModal } from '../../../src/account-map/ui/motion';

beforeEach(() => { animate.mockClear(); createLayout.mockClear(); update.mockClear(); });

describe('Account Map motion', () => {
  it('skips Anime.js when reduced motion is requested', () => {
    const modal = document.createElement('div');
    animateNodeToModal(new DOMRect(10, 10, 80, 40), modal, { reducedMotion: true, onComplete: vi.fn() });
    animateModalToNode(modal, new DOMRect(10, 10, 80, 40), { reducedMotion: true, onComplete: vi.fn() });
    expect(animate).not.toHaveBeenCalled();
  });

  it('animates transform and opacity and exposes cancellation', () => {
    const modal = document.createElement('div');
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 300, 240));
    const handle = animateNodeToModal(new DOMRect(10, 20, 80, 40), modal, { reducedMotion: false, onComplete: vi.fn() });
    expect(animate).toHaveBeenCalledWith(modal, expect.objectContaining({ opacity: [0, 1] }));
    handle.cancel();
  });

  it('records and animates layout changes only when motion is allowed', () => {
    const root = document.createElement('div');
    const mutate = vi.fn();
    animateMapLayout(root, mutate, { reducedMotion: false, onComplete: vi.fn() });
    expect(createLayout).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
    animateMapLayout(root, mutate, { reducedMotion: true, onComplete: vi.fn() });
    expect(mutate).toHaveBeenCalled();
  });
});
