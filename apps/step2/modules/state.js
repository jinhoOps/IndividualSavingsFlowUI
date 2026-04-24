/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.1
 * 
 * 파일 역할: 애플리케이션 상태 관리 (State)
 */
import { TEMP_STORAGE_KEY } from "./constants.js";

export const state = {
  draft: null,
  simulations: [], // 기존 portfolios에서 변경
  currentSimulationId: "", // 기존 currentPortfolioId에서 변경
  backupEntries: [],
  isDashboardMode: false,
  isReturningUser: false,
  dirty: false,
  backupStoreReady: false,
};

/**
 * 새로운 빈 시뮬레이션 드래프트를 생성합니다.
 */
export function createEmptyDraft() {
  return {
    modelVersion: 10,
    totalMonthlyInvestCapacity: 0,
    dividendSim: {
      yield: 3.5,
      growth: 5.0,
      capitalGrowth: 4.0,
      years: 10,
      isDrip: true
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
  } catch (e) { /* ignore */ }
}

export function getHubStorage() {
  return window.IsfStorageHub || window.IsfHubStorage || null;
}
