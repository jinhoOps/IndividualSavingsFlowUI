import { useEffect, useState } from 'react';

export function useDelayedPending(pending: boolean, delayMs = 600): boolean {
  const [visiblePending, setVisiblePending] = useState(false);

  useEffect(() => {
    if (!pending) {
      setVisiblePending(false);
      return undefined;
    }

    const timer = window.setTimeout(() => setVisiblePending(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, pending]);

  return visiblePending;
}
