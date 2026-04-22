/**
 * Step 2 State Management
 */
import { MODEL_VERSION, TEMP_STORAGE_KEY } from "./constants.js";
import { dom } from "./dom.js";

// Local reference for shared utilities (v0.5.12 Standard)
const utils = window.IsfUtils || {
  sanitizeWeight: n => parseFloat(n) || 0,
  sanitizeMoney: v => parseInt(v) || 0,
  formatMoney: v => v,
  formatTimestamp: t => t,
  toWon: v => v * 10000,
  toMan: v => Math.floor(v / 10000),
  escapeHtml: s => String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[m])),
  createId: p => (p || "id") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2)
};

export const state = { 
  portfolios: [], 
  currentPortfolioId: "", 
  draft: null, 
  activeAccountId: "", 
  activeChartTab: "summary", 
  dirty: false,
  isDashboardMode: false,
  isReturningUser: false,
  backupEntries: [],
  backupStoreReady: false
};

export const colorCache = new Map();

/**
 * Creates a new empty portfolio draft
 */
export function createEmptyDraft() {
  return {
    modelVersion: MODEL_VERSION,
    name: "신규 포트폴리오",
    notes: "",
    totalMonthlyInvestCapacity: 0,
    accounts: [],
    dividendSim: {
      years: 10,
      yield: 3.5,
      growth: 5.0,
      capitalGrowth: 4.0,
      isDrip: true
    },
    updatedAt: Date.now()
  };
}

/**
 * Creates a new account object
 */
export function createDraftAccount(data = {}) {
  return {
    id: utils.createId("acc"),
    name: data.name || "신규 계좌",
    accountWeight: 0,
    allocations: [],
    ...data
  };
}

/**
 * Creates a new allocation object
 */
export function createDraftAllocation(data = {}) {
  return {
    id: utils.createId("al"),
    label: data.label || "신규 종목",
    targetWeight: 0,
    actualAmount: 0,
    isImportant: false,
    ...data
  };
}

/**
 * Marks the current state as dirty (pending changes)
 */
export function markDirty() {
  state.dirty = true;
  if (dom.pendingBar) IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, true);
  
  // Crash recovery용 임시 저장
  if (state.draft) {
    sessionStorage.setItem(TEMP_STORAGE_KEY, JSON.stringify({
      draft: state.draft,
      currentPortfolioId: state.currentPortfolioId,
      activeAccountId: state.activeAccountId
    }));
  }
}

/**
 * Marks the current state as clean (no pending changes)
 */
export function markClean() {
  state.dirty = false;
  if (dom.pendingBar) IsfFeedback.markPendingBar(dom.pendingBar, dom.pendingSummary, false);
  sessionStorage.removeItem(TEMP_STORAGE_KEY);
}

/**
 * Gets the current IndexedDB based hub storage
 */
export function getHubStorage() {
  return window.IsfHubStorage || null;
}
