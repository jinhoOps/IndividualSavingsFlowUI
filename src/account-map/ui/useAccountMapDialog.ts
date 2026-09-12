import { useEffect, type RefObject } from 'react';

/** Isolate a portalled Account Map editor, then restore the original page state. */
export function useAccountMapDialog(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const backdrop = ref.current?.parentElement;
    if (backdrop === null || backdrop === undefined) return;
    const siblings = [...document.body.children].filter((element): element is HTMLElement => element instanceof HTMLElement && element !== backdrop);
    const previous = siblings.map((element) => ({ element, inert: element.inert }));
    for (const { element } of previous) element.inert = true;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      for (const { element, inert } of previous) element.inert = inert;
      document.body.style.overflow = overflow;
    };
  }, [ref]);
}
