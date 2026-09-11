import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '../../components/common/Button';

export interface JourneyEntryCardProps { enabled: boolean; onContinue(): void; }

/** Discoverable by another scroll at the page end, or ordinary keyboard focus. */
export function JourneyEntryCard({ enabled, onContinue }: JourneyEntryCardProps) {
  const [revealed, setRevealed] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!enabled || revealed) return;
    let lastWheelAt = -Infinity;
    let wheelStartedAtEnd = false;
    let wheelDistance = 0;
    let touchY: number | undefined;
    const atEnd = () => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4;
    const blocked = (target: EventTarget | null) => {
      if (root.current?.closest('[inert], [data-exploration-blocked="true"]')) return true;
      if (!(target instanceof Element)) return false;
      if (target.closest('dialog, [role="dialog"], [role="menu"], [role="listbox"], input, textarea, select, [contenteditable="true"]')) return true;
      for (let parent: Element | null = target; parent && parent !== document.body; parent = parent.parentElement) {
        if (parent.scrollHeight > parent.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(parent).overflowY)) return true;
      }
      return false;
    };
    const wheel = (event: WheelEvent) => {
      const now = performance.now();
      const newGesture = now - lastWheelAt > 220;
      lastWheelAt = now;
      if (newGesture) { wheelStartedAtEnd = atEnd(); wheelDistance = 0; }
      if (blocked(event.target) || event.ctrlKey || event.deltaY <= 0 || Math.abs(event.deltaX) > Math.abs(event.deltaY) || !atEnd()) {
        wheelStartedAtEnd = false; wheelDistance = 0; return;
      }
      if (!wheelStartedAtEnd) return;
      wheelDistance += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1);
      if (wheelDistance >= 64) setRevealed(true);
    };
    const touchStart = (event: TouchEvent) => {
      touchY = event.touches.length === 1 && atEnd() && !blocked(event.target) ? event.touches[0].clientY : undefined;
    };
    const touchMove = (event: TouchEvent) => {
      if (touchY === undefined || event.touches.length !== 1 || blocked(event.target)) return;
      if (touchY - event.touches[0].clientY >= 56) { setRevealed(true); touchY = undefined; }
    };
    const touchEnd = () => { touchY = undefined; };
    window.addEventListener('wheel', wheel, { passive: true });
    window.addEventListener('touchstart', touchStart, { passive: true });
    window.addEventListener('touchmove', touchMove, { passive: true });
    window.addEventListener('touchend', touchEnd, { passive: true });
    window.addEventListener('touchcancel', touchEnd, { passive: true });
    return () => {
      window.removeEventListener('wheel', wheel);
      window.removeEventListener('touchstart', touchStart);
      window.removeEventListener('touchmove', touchMove);
      window.removeEventListener('touchend', touchEnd);
      window.removeEventListener('touchcancel', touchEnd);
    };
  }, [enabled, revealed]);
  useEffect(() => {
    if (!revealed) return;
    const frame = requestAnimationFrame(() => root.current?.scrollIntoView?.({
      block: 'end', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    }));
    return () => cancelAnimationFrame(frame);
  }, [revealed]);
  if (!enabled) return null;
  return (
    <section ref={root} className="main-journey-entry" data-revealed={revealed}
      aria-labelledby="journey-entry-title" onFocusCapture={() => setRevealed(true)}>
      <div className={revealed ? 'main-journey-entry__content' : 'sr-only'}>
        <h2 id="journey-entry-title">이 계획을 계속하면?</h2>
        <p>매달 모으는 돈이 만드는 미래를 살펴보세요.</p>
        <Button variant="quiet" className="journey-action" type="button" onClick={onContinue}>
          미래 성장 보기 <ArrowRight size={18} aria-hidden="true" />
        </Button>
      </div>
    </section>
  );
}
