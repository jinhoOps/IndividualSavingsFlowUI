import { createScope } from 'animejs';
import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';

export interface MotionContext<T extends HTMLElement> {
  root: T;
  reducedMotion: boolean;
}

export function useAnimeScope<T extends HTMLElement>(
  setup: (context: MotionContext<T>) => void,
  dependencies: DependencyList,
): RefObject<T | null> {
  const rootRef = useRef<T>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;

    const scope = createScope({
      root,
      mediaQueries: { reducedMotion: '(prefers-reduced-motion: reduce)' },
    });

    scope.add(() => {
      setup({ root, reducedMotion: scope.matches.reducedMotion === true });
    });

    return () => scope.revert();
    // The caller explicitly controls when its scoped setup is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return rootRef;
}
