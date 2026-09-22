import { animate, remove as removeAnimations } from 'animejs';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createProductSpring } from './tokens';

const ACTIVATION_DISTANCE_PX = 8;
const QUICK_DISMISS_DISTANCE_PX = 32;
const QUICK_DISMISS_VELOCITY_PX_MS = 0.6;
const RETURN_DEADLINE_MS = 300;
const EXIT_DEADLINE_MS = 300;

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

/** Binds downward dismissal to a visible [data-sheet-drag-handle] inside a sheet. */
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
      startX: number;
      startY: number;
      lastY: number;
      lastTime: number;
      velocityY: number;
      active: boolean;
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

    const now = (event: PointerEvent): number => (
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
    const cancelForAdditionalPointer = (event: PointerEvent) => {
      if (drag === null || drag.pointerId === event.pointerId) return;
      const activePointerId = drag.pointerId;
      drag = null;
      try { handle.releasePointerCapture?.(activePointerId); } catch { /* capture may not be active */ }
      returnToOrigin();
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
    const pointerDown = (event: PointerEvent) => {
      if (drag !== null) {
        if (drag.pointerId !== event.pointerId) {
          const activePointerId = drag.pointerId;
          drag = null;
          try { handle.releasePointerCapture?.(activePointerId); } catch { /* capture may not be active */ }
          returnToOrigin();
        }
        return;
      }
      if (exiting || approvingDismiss || blockedRef.current || !topmostRef.current() || event.isPrimary === false) return;
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if ((event.target as Element | null)?.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
      window.clearTimeout(clickTimer);
      clickTimer = undefined;
      suppressNextClick = false;
      try { returnAnimation?.cancel?.(); } catch { /* best-effort cleanup */ }
      returnAnimation = undefined;
      const time = now(event);
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        lastY: event.clientY,
        lastTime: time,
        velocityY: 0,
        active: false,
      };
    };
    const pointerMove = (event: PointerEvent) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      if (blockedRef.current || !topmostRef.current()) {
        try { handle.releasePointerCapture?.(event.pointerId); } catch { /* capture may not be active */ }
        drag = null;
        returnToOrigin();
        return;
      }
      const dy = event.clientY - drag.startY;
      const dx = event.clientX - drag.startX;
      const time = now(event);
      const elapsed = time - drag.lastTime;
      if (elapsed > 0) drag.velocityY = Math.max(0, (event.clientY - drag.lastY) / elapsed);
      drag.lastY = event.clientY;
      drag.lastTime = time;
      if (!drag.active) {
        if (dy <= ACTIVATION_DISTANCE_PX || dy <= Math.abs(dx)) return;
        drag.active = true;
        stopOpeningMotion();
        handle.setPointerCapture?.(event.pointerId);
        root.setAttribute('data-sheet-dragging', 'true');
        root.style.willChange = 'transform';
      }
      event.preventDefault();
      const height = root.getBoundingClientRect().height;
      const visibleDy = Math.max(0, height > 0 ? Math.min(dy, height) : dy);
      root.style.transform = `translateY(${visibleDy}px)`;
    };
    const pointerEnd = (event: PointerEvent) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      const current = drag;
      drag = null;
      if (!current.active) return;
      event.preventDefault();
      suppressNextClick = true;
      try { handle.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
      const dy = Math.max(0, event.clientY - current.startY);
      const height = root.getBoundingClientRect().height;
      const releaseVelocity = now(event) - current.lastTime <= 80 ? current.velocityY : 0;
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
    const pointerCancel = (event: PointerEvent) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      drag = null;
      try { handle.releasePointerCapture?.(event.pointerId); } catch { /* already released */ }
      returnToOrigin();
    };
    const lostPointerCapture = () => {
      if (drag?.active) returnToOrigin();
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
      if (drag !== null) {
        const activePointerId = drag.pointerId;
        drag = null;
        try { handle.releasePointerCapture?.(activePointerId); } catch { /* capture may not be active */ }
        returnToOrigin();
      }
    };
    const visualViewport = window.visualViewport;

    handle.addEventListener('pointerdown', pointerDown);
    handle.addEventListener('pointermove', pointerMove);
    handle.addEventListener('pointerup', pointerEnd);
    handle.addEventListener('pointercancel', pointerCancel);
    handle.addEventListener('lostpointercapture', lostPointerCapture);
    handle.addEventListener('click', click, true);
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
      handle.removeEventListener('pointerdown', pointerDown);
      handle.removeEventListener('pointermove', pointerMove);
      handle.removeEventListener('pointerup', pointerEnd);
      handle.removeEventListener('pointercancel', pointerCancel);
      handle.removeEventListener('lostpointercapture', lostPointerCapture);
      handle.removeEventListener('click', click, true);
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
