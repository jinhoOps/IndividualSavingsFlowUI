import { sanitizeInputs, cloneInputs } from "./input-sanitizer.js";


export async function persistStep1Snapshot(inputs, { getHubStorage, isViewMode }) {
  const hub = getHubStorage();
  if (!hub || isViewMode) {
    return;
  }
  try {
    const safeInputs = sanitizeInputs(cloneInputs(inputs));
    await hub.saveStep1Snapshot(safeInputs);
  } catch (_error) {

  }
}

export async function listSnapshots({ getHubStorage }) {
  const hub = getHubStorage();
  if (!hub) return [];
  return await hub.listStep1Snapshots();
}

export async function getSnapshotById(id, { getHubStorage }) {
  const hub = getHubStorage();
  if (!hub || !id) return null;
  return await hub.getStep1SnapshotById(id);
}

export async function deleteSnapshot(id, { getHubStorage }) {
  const hub = getHubStorage();
  if (!hub || !id) return false;
  return await hub.deleteStep1Snapshot(id);
}
