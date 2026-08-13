import { animate, createLayout } from 'animejs';

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

export function animateMapLayout(
  root: HTMLElement,
  mutate: () => void,
  options: MotionOptions,
): AnimationHandle {
  if (options.reducedMotion) {
    mutate();
    options.onComplete();
    return noAnimation;
  }
  const layout = createLayout(root, { children: '.account-map-node' });
  const animation = layout.update(() => mutate(), {
    duration: 360,
    ease: 'out(3)',
    onComplete: options.onComplete,
  });
  return { cancel: () => { animation.cancel(); layout.revert(); } };
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
