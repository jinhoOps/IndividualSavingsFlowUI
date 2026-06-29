const STEP1_PRIMARY_STORAGE_KEY = "isf-rebuild-v1";

function getStorageHub() {
  return window.IsfStorageHub || window.IsfHubStorage || null;
}

function readLocalStep1Inputs() {
  try {
    const hubLocal = getStorageHub()?.loadLocal?.(STEP1_PRIMARY_STORAGE_KEY);
    if (hubLocal) return hubLocal;
  } catch (_error) {}

  try {
    const raw = localStorage.getItem(STEP1_PRIMARY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_error) {
    return null;
  }
}

async function sanitizeMainInputs(data) {
  if (!data || typeof data !== "object") return null;
  try {
    const { sanitizeInputs } = await import("../../main/modules/input-sanitizer.js");
    return sanitizeInputs(data);
  } catch (_error) {
    return data;
  }
}

export async function resolveLatestMainInputs() {
  const hub = getStorageHub();
  const localInputs = readLocalStep1Inputs();

  const localSanitized = await sanitizeMainInputs(localInputs);
  if (localSanitized) {
    return {
      data: localSanitized,
      source: {
        type: "main",
        storageKey: STEP1_PRIMARY_STORAGE_KEY,
        snapshotId: "local-current",
        importedAt: new Date().toISOString(),
      },
    };
  }

  try {
    const latest = hub?.getLatestStep1Snapshot ? await hub.getLatestStep1Snapshot() : null;
    const data = latest?.data || latest;
    const sanitized = await sanitizeMainInputs(data);
    if (!sanitized) return null;

    return {
      data: sanitized,
      source: {
        type: "main",
        storageKey: STEP1_PRIMARY_STORAGE_KEY,
        snapshotId: latest?.id || "local-current",
        importedAt: new Date().toISOString(),
      },
    };
  } catch (_error) {
    const sanitized = await sanitizeMainInputs(localInputs);
    if (!sanitized) return null;
    return {
      data: sanitized,
      source: {
        type: "main",
        storageKey: STEP1_PRIMARY_STORAGE_KEY,
        snapshotId: "local-current",
        importedAt: new Date().toISOString(),
      },
    };
  }
}

export { STEP1_PRIMARY_STORAGE_KEY };
