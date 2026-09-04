import { beforeEach, describe, expect, it, vi } from 'vitest';

type AnimateStub = (target: unknown, options: { onComplete?(): void }) => { cancel(): void };

const { animate } = vi.hoisted(() => {
  const animate = vi.fn<AnimateStub>(() => ({ cancel: vi.fn() }));
  return { animate };
});
vi.mock('animejs', () => ({ animate }));

import {
  animateFocusedFlow,
  animateConnectionDetail,
  animateModalToNode,
  animateNodeToModal,
  animateSetupStep,
  setSetupStepFinalState,
} from '../../../src/account-map/ui/motion';

beforeEach(() => {
  animate.mockReset();
  animate.mockImplementation(() => ({ cancel: vi.fn() }));
});

describe('Account Map motion', () => {
  it('restores focused-flow paths and labels when Anime.js synchronously throws', () => {
    const root = document.createElement('div');
    root.innerHTML = '<path data-account-flow-edge></path><span data-account-flow-edge-amount></span>';
    animate.mockImplementation(() => { throw new Error('Anime.js unavailable'); });

    const handle = animateFocusedFlow(root, false);

    expect(root.querySelector<HTMLElement>('[data-account-flow-edge]')?.style.opacity).toBe('');
    expect(root.querySelector<HTMLElement>('[data-account-flow-edge-amount]')?.style.opacity).toBe('');
    expect(() => handle.cancel()).not.toThrow();
  });

  it('renders focused flow synchronously for reduced motion and restores it if cancellation throws', () => {
    const reducedRoot = document.createElement('div');
    reducedRoot.innerHTML = '<path data-account-flow-edge></path><span data-account-flow-edge-amount></span>';
    animateFocusedFlow(reducedRoot, true);
    expect(animate).not.toHaveBeenCalled();
    expect(reducedRoot.querySelector<HTMLElement>('[data-account-flow-edge]')?.style.opacity).toBe('');

    const animatedRoot = document.createElement('div');
    animatedRoot.innerHTML = '<path data-account-flow-edge></path><span data-account-flow-edge-amount></span>';
    animate.mockImplementation((target) => {
      if (target instanceof HTMLElement) target.style.opacity = '0';
      return { cancel: () => { throw new Error('cancel failed'); } };
    });
    const handle = animateFocusedFlow(animatedRoot, false);
    expect(() => handle.cancel()).not.toThrow();
    expect([...animatedRoot.querySelectorAll<HTMLElement>('[data-account-flow-edge], [data-account-flow-edge-amount]')]
      .map((element) => ({ opacity: element.style.opacity, willChange: element.style.willChange })))
      .toEqual([{ opacity: '', willChange: '' }, { opacity: '', willChange: '' }]);
  });

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

  it('clears a partial connection transform and completes once when Anime.js throws', () => {
    const detail = document.createElement('div');
    detail.innerHTML = [
      '<span data-account-map-connection-weight="0.25" style="--account-map-connection-weight: 0.25"></span>',
      '<span data-account-map-connection-weight="0.75" style="--account-map-connection-weight: 0.75"></span>',
    ].join('');
    const firstAnimation = { cancel: vi.fn() };
    animate
      .mockImplementationOnce((...args: unknown[]) => {
        const [target] = args;
        if (target instanceof HTMLElement) target.style.transform = 'scaleX(0)';
        return firstAnimation;
      })
      .mockImplementationOnce(() => {
        throw new Error('Anime.js unavailable');
      });
    const onComplete = vi.fn();

    const handle = animateConnectionDetail(detail, { reducedMotion: false, onComplete });

    const weights = [...detail.querySelectorAll<HTMLElement>('[data-account-map-connection-weight]')];
    expect(firstAnimation.cancel).toHaveBeenCalledOnce();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(weights.map((weight) => weight.style.getPropertyValue('--account-map-connection-weight')))
      .toEqual(['0.25', '0.75']);
    expect(weights.map((weight) => weight.style.transform)).toEqual(['', '']);
    expect(weights.map((weight) => weight.style.willChange)).toEqual(['', '']);
    expect(weights.map((weight) => weight.style.transformOrigin)).toEqual(['', '']);
    const finalState = weights.map((weight) => ({
      customProperty: weight.style.getPropertyValue('--account-map-connection-weight'),
      transform: weight.style.transform,
      transformOrigin: weight.style.transformOrigin,
      willChange: weight.style.willChange,
    }));

    expect(() => handle.cancel()).not.toThrow();
    expect(onComplete).toHaveBeenCalledOnce();
    expect(weights.map((weight) => ({
      customProperty: weight.style.getPropertyValue('--account-map-connection-weight'),
      transform: weight.style.transform,
      transformOrigin: weight.style.transformOrigin,
      willChange: weight.style.willChange,
    }))).toEqual(finalState);
  });

  it('animates transform and opacity and exposes cancellation', () => {
    const modal = document.createElement('div');
    vi.spyOn(modal, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 300, 240));
    const handle = animateNodeToModal(new DOMRect(10, 20, 80, 40), modal, { reducedMotion: false, onComplete: vi.fn() });
    expect(animate).toHaveBeenCalledWith(modal, expect.objectContaining({ opacity: [0, 1] }));
    handle.cancel();
  });

  it('settles setup content after a normal Anime.js completion', () => {
    const root = document.createElement('section');
    animate.mockImplementation((_target, options: { onComplete?(): void }) => {
      options.onComplete?.();
      return { cancel: vi.fn() };
    });

    animateSetupStep(root, 'forward', false);

    expect(animate).toHaveBeenCalledWith(root, expect.objectContaining({
      opacity: [0, 1],
      translateY: expect.any(Array),
    }));
    expectSetupFinalState(root);
  });

  it('settles setup content without Anime.js for reduced motion', () => {
    const root = document.createElement('section');
    root.style.opacity = '0';
    root.style.transform = 'translateY(12px)';

    animateSetupStep(root, 'forward', true);

    expect(animate).not.toHaveBeenCalled();
    expectSetupFinalState(root);
  });

  it('settles setup content when Anime.js throws or cancellation throws', () => {
    const unavailableRoot = document.createElement('section');
    animate.mockImplementation(() => { throw new Error('Anime.js unavailable'); });

    const unavailable = animateSetupStep(unavailableRoot, 'forward', false);

    expect(() => unavailable.cancel()).not.toThrow();
    expectSetupFinalState(unavailableRoot);

    const cancelledRoot = document.createElement('section');
    animate.mockImplementation(() => ({ cancel: () => { throw new Error('cancel failed'); } }));
    const cancelled = animateSetupStep(cancelledRoot, 'backward', false);

    expect(() => cancelled.cancel()).not.toThrow();
    expectSetupFinalState(cancelledRoot);
    setSetupStepFinalState(cancelledRoot);
    expectSetupFinalState(cancelledRoot);
  });

});

function expectSetupFinalState(root: HTMLElement): void {
  expect(root.style.opacity).toBe('1');
  expect(root.style.transform).toBe('translateY(0px)');
}
