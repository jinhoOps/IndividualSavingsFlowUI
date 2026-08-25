import { beforeEach, describe, expect, it, vi } from 'vitest';

const { animate } = vi.hoisted(() => {
  const animate = vi.fn(() => ({ cancel: vi.fn() }));
  return { animate };
});
vi.mock('animejs', () => ({ animate }));

import { animateConnectionDetail, animateModalToNode, animateNodeToModal } from '../../../src/account-map/ui/motion';

beforeEach(() => { animate.mockClear(); });

describe('Account Map motion', () => {
  it('skips Anime.js when reduced motion is requested', () => {
    const modal = document.createElement('div');
    const detail = document.createElement('div');
    detail.innerHTML = '<span data-account-map-connection-weight="0.75"></span>';
    animateNodeToModal(new DOMRect(10, 10, 80, 40), modal, { reducedMotion: true, onComplete: vi.fn() });
    animateModalToNode(modal, new DOMRect(10, 10, 80, 40), { reducedMotion: true, onComplete: vi.fn() });
    const onComplete = vi.fn();
    animateConnectionDetail(detail, { reducedMotion: true, onComplete });
    expect(animate).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('animates only connection weight fills from zero to their supplied final proportion', () => {
    const detail = document.createElement('div');
    detail.innerHTML = '<span data-account-map-connection-weight="0.25"></span><span data-account-map-connection-weight="0.75"></span>';

    animateConnectionDetail(detail, { reducedMotion: false, onComplete: vi.fn() });

    expect(animate).toHaveBeenNthCalledWith(1, detail.querySelector('[data-account-map-connection-weight="0.25"]'), expect.objectContaining({ scaleX: [0, 0.25], delay: 0 }));
    expect(animate).toHaveBeenNthCalledWith(2, detail.querySelector('[data-account-map-connection-weight="0.75"]'), expect.objectContaining({ scaleX: [0, 0.75], delay: 40 }));
  });

  it('animates transform and opacity and exposes cancellation', () => {
    const modal = document.createElement('div');
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 300, 240));
    const handle = animateNodeToModal(new DOMRect(10, 20, 80, 40), modal, { reducedMotion: false, onComplete: vi.fn() });
    expect(animate).toHaveBeenCalledWith(modal, expect.objectContaining({ opacity: [0, 1] }));
    handle.cancel();
  });

});
