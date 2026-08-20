import { createScope } from 'animejs';
import { useLayoutEffect, useRef, type DependencyList, type RefObject } from 'react';
import { attemptMotion } from './attemptMotion';

export interface MotionContext<T extends HTMLElement> {
  root: T;
  reducedMotion: boolean;
}

export type MotionCleanup = () => void;

export function useAnimeScope<T extends HTMLElement>(
  setup: (context: MotionContext<T>) => void | MotionCleanup,
  dependencies: DependencyList,
): RefObject<T | null> {
  const rootRef = useRef<T>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;

    let consumerCleanup: MotionCleanup | undefined;
    let scope: ReturnType<typeof createScope>;
    try {
      scope = createScope({
        root,
        mediaQueries: { reducedMotion: '(prefers-reduced-motion: reduce)' },
      });
    } catch {
      const fallbackCleanup = setup({ root, reducedMotion: true });
      return typeof fallbackCleanup === 'function'
        ? () => { attemptMotion(fallbackCleanup); }
        : undefined;
    }
    let consumerFailed = false;
    let consumerError: unknown;

    try {
      scope.add(() => {
        try {
          const result = setup({ root, reducedMotion: scope.matches.reducedMotion === true });
          if (typeof result === 'function') consumerCleanup = result;
        } catch (error) {
          consumerFailed = true;
          consumerError = error;
          throw error;
        }
      });
    } catch {
      if (consumerCleanup !== undefined) attemptMotion(consumerCleanup);
      try {
        scope.revert();
      } catch {
        // A partial Anime scope must not mask the consumer error or block final-state fallback.
      }
      if (consumerFailed) throw consumerError;
      const fallbackCleanup = setup({ root, reducedMotion: true });
      return typeof fallbackCleanup === 'function'
        ? () => { attemptMotion(fallbackCleanup); }
        : undefined;
    }

    return () => {
      if (consumerCleanup !== undefined) attemptMotion(consumerCleanup);
      attemptMotion(() => scope.revert());
    };
    // The caller explicitly controls when its scoped setup is recreated.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  return rootRef;
}
