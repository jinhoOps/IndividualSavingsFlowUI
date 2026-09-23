import { animate, remove as removeAnimations } from 'animejs';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createProductSpring } from './tokens';

const ACTIVATION_DISTANCE_PX = 8;
const QUICK_DISMISS_DISTANCE_PX = 32;
const QUICK_DISMISS_VELOCITY_PX_MS = 0.6;
const RETURN_DEADLINE_MS = 300;
const EXIT_DEADLINE_MS = 300;
const interactiveSelector = [
  'input', 'textarea', 'select', 'button', 'a[href]', 'label', 'summary',
  '[contenteditable]:not([contenteditable="false"])', '[role="button"]',
  '[role="slider"]', '[role="switch"]', '[role="checkbox"]',
  '[role="radio"]', '[role="combobox"]', '[tabindex]:not([tabindex="-1"])',
  '[data-sheet-no-drag]',
].join(',');

type AnimationHandle = { cancel?(): void };

export interface UseSheetDismissOptions {
  rootRef: RefObject<HTMLElement | null>;
  backdropRef?: RefObject<HTMLElement | null>;
  enabled: boolean;
  blocked?: boolean;
  isTopmost?: () => boolean;
  mediaQuery?: string;
  onRequestDismiss(): boolean | void | Promise<boolean | void>;
  onDismissed?(): void;
}

/** Binds sheet dismissal to non-interactive surface space while preserving body scrolling. */
export function useSheetDismiss({
  rootRef,
  backdropRef,
  enabled,
  blocked = false,
  isTopmost = () => true,
  mediaQuery,
  onRequestDismiss,
  onDismissed,
}: UseSheetDismissOptions): void {
  const [matchesMedia, setMatchesMedia] = useState(() => (
    mediaQuery === undefined
      ? true
      : typeof window !== 'undefined' && window.matchMedia?.(mediaQuery).matches === true
  ));
  const blockedRef = useRef(blocked);
  const topmostRef = useRef(isTopmost);
  const dismissRef = useRef(onRequestDismiss);
  const dismissedRef = useRef(onDismissed);
  blockedRef.current = blocked;
  topmostRef.current = isTopmost;
  dismissRef.current = onRequestDismiss;
  dismissedRef.current = onDismissed;

  useEffect(() => {
    if (mediaQuery === undefined || typeof window === 'undefined' || window.matchMedia === undefined) {
      setMatchesMedia(mediaQuery === undefined);
      return undefined;
    }
    const media = window.matchMedia(mediaQuery);
    const update = () => setMatchesMedia(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [mediaQuery]);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null || !enabled || !matchesMedia) return undefined;
    const handle = root.querySelector<HTMLElement>('[data-sheet-drag-handle]');
    if (handle === null || handle.closest('[hidden]') !== null) return undefined;

    let drag: {
      pointerId: number;
      source: 'pointer' | 'touch';
      startX: number;
      startY: number;
      lastY: number;
      lastTime: number;
      velocityY: number;
      active: boolean;
      scrolling: boolean;
      scrollContainer: HTMLElement | null;
    } | null = null;
    let exiting = false;
    let suppressNextClick = false;
    let returnTimer: number | undefined;
    let clickTimer: number | undefined;
    let exitTimer: number | undefined;
    let returnAnimation: AnimationHandle | undefined;
    let exitAnimation: AnimationHandle | undefined;
    let backdropAnimation: AnimationHandle | undefined;
    let finishExit: (() => void) | undefined;
    let returnGeneration = 0;
    let returning = false;
    let approvingDismiss = false;
    let exitAfterReturn = false;
    let touchSelectionAtStart = '';

    const now = (event: Event): number => (
      Number.isFinite(event.timeStamp) && event.timeStamp > 0 ? event.timeStamp : performance.now()
    );
    const clearDragStyles = () => {
      window.clearTimeout(returnTimer);
      returnTimer = undefined;
      root.removeAttribute('data-sheet-dragging');
      root.style.removeProperty('will-change');
      root.style.removeProperty('transform');
      root.style.removeProperty('translate');
    };
    const stopOpeningMotion = () => {
      try { removeAnimations(root); } catch { /* best-effort cancellation */ }
      root.style.removeProperty('bottom');
      root.style.removeProperty('right');
      root.style.removeProperty('opacity');
      root.style.removeProperty('translate');
      root.style.removeProperty('transform');
    };
    const returnToOrigin = () => {
      const transform = root.style.transform;
      const match = transform.match(/translateY\((-?[\d.]+)px\)/);
      const currentY = match === null ? 0 : Number(match[1]);
      const generation = ++returnGeneration;
      const finish = () => {
        if (generation !== returnGeneration) return;
        returning = false;
        returnAnimation = undefined;
        clearDragStyles();
        if (exitAfterReturn && root.isConnected && dismissedRef.current !== undefined) {
          exitAfterReturn = false;
          exiting = true;
          exitSheet(0);
        }
      };
      if (currentY === 0 || !Number.isFinite(currentY)) {
        try { returnAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
        finish();
        return;
      }
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        try { returnAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
        finish();
        return;
      }
      let finished = false;
      const finishAnimation = () => {
        if (finished || generation !== returnGeneration) return;
        finished = true;
        finish();
      };
      returning = true;
      window.clearTimeout(returnTimer);
      try { returnAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
      try {
        returnAnimation = animate(root, {
          translateY: [currentY, 0],
          ease: createProductSpring('return'),
          onComplete: finishAnimation,
        });
        if (!finished) returnTimer = window.setTimeout(finishAnimation, RETURN_DEADLINE_MS);
      } catch {
        finishAnimation();
      }
    };
    const cancelActiveDrag = () => {
      if (drag === null) return;
      const current = drag;
      drag = null;
      if (current.source === 'pointer') {
        try { root.releasePointerCapture?.(current.pointerId); } catch { /* capture may not be active */ }
      }
      returnToOrigin();
    };
    const cancelForAdditionalPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (drag === null || drag.pointerId === event.pointerId) return;
      cancelActiveDrag();
      event.stopPropagation();
    };
    const exitSheet = (currentY: number) => {
      let finished = false;
      const finish = () => {
        if (finished || !exiting) return;
        finished = true;
        exiting = false;
        window.clearTimeout(exitTimer);
        exitTimer = undefined;
        exitAnimation = undefined;
        backdropAnimation = undefined;
        finishExit = undefined;
        dismissedRef.current?.();
      };
      finishExit = finish;
      if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
        finish();
        return;
      }
      const height = root.getBoundingClientRect().height;
      root.setAttribute('data-sheet-exiting', 'true');
      root.style.willChange = 'transform, opacity';
      backdropRef?.current?.setAttribute('data-sheet-exiting', 'true');
      // Pointer tracking uses transform directly; hand off to Anime's translate
      // channel from the same offset so the release never jumps back to zero.
      root.style.removeProperty('transform');
      try {
        exitAnimation = animate(root, {
          translateY: [currentY, Math.max(height, currentY) + 16],
          opacity: [1, 0],
          ease: createProductSpring('exit'),
          onComplete: finish,
        });
        if (backdropRef?.current !== null && backdropRef?.current !== undefined) {
          backdropAnimation = animate(backdropRef.current, {
            opacity: [1, 0],
            ease: createProductSpring('exit'),
          });
        }
        if (!finished) exitTimer = window.setTimeout(finish, EXIT_DEADLINE_MS);
      } catch {
        finish();
      }
    };
    const getScrollContainer = (target: Element): HTMLElement | null => {
      const surfaceBody = target.closest<HTMLElement>('[data-surface-body]');
      if (surfaceBody === null) return null;
      let current = target instanceof HTMLElement ? target : surfaceBody;
      while (surfaceBody.contains(current)) {
        const overflowY = window.getComputedStyle(current).overflowY;
        if (current === surfaceBody || overflowY === 'auto' || overflowY === 'scroll') return current;
        if (current.parentElement === null) break;
        current = current.parentElement;
      }
      return surfaceBody;
    };
    const startDrag = (
      target: EventTarget | null,
      pointerId: number,
      source: 'pointer' | 'touch',
      clientX: number,
      clientY: number,
      time: number,
      isPrimary = true,
    ) => {
      if (drag !== null) {
        if (drag.pointerId !== pointerId || drag.source !== source) cancelActiveDrag();
        return;
      }
      if (exiting || approvingDismiss || blockedRef.current || !topmostRef.current() || !isPrimary) return;
      const element = target instanceof Element ? target : null;
      if (element === null || element === root || element.closest(interactiveSelector) !== null) return;
      const scrollContainer = getScrollContainer(element);
      window.clearTimeout(clickTimer);
      clickTimer = undefined;
      suppressNextClick = false;
      try { returnAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
      returnAnimation = undefined;
      drag = {
        pointerId,
        source,
        startX: clientX,
        startY: clientY,
        lastY: clientY,
        lastTime: time,
        velocityY: 0,
        active: false,
        scrolling: scrollContainer !== null && scrollContainer.scrollTop > 0,
        scrollContainer,
      };
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      startDrag(event.target, event.pointerId, 'pointer', event.clientX, event.clientY, now(event), event.isPrimary !== false);
    };
    const updateDrag = (
      pointerId: number,
      source: 'pointer' | 'touch',
      clientX: number,
      clientY: number,
      time: number,
      preventDefault: () => void,
    ) => {
      if (drag === null || drag.pointerId !== pointerId || drag.source !== source) return;
      if (blockedRef.current || !topmostRef.current()) {
        cancelActiveDrag();
        return;
      }
      if (drag.scrolling || (drag.scrollContainer !== null && drag.scrollContainer.scrollTop > 0)) {
        drag.scrolling = true;
        return;
      }
      const dy = clientY - drag.startY;
      const dx = clientX - drag.startX;
      if (drag.scrollContainer !== null && dy < -ACTIVATION_DISTANCE_PX && Math.abs(dy) > Math.abs(dx)) {
        // An upward body gesture belongs to native scrolling for its full lifetime,
        // even if the browser later bounces at scrollTop 0.
        drag.scrolling = true;
        return;
      }
      const elapsed = time - drag.lastTime;
      if (elapsed > 0) drag.velocityY = Math.max(0, (clientY - drag.lastY) / elapsed);
      drag.lastY = clientY;
      drag.lastTime = time;
      if (!drag.active) {
        if (dy <= ACTIVATION_DISTANCE_PX || dy <= Math.abs(dx)) return;
        drag.active = true;
        stopOpeningMotion();
        if (source === 'pointer') root.setPointerCapture?.(pointerId);
        root.setAttribute('data-sheet-dragging', 'true');
        root.style.willChange = 'transform';
      }
      preventDefault();
      const height = root.getBoundingClientRect().height;
      const visibleDy = Math.max(0, height > 0 ? Math.min(dy, height) : dy);
      root.style.transform = `translateY(${visibleDy}px)`;
    };
    const pointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      updateDrag(event.pointerId, 'pointer', event.clientX, event.clientY, now(event), () => event.preventDefault());
    };
    const findTouch = (touches: TouchList, identifier: number): Touch | undefined => {
      for (let index = 0; index < touches.length; index += 1) {
        if (touches[index].identifier === identifier) return touches[index];
      }
      return undefined;
    };
    const touchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) {
        cancelActiveDrag();
        return;
      }
      touchSelectionAtStart = window.getSelection()?.toString() ?? '';
      const touch = event.touches[0];
      startDrag(event.target, touch.identifier, 'touch', touch.clientX, touch.clientY, now(event));
    };
    const touchMove = (event: TouchEvent) => {
      if (drag?.source !== 'touch') return;
      if (event.touches.length !== 1) {
        cancelActiveDrag();
        return;
      }
      const touch = findTouch(event.touches, drag.pointerId);
      if (touch === undefined) return;
      const selectedText = window.getSelection()?.toString() ?? '';
      if (selectedText !== touchSelectionAtStart) {
        touchSelectionAtStart = selectedText;
        cancelActiveDrag();
        return;
      }
      updateDrag(touch.identifier, 'touch', touch.clientX, touch.clientY, now(event), () => event.preventDefault());
    };
    const finishDrag = (
      pointerId: number,
      source: 'pointer' | 'touch',
      clientY: number,
      time: number,
      preventDefault: () => void,
    ) => {
      if (drag === null || drag.pointerId !== pointerId || drag.source !== source) return;
      const current = drag;
      drag = null;
      if (!current.active) return;
      preventDefault();
      suppressNextClick = true;
      if (source === 'pointer') {
        try { root.releasePointerCapture?.(pointerId); } catch { /* already released */ }
      }
      const dy = Math.max(0, clientY - current.startY);
      const height = root.getBoundingClientRect().height;
      const releaseVelocity = time - current.lastTime <= 80 ? current.velocityY : 0;
      root.style.transform = `translateY(${Math.max(0, height > 0 ? Math.min(dy, height) : dy)}px)`;
      const threshold = Math.min(140, Math.max(80, height * 0.2));
      const shouldDismiss = dy >= threshold
        || (dy >= QUICK_DISMISS_DISTANCE_PX && releaseVelocity >= QUICK_DISMISS_VELOCITY_PX_MS);
      root.removeAttribute('data-sheet-dragging');
      clickTimer = window.setTimeout(() => {
        suppressNextClick = false;
        clickTimer = undefined;
      }, 500);
      if (shouldDismiss && !blockedRef.current && topmostRef.current()) {
        let requestAccepted: boolean | void | Promise<boolean | void>;
        try {
          requestAccepted = dismissRef.current();
        } catch {
          returnToOrigin();
          return;
        }
        if (requestAccepted !== null && typeof requestAccepted === 'object'
          && typeof requestAccepted.then === 'function') {
          approvingDismiss = true;
          void Promise.resolve(requestAccepted).then((approved) => {
            approvingDismiss = false;
            if (approved === false || !root.isConnected || dismissedRef.current === undefined) return;
            if (returning) exitAfterReturn = true;
            else {
              exiting = true;
              exitSheet(0);
            }
          }).catch(() => { approvingDismiss = false; });
          returnToOrigin();
        } else if (requestAccepted === false) {
          returnToOrigin();
        } else if (dismissedRef.current !== undefined) {
          exiting = true;
          exitSheet(dy);
        } else {
          queueMicrotask(() => {
            if (root.isConnected) returnToOrigin();
          });
        }
      } else {
        returnToOrigin();
      }
    };
    const pointerEnd = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      finishDrag(event.pointerId, 'pointer', event.clientY, now(event), () => event.preventDefault());
    };
    const touchEnd = (event: TouchEvent) => {
      if (drag?.source !== 'touch') return;
      const touch = findTouch(event.changedTouches, drag.pointerId);
      if (touch === undefined) return;
      touchSelectionAtStart = '';
      finishDrag(touch.identifier, 'touch', touch.clientY, now(event), () => event.preventDefault());
    };
    const cancelDrag = (pointerId: number, source: 'pointer' | 'touch') => {
      if (drag === null || drag.pointerId !== pointerId || drag.source !== source) return;
      cancelActiveDrag();
    };
    const pointerCancel = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      cancelDrag(event.pointerId, 'pointer');
    };
    const touchCancel = (event: TouchEvent) => {
      if (drag?.source !== 'touch') return;
      const touch = findTouch(event.changedTouches, drag.pointerId);
      if (touch !== undefined) {
        touchSelectionAtStart = '';
        cancelDrag(touch.identifier, 'touch');
      }
    };
    const lostPointerCapture = (event: PointerEvent) => {
      if (drag?.source !== 'pointer' || drag.pointerId !== event.pointerId) return;
      if (drag.active) returnToOrigin();
      drag = null;
    };
    const click = (event: MouseEvent) => {
      if (!suppressNextClick) return;
      suppressNextClick = false;
      window.clearTimeout(clickTimer);
      clickTimer = undefined;
      event.preventDefault();
      event.stopPropagation();
    };
    const resize = () => {
      if (exiting) finishExit?.();
      if (drag !== null) cancelActiveDrag();
    };
    const touchMoveOptions: AddEventListenerOptions = { passive: false };
    const visualViewport = window.visualViewport;

    root.addEventListener('pointerdown', pointerDown);
    root.addEventListener('pointermove', pointerMove);
    root.addEventListener('pointerup', pointerEnd);
    root.addEventListener('pointercancel', pointerCancel);
    root.addEventListener('lostpointercapture', lostPointerCapture);
    root.addEventListener('touchstart', touchStart);
    root.addEventListener('touchmove', touchMove, touchMoveOptions);
    root.addEventListener('touchend', touchEnd);
    root.addEventListener('touchcancel', touchCancel);
    root.addEventListener('click', click, true);
    window.addEventListener('pointerdown', cancelForAdditionalPointer, true);
    window.addEventListener('resize', resize);
    visualViewport?.addEventListener('resize', resize);
    return () => {
      drag = null;
      returnGeneration += 1;
      returning = false;
      approvingDismiss = false;
      exitAfterReturn = false;
      try { returnAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
      try { exitAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
      try { backdropAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
      root.removeEventListener('pointerdown', pointerDown);
      root.removeEventListener('pointermove', pointerMove);
      root.removeEventListener('pointerup', pointerEnd);
      root.removeEventListener('pointercancel', pointerCancel);
      root.removeEventListener('lostpointercapture', lostPointerCapture);
      root.removeEventListener('touchstart', touchStart);
      root.removeEventListener('touchmove', touchMove, touchMoveOptions);
      root.removeEventListener('touchend', touchEnd);
      root.removeEventListener('touchcancel', touchCancel);
      root.removeEventListener('click', click, true);
      window.removeEventListener('pointerdown', cancelForAdditionalPointer, true);
      window.removeEventListener('resize', resize);
      visualViewport?.removeEventListener('resize', resize);
      window.clearTimeout(clickTimer);
      window.clearTimeout(exitTimer);
      clearDragStyles();
      root.removeAttribute('data-sheet-exiting');
      backdropRef?.current?.removeAttribute('data-sheet-exiting');
    };
  }, [backdropRef, enabled, matchesMedia, rootRef]);
}
