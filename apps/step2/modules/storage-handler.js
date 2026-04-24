/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.2
 * 
 * 파일 역할: 시뮬레이션 데이터 저장 및 백업 핸들러 (Storage & Backup)
 */
import { state, markClean, createEmptyDraft } from "./state.js";
import { dom } from "./dom.js";
import { SHARE_STATE_KEY, MANUAL_BACKUP_WINDOW_MS } from "./constants.js";
import { renderDraft } from "./renderers.js";
import { utils } from "./utils.js";

/**
 * 현재 시뮬레이션 상태를 통합 저장소(HubStorage)에 저장합니다.
 */
export async function saveCurrentSimulation() {
  if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
  const data = toPortableSimulation();
  if (!data) {
    if (dom.appHeader) dom.appHeader.updateStatus("error", "데이터가 없습니다.");
    return;
  }
  try {
    const entry = await IsfStorageHub.saveStep2Entry(data); 
    state.currentSimulationId = entry.id;
    markClean();
    
    await refreshSimulationList();
    if (dom.dataHubModal) dom.dataHubModal.updateSimulationList(state.simulations);
    
    // 자동 백업 트리거
    const res = await IsfStorageHub.triggerAutoBackup(SHARE_STATE_KEY, data, state.backupEntries);
    if (res.created) {
      state.backupEntries = res.nextEntries;
      syncBackupUi();
    }

    if (dom.appHeader) dom.appHeader.updateStatus("success", "시뮬레이션 저장됨");
  } catch (err) {
    console.error("saveCurrentSimulation failed:", err);
    if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
  }
}

/**
 * ID를 기반으로 통합 저장소에서 시뮬레이션을 로드합니다.
 */
export async function loadSimulationById(id, options = {}) {
  const s = await IsfStorageHub.getStep2EntryById(id);
  if (s) {
    const norm = normalizeLoadedSimulation(s);
    state.draft = norm.draft;
    state.currentSimulationId = id;
    renderDraft();
    markClean();
    if (!options.skipConfirm && dom.appHeader) dom.appHeader.updateStatus("success", "시뮬레이션 로드됨");
  }
}

/**
 * ID를 기반으로 시뮬레이션을 삭제합니다.
 */
export async function deleteSimulationById(id) {
  await IsfStorageHub.deleteStep2Entry(id);
  if (state.currentSimulationId === id) resetDraft();
  await refreshSimulationList();
  if (dom.dataHubModal) dom.dataHubModal.updateSimulationList(state.simulations);
  if (dom.appHeader) dom.appHeader.updateStatus("success", "삭제되었습니다.");
}

/**
 * 통합 저장소에서 시뮬레이션 목록을 최신화합니다.
 */
export async function refreshSimulationList() {
  const rows = await IsfStorageHub.listStep2Entries();
  state.simulations = rows || [];
}

/**
 * 수동 백업 핸들러
 */
export async function handleManualBackup() {
  if (!state.backupStoreReady) return;
  const res = await IsfStorageHub.createManualBackup(SHARE_STATE_KEY, state.draft, state.backupEntries, {
    type: "manual", source: "normal", allowDuplicate: true,
    replaceRecentManualWithinMs: MANUAL_BACKUP_WINDOW_MS,
    onRecentManualOverwriteConfirm: () => window.confirm("최근 1분 이내 수동 백업이 있습니다. 덮어쓸까요?")
  });
  if (res.created) {
    state.backupEntries = res.nextEntries;
    syncBackupUi();
    if (dom.appHeader) dom.appHeader.updateStatus("success", "백업 저장됨");
  }
}

/**
 * 백업 ID를 기반으로 상태를 복구합니다.
 */
export async function restoreBackupById(id) {
  const entry = state.backupEntries.find(e => e.id === id);
  if (!entry || !window.confirm(`백업(${utils.formatTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
  await handleManualBackup();
  const norm = normalizeLoadedSimulation(entry.data);
  state.draft = norm.draft;
  state.currentSimulationId = norm.id || "";
  renderDraft();
  markClean();
}

/**
 * 로드된 데이터를 시뮬레이션 형식에 맞게 정규화합니다.
 */
export function normalizeLoadedSimulation(s) {
  if (!s) return { draft: createEmptyDraft(), id: "" };
  const base = createEmptyDraft();
  const draft = {
    ...base,
    ...s,
    dividendSim: { ...base.dividendSim, ...(s.dividendSim || {}) }
  };
  
  // 구버전(pf) 데이터의 원 단위 마이그레이션 호환성 유지
  if (!s.modelVersion || s.modelVersion < 10) {
    draft.modelVersion = 10;
    if (typeof draft.totalMonthlyInvestCapacity === "number") {
      draft.totalMonthlyInvestCapacity = utils.toWon(draft.totalMonthlyInvestCapacity);
    }
  }
  return { draft, id: s.id || "" };
}

export function syncBackupUi() { 
  if (dom.dataHubModal) dom.dataHubModal.updateBackupList(state.backupEntries); 
}

/**
 * 현재 상태를 내보내기용 객체로 변환합니다.
 */
export function toPortableSimulation() { 
  if (!state.draft) return null;
  const { modelVersion, totalMonthlyInvestCapacity, dividendSim, updatedAt } = state.draft;
  return { 
    modelVersion, totalMonthlyInvestCapacity, dividendSim, 
    updatedAt: updatedAt || Date.now(),
    id: state.currentSimulationId || utils.createId("ds") // ds: Dividend Simulation
  }; 
}

export function resetDraft() { 
  state.draft = createEmptyDraft(); 
  state.currentSimulationId = ""; 
  renderDraft(); 
  markClean(); 
}

