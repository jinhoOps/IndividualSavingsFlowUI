/**
 * Step 2 Storage & Backup Handlers
 */
import { state, markClean, getHubStorage, createEmptyDraft } from "./state.js";
import { dom } from "./dom.js";
import { SHARE_STATE_KEY, SHARE_STATE_SCHEMA } from "./constants.js";
import { renderDraft } from "./renderers.js";

import { utils } from "./utils.js";

/**
 * Saves the current portfolio to HubStorage
 */
export async function saveCurrentPortfolio() {
  const hub = getHubStorage();
  if (!hub) return;
  if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
  const data = toPortablePortfolio();
  try {
    await hub.saveStep2Portfolio(data);
    markClean();
    await refreshPortfolioList();
    if (dom.dataHubModal) dom.dataHubModal.updatePortfolioList(state.portfolios);
    
    // Auto-backup
    const res = await IsfBackupManager.maybeCreateAutoBackupIfDue(state.backupEntries, data, SHARE_STATE_KEY);
    if (res.created) {
      state.backupEntries = res.nextEntries;
      syncBackupUi();
    }

    if (dom.appHeader) dom.appHeader.updateStatus("success", "브라우저에 저장됨");
  } catch (err) {
    if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
    console.error(err);
  }
}

/**
 * Loads a portfolio from HubStorage by ID
 */
export async function loadPortfolioById(id, options = {}) {
  const hub = getHubStorage();
  if (!hub) return;
  const p = await hub.getStep2PortfolioById(id);
  if (p) {
    state.draft = normalizeLoadedPortfolio(p).draft;
    state.currentPortfolioId = id;
    renderDraft();
    markClean();
    if (!options.skipConfirm && dom.appHeader) dom.appHeader.updateStatus("success", "포트폴리오 로드됨");
  }
}

/**
 * Deletes a portfolio from HubStorage
 */
export async function deletePortfolioById(id) {
  const hub = getHubStorage();
  if (!hub) return;
  await hub.deleteStep2Portfolio(id);
  if (state.currentPortfolioId === id) resetDraft();
  await refreshPortfolioList();
  if (dom.appHeader) dom.appHeader.updateStatus("success", "삭제되었습니다.");
}

/**
 * Refreshes the local portfolio list from HubStorage
 */
export async function refreshPortfolioList() {
  const hub = getHubStorage();
  const rows = await (hub?.listStep2Portfolios() || []);
  state.portfolios = rows || [];
}

/**
 * Manual backup handler
 */
export async function handleManualBackup() {
  if (!state.backupStoreReady) return;
  const MANUAL_BACKUP_WINDOW_MS = 60 * 1000;
  const res = await IsfBackupManager.createBackupEntry(state.backupEntries, state.draft, {
    type: "manual", source: "normal", allowDuplicate: true,
    replaceRecentManualWithinMs: MANUAL_BACKUP_WINDOW_MS, appKey: SHARE_STATE_KEY,
    onRecentManualOverwriteConfirm: () => window.confirm("최근 1분 이내 수동 백업이 있습니다. 덮어쓸까요?")
  });
  if (res.created) {
    state.backupEntries = res.nextEntries;
    syncBackupUi();
    if (dom.appHeader) dom.appHeader.updateStatus("success", "백업 저장됨");
  }
}

/**
 * Restores a backup by ID
 */
export async function restoreBackupById(id) {
  const entry = state.backupEntries.find(e => e.id === id);
  if (!entry || !window.confirm(`백업(${utils.formatTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
  await handleManualBackup();
  const norm = normalizeLoadedPortfolio(entry.data);
  state.draft = norm.draft;
  state.currentPortfolioId = norm.id || "";
  renderDraft();
  markClean();
}

/**
 * Normalizes loaded portfolio data (migration, etc.)
 */
export function normalizeLoadedPortfolio(s) {
  if (!s) return { draft: createEmptyDraft(), id: "" };

  const base = createEmptyDraft();
  // Ensure basic structure and field merging
  const draft = {
    ...base,
    ...s,
    dividendSim: { ...base.dividendSim, ...(s.dividendSim || {}) },
    accounts: (s.accounts || []).map(acc => ({
      ...acc,
      allocations: (acc.allocations || [])
    }))
  };

  // Migration to Won units (modelVersion < 10)
  if (!s.modelVersion || s.modelVersion < 10) {
    draft.modelVersion = 10;
    if (typeof draft.totalMonthlyInvestCapacity === "number") {
      draft.totalMonthlyInvestCapacity = utils.toWon(draft.totalMonthlyInvestCapacity);
    }
    draft.accounts.forEach(acc => {
      acc.allocations.forEach(al => {
        if (typeof al.actualAmount === "number") {
          al.actualAmount = utils.toWon(al.actualAmount);
        }
      });
    });
  }

  return { draft, id: s.id || "" };
}
export function syncBackupUi() { 
  if (dom.dataHubModal) dom.dataHubModal.updateBackupList(state.backupEntries); 
}

export function toPortablePortfolio() { 
  return { ...state.draft, id: state.currentPortfolioId }; 
}

export function resetDraft() { 
  state.draft = createEmptyDraft(); 
  state.currentPortfolioId = ""; 
  renderDraft(); 
  markClean(); 
}
