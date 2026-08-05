const RETIRED_JOURNEY_STORAGE_KEY = 'isf-journey-snapshot-v1';

export function purgeRetiredStorage(
  getStorage: () => Storage = () => window.localStorage,
): void {
  try {
    getStorage().removeItem(RETIRED_JOURNEY_STORAGE_KEY);
  } catch {
    // Retired data must not block Main.
  }
}
