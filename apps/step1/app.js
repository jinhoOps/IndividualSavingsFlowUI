import { IsfUtils } from "../../shared/core/utils.js";

import {
  STORAGE_KEY, SHARE_STATE_KEY, SHARE_STATE_SCHEMA,
  HASH_STATE_PARAM, VIEW_MODE_GUIDE_DISMISSED_KEY, MANUAL_BACKUP_WINDOW_MS,
  MAX_INCOME_ITEMS, MAX_ALLOCATION_ITEMS, SANKEY_VALUE_MODES,
  SANKEY_SORT_MODES, ITEM_SORT_MODES, SANKEY_ZOOM_MIN, SANKEY_ZOOM_MAX, SANKEY_ZOOM_STEP,
  MOBILE_LAYOUT_QUERY, DEFAULT_INPUTS, DEFAULT_EXPENSE_ITEMS,
  DEFAULT_SAVINGS_ITEMS, DEFAULT_INVEST_ITEMS, SAMPLE_INPUTS,
  FORM_FIELD_KEYS, TONE_COLORS
} from "./modules/constants.js";

import {
  cloneInputs, sanitizeInputs, createIncomeItem,
  getMonthlyIncomeTotalWon, getMonthlyAllocationTotalWon,
  normalizeAllocationGroupName, parseSavingsAnnualRateInput,
  createAllocationItemId, normalizeMaturityMonth
} from "./modules/input-sanitizer.js";

import {
  formatCurrency, formatBackupTimestamp
} from "./modules/formatters.js";

import {
  loadShareSnapshotById
} from "./modules/storage-manager.js";

import {
  persistStep1Snapshot, listSnapshots, getSnapshotById, deleteSnapshot
} from "./modules/snapshot-manager.js";

import {
  renderComparisonChart, renderComparisonSummary
} from "./modules/comparison-renderer.js";

import {
  buildMonthlySnapshot, simulateProjection, buildSummaryCards,
  calculateAccountFinancialIncomes
} from "./modules/calculator.js";

import { dom } from "./modules/dom.js";
import { state } from "./modules/state.js";
import { PRESET_SALARIES, applyPreset, applyPresetBySalary, calculateAnnualSalaryFromMonthlyIncome } from "./modules/presets.js";

import {
  renderSankey, exportSankeyToPng
} from "./modules/sankey-renderer.js";

import { buildSankeyData } from "./modules/sankey-builder.js";
import * as helpers from "./modules/state-helpers.js";
import { initOnboarding } from "./modules/onboarding-manager.js";
import {
  syncViewModeUi, syncViewModeGuideUi, syncBackupUi,
  syncSankeyValueModeUi, syncSankeySortModeUi, syncSankeyZoomUi,
  syncItemSortModeUi, syncMobileInputsPanelVisibility,
  syncMobileItemEditorFab, syncAdvancedTabBlockVisibility,
  setActiveAdvancedTab, refreshInputsPanel, syncDerivedMonthlyInputsToUi,
  syncGroupOptionsAll, syncGroupOptionsFor
} from "./modules/ui-controller.js";

import {
  handleOpenSmartAdd, handleCloseSmartAdd, handleSmartAddInput, handleApplySmartAdd,
  initializeSnapshotSelector, handleSnapshotSelection, handleSaveSnapshot, handleDeleteSnapshot
} from "./modules/feature-controllers.js";
import * as listRenderer from "./modules/list-renderer.js";



function init() {
  checkReturningUser();
  bindControls();
  syncViewModeUi();
  syncViewModeGuideUi();
  syncBackupUi();
  syncSankeyValueModeUi();
  syncSankeySortModeUi();
  syncSankeyZoomUi();
  syncItemSortModeUi();
  syncMobileInputsPanelVisibility();
  setActiveAdvancedTab(state.activeAdvancedTab);
  syncAdvancedTabBlockVisibility();
  initMgmtTabs();
  refreshInputsPanel(state.inputs);
  syncGroupOptionsAll();
  setPendingBarVisible(false);
  renderAll();
  initializeBackupStore();
  void initializeInputsFromShareId();
  void initializeSnapshotSelector();

  const pwaManager = new window.IsfPwaManager({
    appVersion: IsfUtils.APP_VERSION,
    appKey: SHARE_STATE_KEY,
    onFeedback: (message) => window.IsfFeedback.showFeedback(dom.applyFeedback, message),
    isViewMode: () => state.isViewMode,
    swPath: "../../sw.js",
    manifestPath: "../../manifest.webmanifest",
    versionCheckTriggerElement: dom.checkLatestVersion,
    getCurrentData: () => state.inputs,
  });
  pwaManager.init();

  if (state.isViewMode) {
    window.IsfFeedback.showFeedback(dom.applyFeedback, "보기 모드로 열었습니다. 로컬 저장값은 변경되지 않습니다.");
  }

  const onboardingManager = initOnboarding(state.isViewMode);
  if (onboardingManager) {
    window.addEventListener("request-onboarding", () => {
      onboardingManager.reset();
      onboardingManager.start();
    });
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

function checkReturningUser() {
  if (state.isViewMode || hasShareState()) return;
  const persisted = window.IsfStorageHub.loadLocal(STORAGE_KEY);
  if (persisted) {
    state.isDashboardMode = true;
    document.body.classList.add("is-dashboard-mode");
    state.mobileInputsCollapsed = true;
    syncMobileInputsPanelVisibility();
  }
}

function hasShareState() {
  return !!window.IsfShare.getShareIdFromUrl();
}

function bindReadonlyAdvancedNavigation() {
  if (!Array.isArray(dom.jumpAdvancedFields) || dom.jumpAdvancedFields.length === 0) {
    return;
  }

  dom.jumpAdvancedFields.forEach((field) => {
    if (!(field instanceof HTMLInputElement)) {
      return;
    }
    field.addEventListener("click", () => {
      navigateToAdvancedGroup(field.dataset.advancedTarget);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      navigateToAdvancedGroup(field.dataset.advancedTarget);
    });
  });
}

function dismissViewModeGuide() {
  if (dom.viewModeGuide) dom.viewModeGuide.hidden = true;
}

function switchToNormalMode() {
  window.location.href = window.location.pathname;
}



function bindControls() {
  bindModalEvents();

  if (dom.presetSalary) {
    dom.presetSalary.innerHTML = PRESET_SALARIES.map((s, i) => `<option value="${s.value}" ${i===2?'selected':''}>${s.label}</option>`).join('');
  }
  
  let selectedPresetStyle = 'neutral';
  if (dom.presetStyleBtns) {
    dom.presetStyleBtns.forEach(btn => {
      if (btn.dataset.style === selectedPresetStyle) btn.classList.add('is-active');
      btn.addEventListener('click', () => {
        dom.presetStyleBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        selectedPresetStyle = btn.dataset.style;
      });
    });
  }

  if (dom.applyPresetBtn) {
    dom.applyPresetBtn.addEventListener('click', () => {
      const isDirty = hasPendingChanges() || JSON.stringify(state.inputs) !== JSON.stringify(DEFAULT_INPUTS);
      if (isDirty && !window.confirm('데이터 초기화 경고: 기존에 작성하신 자산 데이터가 모두 초기화되고 프리셋으로 덮어씌워집니다. 계속하시겠습니까?')) {
        return;
      }
      
      const val = parseInt(dom.presetSalary.value, 10);
      const newPreset = applyPreset(val, selectedPresetStyle);
      if (!newPreset) return;
      
      const nextInputs = { ...DEFAULT_INPUTS, ...newPreset };
      commitImmediateInputs(nextInputs);

      if (dom.advancedSettings) {
        dom.advancedSettings.open = true;
        dom.advancedSettings.classList.add('is-highlighted');
        setTimeout(() => dom.advancedSettings.classList.remove('is-highlighted'), 3000);
        dom.advancedSettings.scrollIntoView({ behavior: "smooth", block: "start" });
        window.IsfFeedback.showFeedback(dom.applyFeedback, "프리셋이 적용되었습니다. 아래 '고급 설정'에서 세부 항목을 조정해보세요.");
      }
    });
  }

  if (dom.inputsForm) {
    dom.inputsForm.addEventListener("submit", (event) => {
      event.preventDefault();
    });
    dom.inputsForm.addEventListener("input", (event) => {
      if (state.suspendInputTracking) return;
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) return;
      
      const baseInputs = helpers.ensureDraftInputs(state);
      state.draftInputs = sanitizeInputs(helpers.readInputsFromForm(dom.inputsForm, baseInputs, { FORM_FIELD_KEYS, toWon: IsfUtils.toWon }));
      helpers.markDirty(state);
      markPendingChanges();
    });
  }

  bindReadonlyAdvancedNavigation();
  
  [dom.advancedTabExpense, dom.advancedTabSavings, dom.advancedTabInvest, dom.advancedTabRates].forEach(tab => {
    if (tab) tab.addEventListener("click", () => navigateToAdvancedGroup(tab.dataset.advancedTab));
  });

  [dom.expenseSortMode, dom.savingsSortMode, dom.investSortMode].forEach(sel => {
    if (sel) sel.addEventListener("change", () => setItemSortMode(sel.id.replace("SortMode", ""), sel.value));
  });

  if (dom.sankeyViewAmount) dom.sankeyViewAmount.addEventListener("click", () => setSankeyValueMode(SANKEY_VALUE_MODES.AMOUNT));
  if (dom.sankeyViewPercent) dom.sankeyViewPercent.addEventListener("click", () => setSankeyValueMode(SANKEY_VALUE_MODES.PERCENT));
  if (dom.sankeySortMode) dom.sankeySortMode.addEventListener("change", () => setSankeySortMode(dom.sankeySortMode.value));

  if (dom.toggleInputsMobile) dom.toggleInputsMobile.addEventListener("click", () => {
    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches) return;
    state.mobileInputsCollapsed = !state.mobileInputsCollapsed;
    syncMobileInputsPanelVisibility();
  });

  if (dom.sankeyZoomIn) dom.sankeyZoomIn.addEventListener("click", () => setSankeyZoom(state.sankeyZoom + SANKEY_ZOOM_STEP));
  if (dom.sankeyZoomOut) dom.sankeyZoomOut.addEventListener("click", () => setSankeyZoom(state.sankeyZoom - SANKEY_ZOOM_STEP));
  if (dom.sankeyZoomReset) dom.sankeyZoomReset.addEventListener("click", () => setSankeyZoom(1));
  if (dom.sankeyExport) dom.sankeyExport.addEventListener("click", exportSankeyToPng);

  if (dom.modeTR) dom.modeTR.addEventListener("click", () => setProjectionMode("TR"));
  if (dom.modePR) dom.modePR.addEventListener("click", () => setProjectionMode("PR"));
  
  ["colShowFlow", "colShowBalance", "colShowDividend"].forEach(id => {
    if (dom[id]) dom[id].addEventListener("change", () => {
      state.projectionOptions[id.replace("colShow", "show").charAt(0).toLowerCase() + id.replace("colShow", "show").slice(1)] = dom[id].checked;
      renderAll();
    });
  });

  if (dom.saveViewToLocal) dom.saveViewToLocal.addEventListener("click", handleSaveViewToLocal);
  if (dom.dismissViewModeGuide) dom.dismissViewModeGuide.addEventListener("click", dismissViewModeGuide);
  if (dom.returnToNormalMode) dom.returnToNormalMode.addEventListener("click", switchToNormalMode);

  if (dom.snapshotSelector) {
    dom.snapshotSelector.addEventListener("change", (e) => handleSnapshotSelection(e.target.value));
  }
  if (dom.saveSnapshotBtn) dom.saveSnapshotBtn.addEventListener("click", handleSaveSnapshot);
  if (dom.deleteSnapshotBtn) dom.deleteSnapshotBtn.addEventListener("click", handleDeleteSnapshot);

  if (dom.openSmartAddBtn) dom.openSmartAddBtn.addEventListener("click", handleOpenSmartAdd);
  if (dom.closeSmartAddBtn) dom.closeSmartAddBtn.addEventListener("click", handleCloseSmartAdd);
  if (dom.smartAddInput) dom.smartAddInput.addEventListener("input", handleSmartAddInput);
  if (dom.applySmartAddBtn) dom.applySmartAddBtn.addEventListener("click", () => handleApplySmartAdd(listRenderer.renderItemList));

  if (dom.surplusTransferAccountSelect) {
    dom.surplusTransferAccountSelect.addEventListener("change", (e) => {
      const draft = helpers.ensureDraftInputs(state);
      draft.surplusTransferAccountId = e.target.value;
      state.draftInputs = sanitizeInputs(draft);
      markPendingChanges();
      renderAll();
    });
  }

  // Preset Modal
  let selectedModalPresetStyle = 'neutral';
  
  if (dom.openPresetBtn) {
    dom.openPresetBtn.addEventListener("click", () => {
      if (dom.presetModal) {
        dom.presetModal.hidden = false;
        setTimeout(() => {
          dom.presetModal.classList.add("is-active");
        }, 10);
        
        const incomeWon = getMonthlyIncomeTotalWon(state.inputs);
        const salaryMan = Math.min(9900, Math.round(calculateAnnualSalaryFromMonthlyIncome(incomeWon)));
        if (dom.presetIncomeAmount) {
          dom.presetIncomeAmount.value = salaryMan > 0 ? salaryMan : 4000;
        }
        
        selectedModalPresetStyle = 'neutral';
        if (dom.presetModalStyleBtns) {
          dom.presetModalStyleBtns.forEach(btn => {
            if (btn.dataset.style === 'neutral') {
              btn.classList.add('is-active');
            } else {
              btn.classList.remove('is-active');
            }
          });
        }
      }
    });
  }

  const closePresetModal = () => {
    if (dom.presetModal) {
      dom.presetModal.classList.remove("is-active");
      setTimeout(() => { dom.presetModal.hidden = true; }, 250);
    }
  };

  if (dom.closePresetBtn) dom.closePresetBtn.addEventListener("click", closePresetModal);
  if (dom.closePresetModalCancel) dom.closePresetModalCancel.addEventListener("click", closePresetModal);

  if (dom.presetModalStyleBtns) {
    dom.presetModalStyleBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        dom.presetModalStyleBtns.forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        selectedModalPresetStyle = btn.dataset.style;
      });
    });
  }

  if (dom.applyModalPresetBtn) {
    dom.applyModalPresetBtn.addEventListener("click", () => {
      if (!dom.presetIncomeAmount) return;
      const salaryMan = parseInt(dom.presetIncomeAmount.value, 10);
      
      if (isNaN(salaryMan) || salaryMan < 0 || salaryMan > 9900) {
        alert("연봉은 0원 이상 9900만원 이하로 입력해주세요.");
        return;
      }

      const isDirty = hasPendingChanges() || JSON.stringify(state.inputs) !== JSON.stringify(DEFAULT_INPUTS);
      if (isDirty && !window.confirm('데이터 초기화 경고: 기존에 작성하신 자산 데이터가 모두 초기화되고 프리셋으로 덮어씌워집니다. 계속하시겠습니까?')) {
        return;
      }

      const newPreset = applyPresetBySalary(salaryMan, selectedModalPresetStyle);
      if (!newPreset) return;

      const nextInputs = { ...DEFAULT_INPUTS, ...newPreset };
      commitImmediateInputs(nextInputs);
      closePresetModal();

      if (dom.advancedSettings) {
        dom.advancedSettings.open = true;
        dom.advancedSettings.classList.add('is-highlighted');
        setTimeout(() => dom.advancedSettings.classList.remove('is-highlighted'), 3000);
        dom.advancedSettings.scrollIntoView({ behavior: "smooth", block: "start" });
        window.IsfFeedback.showFeedback(dom.applyFeedback, "프리셋이 적용되었습니다. 아래 '고급 설정'에서 세부 항목을 조정해보세요.");
      }
    });
  }

  bindItemEditorEvents();
  bindActionButtons();
  bindGlobalEvents();
}














function bindModalEvents() {
  if (!dom.appHeader) dom.appHeader = document.querySelector("app-header");
  if (!dom.dataHubModal) dom.dataHubModal = document.querySelector("data-hub-modal");
  if (!dom.appHeader || !dom.dataHubModal) return;

  dom.appHeader.addEventListener("open-data-hub", () => {
    dom.dataHubModal.updateBackupList(state.backupEntries);
    dom.dataHubModal.open();
  });
  dom.dataHubModal.addEventListener("restore-backup", async (e) => {
    await restoreBackupById(e.detail.backupId);
    dom.dataHubModal.close();
  });
  dom.dataHubModal.addEventListener("export-json", handleExportJson);
  dom.dataHubModal.addEventListener("import-json", async (e) => {
    await handleImportJson(e.detail.file);
    dom.dataHubModal.close();
  });
  dom.dataHubModal.addEventListener("backup-now", handleManualBackup);
  dom.dataHubModal.addEventListener("generate-isf-code", handleGenerateIsfCode);
  dom.dataHubModal.addEventListener("apply-isf-code", handleApplyIsfCode);
  dom.dataHubModal.addEventListener("merge-isf-code", handleMergeIsfCode);
}

async function handleGenerateIsfCode() {
  const code = window.IsfShare.encodePayloadForHash(
    window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, state.inputs)
  );
  if (code) {
    dom.dataHubModal.showGeneratedCode(code);
    window.IsfFeedback.showFeedback(dom.applyFeedback, "ISF CODE가 발급 및 복사되었습니다.");
  }
}

async function handleApplyIsfCode(e) {
  const code = e.detail.code;
  const decoded = window.IsfShare.decodePayloadFromHash(code, SHARE_STATE_KEY);
  if (decoded) {
    const next = sanitizeInputs({ ...DEFAULT_INPUTS, ...decoded });
    commitImmediateInputs(next);
    dom.dataHubModal.close();
    window.IsfFeedback.showFeedback(dom.applyFeedback, "코드가 성공적으로 적용되었습니다.");
  } else {
    window.IsfFeedback.showFeedback(dom.applyFeedback, "유효하지 않은 코드입니다.", true);
  }
}

async function handleMergeIsfCode(e) {
  const code = e.detail.code;
  let partnerData = window.IsfShare.decodePayloadFromHash(code, SHARE_STATE_KEY);
  
  if (!partnerData) {
    window.IsfFeedback.showFeedback(dom.applyFeedback, "유효하지 않은 코드입니다.", true);
    return;
  }

  // 외부 데이터 정제 (XSS 방지 및 무결성 확보)
  partnerData = sanitizeInputs(partnerData);

  if (!window.confirm("부부 데이터 병합: 파트너의 데이터를 현재 내 데이터와 합칠까요? (기존 항목들에 추가됩니다)")) {
    return;
  }

  const mine = state.inputs;
  const merged = { ...mine };

  // Helper to add prefix
  const addMe = (items) => items.map(it => ({ ...it, name: `[나] ${it.name.replace(/^\[(나|너)\]\s*/, '')}` }));
  const addYou = (items) => items.map(it => ({ ...it, name: `[너] ${it.name.replace(/^\[(나|너)\]\s*/, '')}` }));

  // Merge items
  merged.incomes = [...addMe(mine.incomes), ...addYou(partnerData.incomes || [])];
  merged.expenseItems = [...addMe(mine.expenseItems), ...addYou(partnerData.expenseItems || [])];
  merged.savingsItems = [...addMe(mine.savingsItems), ...addYou(partnerData.savingsItems || [])];
  merged.investItems = [...addMe(mine.investItems), ...addYou(partnerData.investItems || [])];

  // Sum up totals
  merged.startCash = (mine.startCash || 0) + (partnerData.startCash || 0);
  merged.startSavings = (mine.startSavings || 0) + (partnerData.startSavings || 0);
  merged.startInvest = (mine.startInvest || 0) + (partnerData.startInvest || 0);
  merged.startDebt = (mine.startDebt || 0) + (partnerData.startDebt || 0);
  merged.monthlyDebtPayment = (mine.monthlyDebtPayment || 0) + (partnerData.monthlyDebtPayment || 0);

  commitImmediateInputs(merged);
  dom.dataHubModal.close();
  window.IsfFeedback.showFeedback(dom.applyFeedback, "부부 통합 데이터로 병합되었습니다! 🥂");
}

function bindItemEditorEvents() {
  ["income", "expense", "savings", "invest", "account"].forEach(group => {
    const list = dom[`${group}List`];
    if (list) {
      list.addEventListener("input", (e) => handleItemInput(group, e));
      list.addEventListener("change", (e) => handleItemInput(group, e));
      list.addEventListener("click", (e) => handleItemClick(group, e));
    }
    const editBtn = dom[`edit${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (editBtn) editBtn.addEventListener("click", () => toggleItemEditor(group));
    const addBtn = dom[`add${group.charAt(0).toUpperCase() + group.slice(1)}Item`];
    if (addBtn) addBtn.addEventListener("click", () => addItemToEditor(group));
    const applyBtn = dom[`apply${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (applyBtn) applyBtn.addEventListener("click", () => applyItemEditor(group));
    const cancelBtn = dom[`cancel${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
    if (cancelBtn) cancelBtn.addEventListener("click", () => cancelItemEditor(group));
  });
  if (dom.mobileEditorAdd) dom.mobileEditorAdd.addEventListener("click", () => addItemToEditor(getActiveItemEditorGroupKey()));
  if (dom.mobileEditorApply) dom.mobileEditorApply.addEventListener("click", () => applyItemEditor(getActiveItemEditorGroupKey()));
  if (dom.mobileEditorCancel) dom.mobileEditorCancel.addEventListener("click", () => cancelItemEditor(getActiveItemEditorGroupKey()));
}

function bindActionButtons() {
  if (dom.loadSample) dom.loadSample.addEventListener("click", handleLoadSample);
  if (dom.resetInputs) dom.resetInputs.addEventListener("click", handleResetInputs);
  if (dom.applyChanges) dom.applyChanges.addEventListener("click", applyPendingChanges);
  if (dom.cancelChanges) dom.cancelChanges.addEventListener("click", cancelPendingChanges);
  if (dom.jumpToTop) dom.jumpToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

function bindGlobalEvents() {
  window.addEventListener("hashchange", handleHashChange);
  window.addEventListener("popstate", () => { syncViewModeUi(); syncViewModeGuideUi(); });
  window.addEventListener("resize", IsfUtils.debounce(() => state.snapshot && renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode), 120));
  const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
  const onChange = () => {
    if (!mq.matches) {
      state.mobileInputsCollapsed = false;
      if (state.activeAdvancedTab === "rates") setActiveAdvancedTab("expense");
    }
    syncMobileInputsPanelVisibility();
    syncAdvancedTabBlockVisibility();
    syncMobileItemEditorFab();
  };
  mq.addEventListener("change", onChange);
  window.addEventListener("orientationchange", () => window.setTimeout(() => { if (dom.sankeySvg) dom.sankeySvg.removeAttribute("viewBox"); renderAll(); }, 200));
}

function renderAll() {
  const snapshot = buildMonthlySnapshot(state.inputs);
  state.snapshot = snapshot;
  const projection = simulateProjection(state.inputs, { mode: state.projectionOptions.mode });
  const cards = buildSummaryCards(snapshot, projection, state.inputs.horizonYears);
  listRenderer.renderCards(cards, state.inputs.horizonYears);
  
  const { warnings } = calculateAccountFinancialIncomes(state.inputs);

  const sankeyData = buildSankeyData(snapshot, state.sankeySortMode);
  const transfers = sankeyData ? sankeyData.transfers : [];
  renderSankey(snapshot, buildSankeyData, state.sankeySortMode);
  listRenderer.renderTransferBoard(transfers, state.inputs.accounts);

  listRenderer.renderProjectionTable(projection, state.inputs.horizonYears, state.inputs.annualExpenseGrowth);
  listRenderer.renderInputHints(state.inputs);
  refreshInputsPanel(state.inputs, warnings);

  if (dom.surplusTransferBanner) {
    if (snapshot.surplus > 0) {
      dom.surplusTransferBanner.hidden = false;
      if (dom.surplusAmountText) {
        dom.surplusAmountText.textContent = IsfUtils.formatMoney(snapshot.surplus);
      }
      if (dom.surplusTransferAccountSelect) {
        const currentInputs = getVisibleInputs();
        const accounts = currentInputs.accounts || [];
        dom.surplusTransferAccountSelect.innerHTML = accounts.map(acc => {
          const selected = acc.id === currentInputs.surplusTransferAccountId ? "selected" : "";
          return `<option value="${acc.id}" ${selected}>${IsfUtils.escapeHtml(acc.name)}</option>`;
        }).join("");
      }
    } else {
      dom.surplusTransferBanner.hidden = true;
    }
  }
}

function setProjectionMode(mode) {
  state.projectionOptions.mode = mode;
  [dom.modeTR, dom.modePR].forEach(btn => {
    if (btn) {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle("is-active", active);
      btn.setAttribute("aria-selected", active);
    }
  });
  renderAll();
}



function commitImmediateInputs(inputs, options = {}) {
  state.inputs = sanitizeInputs(inputs);
  state.draftInputs = null;
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  persistPrimaryState(state.inputs, options);
  renderAll();
}

function persistPrimaryState(inputs, options = {}) {
  if (state.isViewMode) return;
  if (dom.appHeader) dom.appHeader.updateStatus("saving", "저장 중...");
  try {
    window.IsfStorageHub.saveLocal(STORAGE_KEY, inputs);
    if (!options.skipAutoBackup) {
      void (async () => {
        const res = await window.IsfStorageHub.triggerAutoBackup(SHARE_STATE_KEY, inputs, state.backupEntries);
        if (res.created) {
          state.backupEntries = res.nextEntries;
          syncBackupUi();
        }
      })();
    }
    if (dom.appHeader) dom.appHeader.updateStatus("success", "자동 저장됨");
  } catch (_e) {
    if (dom.appHeader) dom.appHeader.updateStatus("error", "저장 실패");
  }
}





async function handleManualBackup() {
  if (state.isViewMode || !state.backupStoreReady) return;
  const res = await window.IsfStorageHub.createManualBackup(SHARE_STATE_KEY, state.inputs, state.backupEntries, {
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

async function restoreBackupById(id) {
  const entry = state.backupEntries.find(e => e.id === id);
  if (!entry || !window.confirm(`백업(${formatBackupTimestamp(entry.createdAt)})으로 복원할까요? 현재 상태는 자동 백업됩니다.`)) return;
  await handleManualBackup();
  commitImmediateInputs(entry.data, { skipAutoBackup: true });
}

function handleExportJson() {
  window.IsfShare.exportAsJson(window.IsfShare.buildStateEnvelope(SHARE_STATE_KEY, SHARE_STATE_SCHEMA, state.inputs), "my-household-flow");
}

async function handleImportJson(file) {
  try {
    const imported = window.IsfShare.parseImportedJson(await file.text(), SHARE_STATE_KEY);
    commitImmediateInputs(imported);
  } catch (_e) { if (dom.appHeader) dom.appHeader.updateStatus("error", "JSON 오류"); }
}

async function handleSaveViewToLocal() {
  const localInputs = sanitizeInputs(cloneInputs(state.inputs));
  const result = await window.IsfStorageHub.persistViewDataLocally(STORAGE_KEY, localInputs, state.backupEntries);
  if (result.success) {
    state.backupEntries = result.backupEntries;
    syncBackupUi();
    switchToNormalMode();
  }
}

function handleLoadSample() {
  window.IsfShare.buildShareLink({ ...SAMPLE_INPUTS }, { viewMode: true }).then(link => { if (link) window.location.href = link; });
}

function createResetInputs(current) {
  return {
    ...current,
    incomes: current.incomes.map(income => ({ ...income, amount: 0 })),
    expenseItems: current.expenseItems.map(item => ({ ...item, amount: 0 })),
    savingsItems: current.savingsItems.map(item => ({ ...item, amount: 0 })),
    investItems: current.investItems.map(item => ({ ...item, amount: 0 })),
    monthlyExpense: 0,
    monthlySavings: 0,
    monthlyInvest: 0,
    monthlyDebtPayment: 0,
    startCash: 0,
    startSavings: 0,
    startInvest: 0,
    startDebt: 0,
  };
}

function handleResetInputs() {
  if (state.isViewMode || !window.confirm("모든 금액을 0으로 초기화할까요?")) return;
  commitImmediateInputs(createResetInputs(state.inputs));
}

function applyPendingChanges() {
  if (!state.draftInputs) return;
  state.inputs = sanitizeInputs(state.draftInputs);
  helpers.markClean(state);
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  persistPrimaryState(state.inputs);
  renderAll();
}

function cancelPendingChanges() {
  helpers.markClean(state);
  setPendingBarVisible(false);
  refreshInputsPanel(state.inputs);
  renderAll();
}

function handleHashChange() {
  syncViewModeUi(); syncViewModeGuideUi();
  if (state.isApplyingHashState) return;
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, "")).get(HASH_STATE_PARAM);
  const hashInputs = window.IsfShare.decodePayloadFromHash(hash, SHARE_STATE_KEY);
  if (!hashInputs) return;
  const next = sanitizeInputs({ ...DEFAULT_INPUTS, ...hashInputs });
  if (JSON.stringify(next) === JSON.stringify(state.inputs)) return;
  state.isApplyingHashState = true;
  try { commitImmediateInputs(next); } finally { state.isApplyingHashState = false; }
}

function handleItemInput(group, event) {
  if (state.suspendInputTracking) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) return;
  if (state.itemEditors[group].active) {
    const itemId = target.dataset.editorId || target.dataset.incomeId;
    const field = target.dataset.field;
    if (!itemId || !field) return;
    const item = state.itemEditors[group].items.find(e => e.id === itemId);
    if (!item) return;
    if (field === "name") item.name = target.value.slice(0, 24);
    if (field === "amount") item.amount = IsfUtils.toWon(target.value);
    if (field === "group") item.group = normalizeAllocationGroupName(target.value);
    if (field === "accountId") item.accountId = target.value;
    if (field === "allocationAccountId") {
      const idx = parseInt(target.dataset.allocationIndex, 10);
      if (item.allocations && item.allocations[idx]) {
        item.allocations[idx].accountId = target.value;
      }
    }
    if (field === "allocationAmount") {
      const idx = parseInt(target.dataset.allocationIndex, 10);
      if (item.allocations && item.allocations[idx]) {
        item.allocations[idx].amount = IsfUtils.toWon(target.value);
      }
    }
    if (field === "annualRate") {
        const parsed = parseSavingsAnnualRateInput(target.value, getVisibleInputs().annualSavingsYield);
        if (parsed === null) delete item.annualRate; else item.annualRate = parsed;
    }
    if (field === "maturityMonth") {
        const norm = normalizeMaturityMonth(target.value);
        if (!norm) delete item.maturityMonth; else item.maturityMonth = norm;
    }
    const totalWon = group === "income" ? getMonthlyIncomeTotalWon(state.itemEditors[group].items) : getMonthlyAllocationTotalWon(state.itemEditors[group].items);
    if (group === "income") listRenderer.renderIncomeTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "expense") listRenderer.renderExpenseTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "savings") listRenderer.renderSavingsTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "invest") listRenderer.renderInvestTotalHint(totalWon, state.itemEditors[group].items.length);
    setItemEditorUi(group, true);
  }
}

function handleItemClick(group, event) {
  const target = event.target;
  
  const addAllocBtn = target.closest(".add-allocation-btn");
  if (addAllocBtn && group === "income" && state.itemEditors[group].active) {
    const incomeId = addAllocBtn.dataset.incomeId;
    const item = state.itemEditors[group].items.find(e => e.id === incomeId);
    if (item) {
      if (!Array.isArray(item.allocations)) item.allocations = [];
      const defaultAcc = ((state.draftInputs || state.inputs).accounts || [])[0]?.id || "";
      item.allocations.push({ accountId: defaultAcc, amount: 0 });
      listRenderer.renderItemList(group, state.itemEditors[group].items, { editing: true });
      setItemEditorUi(group, true);
    }
    return;
  }

  const removeAllocBtn = target.closest(".remove-allocation-btn");
  if (removeAllocBtn && group === "income" && state.itemEditors[group].active) {
    const incomeId = removeAllocBtn.dataset.incomeId;
    const idx = parseInt(removeAllocBtn.dataset.allocationIndex, 10);
    const item = state.itemEditors[group].items.find(e => e.id === incomeId);
    if (item && Array.isArray(item.allocations)) {
      item.allocations.splice(idx, 1);
      listRenderer.renderItemList(group, state.itemEditors[group].items, { editing: true });
      setItemEditorUi(group, true);
    }
    return;
  }

  const btn = target.closest ? target.closest("[data-remove-income], [data-remove-editor-item]") : null;
  if (!btn) return;
  const removeId = btn.dataset.removeIncome || btn.dataset.removeEditorItem;
  if (!removeId) return;
  if (state.itemEditors[group].active) {
    if (state.itemEditors[group].items.length <= 1) return;
    state.itemEditors[group].items = state.itemEditors[group].items.filter(i => i.id !== removeId);
    listRenderer.renderItemList(group, state.itemEditors[group].items, { editing: true });
    const totalWon = group === "income" ? getMonthlyIncomeTotalWon(state.itemEditors[group].items) : getMonthlyAllocationTotalWon(state.itemEditors[group].items);
    if (group === "income") listRenderer.renderIncomeTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "expense") listRenderer.renderExpenseTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "savings") listRenderer.renderSavingsTotalHint(totalWon, state.itemEditors[group].items.length);
    else if (group === "invest") listRenderer.renderInvestTotalHint(totalWon, state.itemEditors[group].items.length);
    setItemEditorUi(group, true);
  }
}

function setPendingBarVisible(visible) {
  if (dom.pendingBar) dom.pendingBar.hidden = !visible;
  if (dom.pendingSummary) dom.pendingSummary.textContent = visible ? listRenderer.getPendingSummaryText(state.draftInputs) : "";
}

function markPendingChanges() {
  if (state.isViewMode) return;
  helpers.markDirty(state);
  helpers.syncDerivedValues(state.draftInputs, { getMonthlyAllocationTotalWon });
  helpers.applyInputsToForm(dom.inputsForm, state.draftInputs, { FORM_FIELD_KEYS, toMan: IsfUtils.toMan });
  listRenderer.renderInputHints(state.draftInputs);
  setPendingBarVisible(true);
}

function hasPendingChanges() { return !!state.draftInputs && JSON.stringify(state.draftInputs) !== JSON.stringify(state.inputs); }



function setSankeyValueMode(mode) {
  state.sankeyValueMode = mode; syncSankeyValueModeUi();
  renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
}

function setSankeySortMode(mode) { state.sankeySortMode = mode; syncSankeySortModeUi(); renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode); }

function setSankeyZoom(zoom) { state.sankeyZoom = Math.min(SANKEY_ZOOM_MAX, Math.max(SANKEY_ZOOM_MIN, zoom)); syncSankeyZoomUi(); }

function setItemSortMode(group, mode) {
  state.itemSortModes[group] = mode;
  const inputs = getVisibleInputs();
  listRenderer.renderItemList(group, inputs[`${group}Items`], { editing: state.itemEditors[group].active });
  syncItemSortModeUi();
}

function getVisibleInputs() { return helpers.getVisibleInputs(state); }



function toggleItemEditor(group) { state.itemEditors[group].active ? cancelItemEditor(group) : startItemEditor(group); }

function startItemEditor(group) {
  closeAllItemEditors(group);
  const rawItems = group === "income" ? getVisibleInputs().incomes : (group === "account" ? getVisibleInputs().accounts : getVisibleInputs()[`${group}Items`]);
  const items = cloneInputs(rawItems);
  state.itemEditors[group] = { active: true, items, baselineSignature: helpers.getItemEditorSignature(items) };
  listRenderer.renderItemList(group, items, { editing: true });
  setItemEditorUi(group, true);
}

function applyItemEditor(group) {
  const editor = state.itemEditors[group];
  const draft = helpers.ensureDraftInputs(state);
  
  if (group === "income") {
    const incomes = editor.items;
    for (const item of incomes) {
      if (Array.isArray(item.allocations) && item.allocations.length > 0) {
        const allocTotal = item.allocations.reduce((sum, al) => sum + al.amount, 0);
        if (allocTotal > item.amount) {
          alert(`오류: '${item.name}' 항목의 계좌별 분배 금액 합계(${IsfUtils.toMan(allocTotal)}만원)가 전체 수입 금액(${IsfUtils.toMan(item.amount)}만원)을 초과할 수 없습니다. 금액 조정을 해 주십시오.`);
          return;
        }
      }
    }
    draft.incomes = editor.items;
  } else if (group === "account") {
    draft.accounts = editor.items;
  } else {
    draft[`${group}Items`] = editor.items;
  }
  
  state.draftInputs = sanitizeInputs(draft);
  cancelItemEditor(group);
  markPendingChanges();
}

function cancelItemEditor(group) {
  state.itemEditors[group].active = false;
  const rawItems = group === "income" ? getVisibleInputs().incomes : (group === "account" ? getVisibleInputs().accounts : getVisibleInputs()[`${group}Items`]);
  listRenderer.renderItemList(group, rawItems);
  setItemEditorUi(group, false);
}

function addItemToEditor(group) {
  const editor = state.itemEditors[group];
  if (!editor.active || editor.items.length >= MAX_ALLOCATION_ITEMS) return;
  if (group === "income") {
    editor.items.push(createIncomeItem());
  } else if (group === "account") {
    editor.items.push({ id: "acc-" + Date.now() + "-" + editor.items.length, name: "" });
  } else {
    editor.items.push({ id: createAllocationItemId(group, editor.items.length), name: "", amount: 0 });
  }
  listRenderer.renderItemList(group, editor.items, { editing: true });
  setItemEditorUi(group, true);
}

function setItemEditorUi(group, active) {
  const actions = dom[`${group}EditorActions`]; if (actions) actions.hidden = !active;
  const editBtn = dom[`edit${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
  if (editBtn) editBtn.textContent = active ? "편집 완료" : "항목 편집";
  const applyBtn = dom[`apply${group.charAt(0).toUpperCase() + group.slice(1)}Items`];
  if (active && applyBtn) {
    const currentSignature = helpers.getItemEditorSignature(state.itemEditors[group].items);
    const changed = currentSignature !== state.itemEditors[group].baselineSignature;
    applyBtn.disabled = !changed;
    if (dom.mobileEditorApply) dom.mobileEditorApply.disabled = !changed;
  }
  syncMobileItemEditorFab();
  syncGroupOptionsFor(group);
}

function closeAllItemEditors(except = "") {
  ["income", "expense", "savings", "invest", "account"].forEach(g => { if (g !== except && state.itemEditors[g].active) cancelItemEditor(g); });
}




function navigateToAdvancedGroup(group) {
  setActiveAdvancedTab(group);
  activateMgmtTab("flow");
  const panel = document.getElementById("mgmtPanelFlow");
  if (panel) panel.scrollIntoView({ behavior: "smooth", block: "start" });
}


function getActiveItemEditorGroupKey() { return helpers.getActiveItemEditorGroupKey(state.itemEditors); }





function initializeBackupStore() {
  if (!window.IsfBackupManager.isIndexedDbAvailable()) return;
  window.IsfBackupManager.loadBackupEntriesFromDb(SHARE_STATE_KEY).then(entries => {
    state.backupStoreReady = true; if (entries) { state.backupEntries = entries; syncBackupUi(); }
  }).catch(() => { state.backupStoreReady = true; state.backupStoreError = true; });
}
async function initializeInputsFromShareId() {
  const sid = window.IsfShare.getShareIdFromUrl();
  if (sid) {
    const sidInputs = await loadShareSnapshotById(sid, (id) => id);
    if (sidInputs) commitImmediateInputs(sidInputs);
  }
}

function activateMgmtTab(tabKey) {
  const tabs = document.querySelectorAll(".mgmt-tab[data-mgmt-tab]");
  const panels = document.querySelectorAll(".mgmt-panel[id^='mgmtPanel']");
  tabs.forEach(tab => {
    const active = tab.dataset.mgmtTab === tabKey;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach(panel => {
    const targetId = `mgmtPanel${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`;
    panel.hidden = panel.id !== targetId;
  });
}

function initMgmtTabs() {
  const tabs = document.querySelectorAll(".mgmt-tab[data-mgmt-tab]");
  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activateMgmtTab(tab.dataset.mgmtTab);
    });
  });
  activateMgmtTab("income");
}
