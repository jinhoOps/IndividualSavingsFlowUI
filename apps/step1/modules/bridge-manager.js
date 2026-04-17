import { sanitizeInputs, cloneInputs } from "./input-sanitizer.js";

export function buildStep1BridgePayload(inputs) {
  const safeInputs = sanitizeInputs(cloneInputs(inputs));
  const investItems = Array.isArray(safeInputs.investItems) ? safeInputs.investItems : [];
  
  return {
    monthlyInvestCapacity: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.monthlyInvest, 0)),
    currentCash: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.startCash, 0)),
    currentInvest: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.startInvest, 0)),
    currentSavings: IsfUtils.toWon(IsfUtils.sanitizeMoney(safeInputs.startSavings, 0)),
    investItems: investItems.map(item => ({
      id: item.id,
      name: item.name,
      amount: IsfUtils.sanitizeMoney(item.amount, 0)
    })),
    annualExpenseGrowth: Number(safeInputs.annualExpenseGrowth || 0),
    timestamp: new Date().toISOString(),
  };
}

export async function persistStep1BridgeSnapshot(inputs, { getHubStorage, isViewMode }) {
  const hub = getHubStorage();
  if (!hub || isViewMode) {
    return;
  }
  try {
    const safeInputs = sanitizeInputs(cloneInputs(inputs));
    const snapshot = await hub.saveStep1Snapshot(safeInputs);
    if (!snapshot || !snapshot.id) {
      return;
    }
    const payload = buildStep1BridgePayload(safeInputs);
    await hub.saveBridgeStep1ToStep2(snapshot.id, payload);
  } catch (_error) {
    // Ignore bridge snapshot failures to keep Step1 flow functional.
  }
}
