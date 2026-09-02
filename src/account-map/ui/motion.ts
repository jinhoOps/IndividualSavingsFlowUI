import { animate } from 'animejs';

export interface MotionOptions {
  reducedMotion: boolean;
  onComplete(): void;
}

export interface AnimationHandle { cancel(): void }

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
