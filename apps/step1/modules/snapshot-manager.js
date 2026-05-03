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

