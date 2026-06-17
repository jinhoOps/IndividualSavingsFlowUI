
import { state, markClean, createEmptyDraft } from "./state.js";
import { dom } from "./dom.js";
import { SHARE_STATE_KEY, MANUAL_BACKUP_WINDOW_MS } from "./constants.js";
import { renderDraft } from "./renderers.js";
import { utils } from "./utils.js";
import { reimportOriginalStep1Source } from "./step1-connector.js";

/**
 * Step 2 Feature Controller
 * Manages simulation data, backup/restore, and synchronization.
 */
export const featureController = {
  async saveCurrent() {
    if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
    const data = this.toPortableFormat();
    if (!data) {
      if (dom.appHeader) dom.appHeader.updateStatus("error", "데이터가 없습니다.");
      return;
    }
    try {
      const entry = await window.IsfStorageHub.saveStep2Entry(data); 
      state.currentSimulationId = entry.id;
      markClean();
      
      await this.refreshList();
      if (dom.dataHubModal) dom.dataHubModal.updateSimulationList(state.simulations);
      
      // Auto-backup
      const res = await window.IsfStorageHub.triggerAutoBackup(SHARE_STATE_KEY, data, state.backupEntries);
      if (res.created) {
        state.backupEntries = res.nextEntries;
        this.syncBackupUi();
      }

      if (dom.appHeader) dom.appHeader.updateStatus("success", "시뮬레이션 저장됨");
    } catch (err) {
      console.error("saveCurrent failed:", err);
      if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
    }
  },

  async loadById(id, options = {}) {
    const s = await window.IsfStorageHub.getStep2EntryById(id);
    if (s) {
      const norm = this.normalize(s);
      state.draft = norm.draft;
      state.currentSimulationId = id;
      renderDraft();
      markClean();
      if (!options.skipConfirm && dom.appHeader) dom.appHeader.updateStatus("success", "시뮬레이션 로드됨");
    }
  },

  async deleteById(id) {
    await window.IsfStorageHub.deleteStep2Entry(id);
    if (state.currentSimulationId === id) await this.reset();
    await this.refreshList();
    if (dom.dataHubModal) dom.dataHubModal.updateSimulationList(state.simulations);
    if (dom.appHeader) dom.appHeader.updateStatus("success", "삭제되었습니다.");
  },

  async refreshList() {
    const rows = await window.IsfStorageHub.listStep2Entries();
    state.simulations = rows || [];
  },

  async handleManualBackup() {
    if (!state.backupStoreReady) return;
    const res = await window.IsfStorageHub.createManualBackup(SHARE_STATE_KEY, state.draft, state.backupEntries, {
      type: "manual", source: "normal", allowDuplicate: true,
      replaceRecentManualWithinMs: MANUAL_BACKUP_WINDOW_MS,
      onRecentManualOverwriteConfirm: () => window.confirm("최근 1분 이내 수동 백업이 있습니다. 덮어쓸까요?")
    });
    if (res.created) {
      state.backupEntries = res.nextEntries;
      this.syncBackupUi();
      if (dom.appHeader) dom.appHeader.updateStatus("success", "백업 저장됨");
    }
  },

  async restoreBackupById(id) {
    const entry = state.backupEntries.find(e => e.id === id);
    if (!entry || !window.confirm(`백업(${utils.formatTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
    await this.handleManualBackup();
    const norm = this.normalize(entry.data);
    state.draft = norm.draft;
    state.currentSimulationId = norm.id || "";
    renderDraft();
    markClean();
  },

  normalize(s) {
    if (!s) return { draft: createEmptyDraft(), id: "" };
    const base = createEmptyDraft();
    const draft = {
      ...base,
      ...s,
      dividendSim: { ...base.dividendSim, ...(s.dividendSim || {}) }
    };

    if (!s.modelVersion || s.modelVersion < 10) {
      draft.modelVersion = 10;
      if (typeof draft.totalMonthlyInvestCapacity === "number") {
        draft.totalMonthlyInvestCapacity = utils.toWon(draft.totalMonthlyInvestCapacity);
      }
    }
    return { draft, id: s.id || "" };
  },

  syncBackupUi() { 
    if (dom.dataHubModal) dom.dataHubModal.updateBackupList(state.backupEntries); 
  },

  toPortableFormat() { 
    if (!state.draft) return null;
    const { modelVersion, totalMonthlyInvestCapacity, dividendSim, updatedAt } = state.draft;
    return { 
      modelVersion, totalMonthlyInvestCapacity, dividendSim, 
      updatedAt: updatedAt || Date.now(),
      id: state.currentSimulationId || utils.createId("ds")
    }; 
  },

  async reset() { 
    state.draft = createEmptyDraft(); 
    state.currentSimulationId = ""; 
    await reimportOriginalStep1Source();
    renderDraft(); 
    markClean(); 
  }
};
