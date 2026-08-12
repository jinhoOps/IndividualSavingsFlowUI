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

    let scope: ReturnType<typeof createScope>;
    try {
      scope = createScope({
        root,
        mediaQueries: { reducedMotion: '(prefers-reduced-motion: reduce)' },
      });
    } catch {
      setup({ root, reducedMotion: true });
      return undefined;
    }
    let consumerFailed = false;
    let consumerError: unknown;

    try {
      scope.add(() => {
        try {
          setup({ root, reducedMotion: scope.matches.reducedMotion === true });
        } catch (error) {
          consumerFailed = true;
          consumerError = error;
          throw error;
        }
      });
    } catch {
      try {
        scope.revert();
      } catch {
        // A partial Anime scope must not mask the consumer error or block final-state fallback.
      }
      if (consumerFailed) throw consumerError;
      setup({ root, reducedMotion: true });
      return undefined;
    }

    return () => scope.revert();
    // The caller explicitly controls when its scoped setup is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return rootRef;
}
