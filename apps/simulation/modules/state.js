
import { TEMP_STORAGE_KEY } from "./constants.js";

export const state = {
  draft: null,
  simulations: [],
  currentSimulationId: "",
  backupEntries: [],
  isDashboardMode: false,
  isReturningUser: false,
  dirty: false,
  backupStoreReady: false,
  isSyncedWithStep1: false,
  displayOptions: {
    showAsset: true,
    showDividend: true,
    showPR: true,
    showTR: true
  }
};


export function createEmptyDraft() {
  return {
    modelVersion: 10,
    totalInitialAsset: 0,
    totalMonthlyInvestCapacity: 0,
    dividendSim: {
      yield: 3.5,
      growth: 5.0,
      capitalGrowth: 4.0,
      years: 10,
      isDrip: true,
      presetName: ""
    },
    updatedAt: Date.now()
  };
}

export function markDirty() {
  state.dirty = true;
  saveSession();
}

export function markClean() {
  state.dirty = false;
  saveSession();
}

function saveSession() {
  try {
    sessionStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify({
      draft: state.draft,
      currentSimulationId: state.currentSimulationId
    }));
  } catch (e) {  }
}

export function getHubStorage() {
  return window.IsfStorageHub || window.IsfHubStorage || null;
}


