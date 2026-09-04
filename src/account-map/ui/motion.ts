import { animate } from 'animejs';
import { MOTION_DISTANCE_PX, MOTION_DURATION, MOTION_EASE } from '../../components/motion/tokens';

export interface MotionOptions {
  reducedMotion: boolean;
  onComplete(): void;
}

export interface AnimationHandle { cancel(): void }

export function setSetupStepFinalState(root: HTMLElement): void {
  root.style.opacity = '1';
  root.style.transform = 'translateY(0px)';
  root.style.removeProperty('will-change');
}

/**
 * Setup steps must never depend on a completed animation to become readable.
 * The returned cancellation path intentionally reaches the same final state.
 */
export function animateSetupStep(
  root: HTMLElement,
  direction: 'forward' | 'backward',
  reducedMotion: boolean,
): AnimationHandle {
  resetSetupStepStartState(root);
  if (reducedMotion) {
    setSetupStepFinalState(root);
    return noAnimation;
  }

  const distance = direction === 'backward' ? -MOTION_DISTANCE_PX.reveal : MOTION_DISTANCE_PX.reveal;
  let animation: { cancel(): void } | null = null;
  try {
    root.style.opacity = '0';
    root.style.transform = `translateY(${distance}px)`;
    root.style.willChange = 'transform, opacity';
    animation = animate(root, {
      opacity: [0, 1],
      translateY: [distance, 0],
      duration: MOTION_DURATION.normal,
      ease: MOTION_EASE.enter,
      onComplete: () => setSetupStepFinalState(root),
    });
  } catch {
    setSetupStepFinalState(root);
    return noAnimation;
  }
  return {
    cancel: () => {
      try {
        animation?.cancel();
      } catch {
        // A cancelled Anime.js instance must not strand the setup surface.
      } finally {
        setSetupStepFinalState(root);
      }
    },
  };
}

export function animateNodeToModal(
  nodeRect: DOMRect,
  modal: HTMLElement,
  options: MotionOptions,
): AnimationHandle {
  if (options.reducedMotion) {
    clearMotionStyles(modal);
    options.onComplete();
    return noAnimation;
  }
  const destination = modal.getBoundingClientRect();
  const scaleX = safeScale(nodeRect.width, destination.width);
  const scaleY = safeScale(nodeRect.height, destination.height);
  modal.style.transformOrigin = 'top left';
  modal.style.willChange = 'transform, opacity';
  const animation = animate(modal, {
    opacity: [0, 1],
    translateX: [nodeRect.left - destination.left, 0],
    translateY: [nodeRect.top - destination.top, 0],
    scaleX: [scaleX, 1],
    scaleY: [scaleY, 1],
    duration: 320,
    ease: 'out(3)',
    onComplete: () => finish(modal, options.onComplete),
  });
  return { cancel: () => { animation.cancel(); clearMotionStyles(modal); } };
}

export function animateModalToNode(
  modal: HTMLElement,
  nodeRect: DOMRect,
  options: MotionOptions,
): AnimationHandle {
  if (options.reducedMotion) {
    clearMotionStyles(modal);
    options.onComplete();
    return noAnimation;
  }
  const source = modal.getBoundingClientRect();
  modal.style.transformOrigin = 'top left';
  modal.style.willChange = 'transform, opacity';
  const animation = animate(modal, {
    opacity: [1, 0],
    translateX: [0, nodeRect.left - source.left],
    translateY: [0, nodeRect.top - source.top],
    scaleX: [1, safeScale(nodeRect.width, source.width)],
    scaleY: [1, safeScale(nodeRect.height, source.height)],
    duration: 260,
    ease: 'in(3)',
    onComplete: () => finish(modal, options.onComplete),
  });
  return { cancel: () => { animation.cancel(); clearMotionStyles(modal); } };
}

export function animateConnectionDetail(root: HTMLElement, options: MotionOptions): AnimationHandle {
  const weights = [...root.querySelectorAll<HTMLElement>('[data-account-map-connection-weight]')];
  if (options.reducedMotion) {
    weights.forEach(clearConnectionDetailMotionStyles);
    options.onComplete();
    return noAnimation;
  }
  if (weights.length === 0) {
    options.onComplete();
    return noAnimation;
  }
  const animations: Array<{ cancel(): void }> = [];
  let completed = false;
  const complete = () => {
    if (completed) return;
    completed = true;
    weights.forEach(clearConnectionDetailMotionStyles);
    options.onComplete();
  };
  try {
    weights.forEach((weight, index) => {
      const finalWeight = Number(weight.dataset.accountMapConnectionWeight);
      weight.style.transformOrigin = 'left center';
      weight.style.willChange = 'transform';
      animations.push(animate(weight, {
        scaleX: [0, Number.isFinite(finalWeight) ? finalWeight : 0],
        duration: 180,
        delay: index * 40,
        ease: 'out(3)',
        ...(index === weights.length - 1 ? { onComplete: complete } : {}),
      }));
    });
  } catch {
    animations.forEach((animation) => animation.cancel());
    complete();
    return noAnimation;
  }
  return {
    cancel: () => {
      animations.forEach((animation) => animation.cancel());
      weights.forEach(clearConnectionDetailMotionStyles);
    },
  };
}

/** A focused flow is present before motion begins and remains visible on every exit path. */
export function animateFocusedFlow(root: HTMLElement, reducedMotion: boolean): AnimationHandle {
  const elements = [...root.querySelectorAll<HTMLElement>('[data-account-flow-edge], [data-account-flow-edge-amount]')];
  const finish = () => elements.forEach(clearFocusedFlowMotionStyles);
  if (reducedMotion || elements.length === 0) {
    finish();
    return noAnimation;
  }
  const animations: Array<{ cancel(): void }> = [];
  try {
    elements.forEach((element, index) => {
      element.style.opacity = '0';
      element.style.willChange = 'opacity';
      animations.push(animate(element, {
        opacity: [0, 1],
        duration: MOTION_DURATION.normal,
        delay: index * 24,
        ease: MOTION_EASE.enter,
        ...(index === elements.length - 1 ? { onComplete: finish } : {}),
      }));
    });
  } catch {
    animations.forEach((animation) => { try { animation.cancel(); } catch { /* Final state wins. */ } });
    finish();
    return noAnimation;
  }
  return {
    cancel: () => {
      animations.forEach((animation) => { try { animation.cancel(); } catch { /* Final state wins. */ } });
      finish();
    },
  };
}

const noAnimation: AnimationHandle = { cancel() {} };
function safeScale(part: number, whole: number): number { return whole > 0 ? part / whole : 1; }
function finish(element: HTMLElement, onComplete: () => void) { clearMotionStyles(element); onComplete(); }
function clearMotionStyles(element: HTMLElement) {
  element.style.removeProperty('opacity');
  element.style.removeProperty('transform');
  element.style.removeProperty('translate');
  element.style.removeProperty('scale');
  element.style.removeProperty('transform-origin');
  element.style.removeProperty('will-change');
}

function clearConnectionDetailMotionStyles(element: HTMLElement) {
  element.style.removeProperty('transform');
  element.style.removeProperty('transform-origin');
  element.style.removeProperty('will-change');
}

function clearFocusedFlowMotionStyles(element: HTMLElement) {
  element.style.removeProperty('opacity');
  element.style.removeProperty('stroke-dashoffset');
  element.style.removeProperty('will-change');
}

function resetSetupStepStartState(root: HTMLElement): void {
  root.style.removeProperty('opacity');
  root.style.removeProperty('transform');
  root.style.removeProperty('translate');
  root.style.removeProperty('will-change');
}
