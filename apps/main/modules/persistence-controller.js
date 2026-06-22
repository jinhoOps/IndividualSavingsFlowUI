import {
  STORAGE_KEY,
  SHARE_STATE_KEY,
  SHARE_STATE_SCHEMA,
  HASH_STATE_PARAM,
  MANUAL_BACKUP_WINDOW_MS,
} from "./constants.js";
import { sanitizeInputs } from "./input-sanitizer.js";
import { normalizeExternalStep1Inputs } from "./external-input-guard.js";
import { formatBackupTimestamp } from "./formatters.js";
import { loadShareSnapshotById } from "./storage-manager.js";
import { applyPresetBySalary, calculateMonthlyIncomeFromAnnualSalary } from "./presets.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
import {
  refreshInputsPanel,
  syncBackupUi,
  syncViewModeUi,
  syncViewModeGuideUi,
} from "./ui-controller.js";
import { getMonthlyAllocationTotalWon } from "./input-sanitizer.js";

export function createPersistenceController({ renderAll }) {
  function switchToNormalMode() {
    window.location.href = window.location.pathname;
  }

  function setPendingBarVisible(visible) {
    if (dom.pendingBar) dom.pendingBar.hidden = !visible;
    if (dom.pendingSummary) {
      dom.pendingSummary.textContent = visible ? listRenderer.getPendingSummaryText(state.draftInputs) : "";
    }
  }

  function persistPrimaryState(inputs, options = {}) {
    if (state.isViewMode) return;
    if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
    try {
      window.IsfStorageHub.saveLocal(STORAGE_KEY, inputs);
      if (!options.skipAutoBackup) {
        void (async () => {
          const result = await window.IsfStorageHub.triggerAutoBackup(SHARE_STATE_KEY, inputs, state.backupEntries);
          if (result.created) {
            state.backupEntries = result.nextEntries;
            syncBackupUi();
          }
        })();
      }
      if (dom.appHeader) dom.appHeader.updateStatus("success", "자동 저장됨");
    } catch (_error) {
      if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
    }
  }

  function commitImmediateInputs(inputs, options = {}) {
    state.inputs = sanitizeInputs(inputs);
    state.draftInputs = null;
    setPendingBarVisible(false);
    refreshInputsPanel(state.inputs);
    persistPrimaryState(state.inputs, options);
    renderAll();
  }

  async function handleManualBackup() {
    if (state.isViewMode || !state.backupStoreReady) return;
    const result = await window.IsfStorageHub.createManualBackup(SHARE_STATE_KEY, state.inputs, state.backupEntries, {
      type: "manual",
      source: "normal",
      allowDuplicate: true,
      replaceRecentManualWithinMs: MANUAL_BACKUP_WINDOW_MS,
      onRecentManualOverwriteConfirm: () => window.confirm("최근 1분 이내 수동 백업이 있습니다. 덮어쓸까요?"),
    });
    if (result.created) {
      state.backupEntries = result.nextEntries;
      syncBackupUi();
      if (dom.appHeader) dom.appHeader.updateStatus("success", "백업 저장됨");
    }
  }

  async function restoreBackupById(id) {
    const entry = state.backupEntries.find((candidate) => candidate.id === id);
    if (!entry || !window.confirm(`백업(${formatBackupTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
    await handleManualBackup();
    commitImmediateInputs(normalizeExternalStep1Inputs("backup-restore", entry.data), { skipAutoBackup: true });
  }

  function handleExportJson() {
    window.IsfShare.exportAsJson(
      window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, state.inputs),
      "my-household-flow",
    );
  }

  async function handleImportJson(file) {
    try {
      const imported = window.IsfShare.parseImportedJson(await file.text(), SHARE_STATE_KEY);
      commitImmediateInputs(normalizeExternalStep1Inputs("json-import", imported));
    } catch (_error) {
      if (dom.appHeader) dom.appHeader.updateStatus("error", "JSON 오류");
    }
  }

  async function handleSaveViewToLocal() {
    const localInputs = normalizeExternalStep1Inputs("view-mode-save", state.inputs);
    const result = await window.IsfStorageHub.persistViewDataLocally(STORAGE_KEY, localInputs, state.backupEntries);
    if (result.success) {
      state.backupEntries = result.backupEntries;
      syncBackupUi();
      switchToNormalMode();
    }
  }

  function createResetInputs() {
    const isDualIncome = state.inputs?.householdContext?.incomeMode === "dual-income";
    const primaryAnnualSalary = isDualIncome ? 40000000 : 46000000;
    const spouseAnnualSalary = 46000000;
    const preset = applyPresetBySalary(primaryAnnualSalary, "balanced");
    return normalizeExternalStep1Inputs(isDualIncome ? "reset-newlywed-dual-preset" : "reset-newlywed-single-preset", {
      ...preset,
      householdContext: {
        profile: "newlywed",
        incomeMode: isDualIncome ? "dual-income" : "single-income",
        spouseMonthlyIncome: isDualIncome ? calculateMonthlyIncomeFromAnnualSalary(spouseAnnualSalary) : 0,
      },
    });
  }

  function handleResetInputs() {
    const isDualIncome = state.inputs?.householdContext?.incomeMode === "dual-income";
    const resetLabel = isDualIncome ? "맞벌이 연봉 4,000만 원 / 4,600만 원" : "1인 소득 연봉 4,600만 원";
    if (state.isViewMode || !window.confirm(`${resetLabel} 기준으로 초기화할까요?`)) return;
    commitImmediateInputs(createResetInputs());
    window.IsfFeedback.showFeedback(dom.applyFeedback, `${resetLabel} 기준으로 초기화되었습니다.`);
  }

  function handleHashChange() {
    syncViewModeUi();
    syncViewModeGuideUi();
    if (state.isApplyingHashState) return;
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get(HASH_STATE_PARAM);
    const hashInputs = window.IsfShare.decodePayloadFromHash(hash, SHARE_STATE_KEY);
    if (!hashInputs) return;
    const next = normalizeExternalStep1Inputs("hash-restore", hashInputs);
    if (JSON.stringify(next) === JSON.stringify(state.inputs)) return;
    state.isApplyingHashState = true;
    try {
      commitImmediateInputs(next);
    } finally {
      state.isApplyingHashState = false;
    }
  }

  function markPendingChanges() {
    if (state.isViewMode) return;
    helpers.syncDerivedValues(state.inputs, { getMonthlyAllocationTotalWon });
    listRenderer.renderInputHints(state.inputs);
    persistPrimaryState(state.inputs);
    renderAll();
  }

  function hasPendingChanges() {
    return !!state.draftInputs && JSON.stringify(state.draftInputs) !== JSON.stringify(state.inputs);
  }

  async function handleGenerateIsfCode() {
    const code = window.IsfShare.encodePayloadForHash(
      window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, state.inputs),
    );
    if (code) {
      dom.dataHubModal.showGeneratedCode(code);
      window.IsfFeedback.showFeedback(dom.applyFeedback, "ISF CODE가 발급 및 복사되었습니다.");
    }
  }

  async function handleApplyIsfCode(event) {
    const decoded = window.IsfShare.decodePayloadFromHash(event.detail.code, SHARE_STATE_KEY);
    if (decoded) {
      const next = normalizeExternalStep1Inputs("isf-code-apply", decoded);
      commitImmediateInputs(next);
      dom.dataHubModal.close();
      window.IsfFeedback.showFeedback(dom.applyFeedback, "코드가 성공적으로 적용되었습니다.");
    } else {
      window.IsfFeedback.showFeedback(dom.applyFeedback, "유효하지 않은 코드입니다.", true);
    }
  }

  async function handleMergeIsfCode(event) {
    const decoded = window.IsfShare.decodePayloadFromHash(event.detail.code, SHARE_STATE_KEY);
    if (!decoded) {
      window.IsfFeedback.showFeedback(dom.applyFeedback, "유효하지 않은 코드입니다.", true);
      return;
    }

    const partnerData = normalizeExternalStep1Inputs("isf-code-merge", decoded);
    if (!window.confirm("부부 데이터 병합: 파트너의 데이터를 현재 내 데이터와 합칠까요? (기존 항목들에 추가됩니다)")) {
      return;
    }

    const mine = state.inputs;
    const addMe = (items) => items.map((item) => ({ ...item, name: `[나] ${item.name.replace(/^\[(나|너)\]\s*/, "")}` }));
    const addYou = (items) => items.map((item) => ({ ...item, name: `[너] ${item.name.replace(/^\[(나|너)\]\s*/, "")}` }));
    const merged = {
      ...mine,
      incomes: [...addMe(mine.incomes), ...addYou(partnerData.incomes || [])],
      expenseItems: [...addMe(mine.expenseItems), ...addYou(partnerData.expenseItems || [])],
      savingsItems: [...addMe(mine.savingsItems), ...addYou(partnerData.savingsItems || [])],
      investItems: [...addMe(mine.investItems), ...addYou(partnerData.investItems || [])],
      startCash: (mine.startCash || 0) + (partnerData.startCash || 0),
      startSavings: (mine.startSavings || 0) + (partnerData.startSavings || 0),
      startInvest: (mine.startInvest || 0) + (partnerData.startInvest || 0),
      startDebt: (mine.startDebt || 0) + (partnerData.startDebt || 0),
      monthlyDebtPayment: (mine.monthlyDebtPayment || 0) + (partnerData.monthlyDebtPayment || 0),
    };

    commitImmediateInputs(normalizeExternalStep1Inputs("isf-code-merge-result", merged, state.inputs));
    dom.dataHubModal.close();
    window.IsfFeedback.showFeedback(dom.applyFeedback, "부부 통합 데이터로 병합되었습니다! 🥂");
  }

  function initializeBackupStore() {
    if (!window.IsfBackupManager.isIndexedDbAvailable()) return;
    window.IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY)
      .then((entries) => {
        state.backupStoreReady = true;
        if (entries) {
          state.backupEntries = entries;
          syncBackupUi();
        }
      })
      .catch(() => {
        state.backupStoreReady = true;
        state.backupStoreError = true;
      });
  }

  async function initializeInputsFromShareId() {
    const shareId = window.IsfShare.getShareIdFromUrl();
    if (!shareId) return;
    const shareInputs = await loadShareSnapshotById(shareId, (id) => id);
    if (shareInputs) {
      commitImmediateInputs(normalizeExternalStep1Inputs("share-id-load", shareInputs));
    }
  }

  return {
    commitImmediateInputs,
    persistPrimaryState,
    handleManualBackup,
    restoreBackupById,
    handleExportJson,
    handleImportJson,
    handleSaveViewToLocal,
    handleResetInputs,
    handleHashChange,
    initializeBackupStore,
    initializeInputsFromShareId,
    handleGenerateIsfCode,
    handleApplyIsfCode,
    handleMergeIsfCode,
    setPendingBarVisible,
    markPendingChanges,
    hasPendingChanges,
  };
}
