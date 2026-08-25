import { beforeEach, describe, expect, it, vi } from 'vitest';

const { animate } = vi.hoisted(() => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  return { animate };
});
vi.mock('animejs', () => ({ animate }));

import { animateModalToNode, animateNodeToModal } from '../../../src/account-map/ui/motion';

beforeEach(() => { animate.mockClear(); });

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

});
