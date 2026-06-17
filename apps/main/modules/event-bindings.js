import { IsfUtils } from "../../../shared/core/utils.js";

import {
  DEFAULT_INPUTS,
  FORM_FIELD_KEYS,
  MOBILE_LAYOUT_QUERY,
  SANKEY_VALUE_MODES,
} from "./constants.js";
import {
  sanitizeInputs,
  getMonthlyIncomeTotalWon,
  getMonthlyAllocationTotalWon,
} from "./input-sanitizer.js";
import { buildSankeyData } from "./sankey-builder.js";
import { renderSankey, exportSankeyToPng } from "./sankey-renderer.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { PRESET_SALARIES, applyPreset, applyPresetBySalary, calculateAnnualSalaryFromMonthlyIncome } from "./presets.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
import {
  handleOpenSmartAdd,
  handleCloseSmartAdd,
  handleSmartAddInput,
  handleApplySmartAdd,
  handleSnapshotSelection,
  handleSaveSnapshot,
  handleDeleteSnapshot,
} from "./feature-controllers.js";
import {
  syncViewModeUi,
  syncViewModeGuideUi,
  syncMobileInputsPanelVisibility,
  syncAdvancedTabBlockVisibility,
  syncMobileItemEditorFab,
} from "./ui-controller.js";

export function activateMgmtTab(tabKey) {
  const tabs = document.querySelectorAll(".mgmt-tab[data-mgmt-tab]");
  const panels = document.querySelectorAll(".mgmt-panel[id^='mgmtPanel']");
  tabs.forEach((tab) => {
    const active = tab.dataset.mgmtTab === tabKey;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", active ? "true" : "false");
  });
  panels.forEach((panel) => {
    const targetId = `mgmtPanel${tabKey.charAt(0).toUpperCase() + tabKey.slice(1)}`;
    panel.hidden = panel.id !== targetId;
  });
}

export function initMgmtTabs() {
  const tabs = document.querySelectorAll(".mgmt-tab[data-mgmt-tab]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateMgmtTab(tab.dataset.mgmtTab);
    });
  });
  activateMgmtTab("income");
}

export function bindStep1Events(commands) {
  bindModalEvents(commands.persistence);
  bindPresetControls(commands);
  bindFormTracking(commands);
  bindReadonlyAdvancedNavigation(commands.itemEditor.navigateToAdvancedGroup);
  bindAdvancedTabs(commands.itemEditor.navigateToAdvancedGroup);
  bindSortControls(commands.itemEditor.setItemSortMode);
  bindSankeyControls(commands.visualization);
  bindProjectionControls(commands.render);
  bindViewModeControls(commands.persistence);
  bindSnapshotControls();
  bindSmartAddControls();
  bindSurplusTransferControl(commands.persistence.markPendingChanges);
  bindPresetModal(commands);
  commands.itemEditor.bindItemEditorEvents();
  bindActionButtons(commands.persistence.handleResetInputs);
  bindGlobalEvents(commands);
  commands.visualization.bindVisualizationAndTooltipEvents();
}

function bindPresetControls({ persistence }) {
  if (dom.presetSalary) {
    dom.presetSalary.replaceChildren(...PRESET_SALARIES.map((salary, index) => {
      const option = document.createElement("option");
      option.value = String(salary.value);
      option.textContent = salary.label;
      option.selected = index === 2;
      return option;
    }));
  }

  let selectedPresetStyle = "neutral";
  if (dom.presetStyleBtns) {
    dom.presetStyleBtns.forEach((button) => {
      if (button.dataset.style === selectedPresetStyle) button.classList.add("is-active");
      button.addEventListener("click", () => {
        dom.presetStyleBtns.forEach((candidate) => candidate.classList.remove("is-active"));
        button.classList.add("is-active");
        selectedPresetStyle = button.dataset.style;
      });
    });
  }

  if (dom.applyPresetBtn) {
    dom.applyPresetBtn.addEventListener("click", () => {
      const isDirty = persistence.hasPendingChanges() || JSON.stringify(state.inputs) !== JSON.stringify(DEFAULT_INPUTS);
      if (isDirty && !window.confirm("데이터 초기화 경고: 기존에 작성하신 자산 데이터가 모두 초기화되고 프리셋으로 덮어씌워집니다. 계속하시겠습니까?")) {
        return;
      }

      const presetValue = parseInt(dom.presetSalary.value, 10);
      const presetInputs = applyPreset(presetValue, selectedPresetStyle);
      if (!presetInputs) return;

      persistence.commitImmediateInputs(presetInputs);
      showPresetAppliedFeedback();
    });
  }
}

function bindFormTracking({ persistence, render }) {
  if (!dom.inputsForm) return;
  dom.inputsForm.addEventListener("submit", (event) => {
    event.preventDefault();
  });
  const handleFormValueEvent = (event, options = {}) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !FORM_FIELD_KEYS.includes(target.name)) return;
    if (state.suspendInputTracking && !options.capture) return;

    state.inputs = sanitizeInputs(helpers.readInputsFromForm(dom.inputsForm, state.inputs, {
      FORM_FIELD_KEYS,
      toWon: IsfUtils.toWon,
    }));
    helpers.syncDerivedValues(state.inputs, { getMonthlyAllocationTotalWon });
    listRenderer.renderInputHints(state.inputs);
    persistence.persistPrimaryState(state.inputs);
    window.clearTimeout(state.formRenderTimer);
    state.formRenderTimer = window.setTimeout(() => {
      render.renderAll();
    }, 150);
  };
  dom.inputsForm.addEventListener("input", (event) => handleFormValueEvent(event, { capture: true }), true);
}

function bindReadonlyAdvancedNavigation(navigateToAdvancedGroup) {
  if (!Array.isArray(dom.jumpAdvancedFields) || dom.jumpAdvancedFields.length === 0) return;
  dom.jumpAdvancedFields.forEach((field) => {
    if (!(field instanceof HTMLInputElement)) return;
    field.addEventListener("click", () => {
      navigateToAdvancedGroup(field.dataset.advancedTarget);
    });
    field.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      navigateToAdvancedGroup(field.dataset.advancedTarget);
    });
  });
}

function bindAdvancedTabs(navigateToAdvancedGroup) {
  [dom.advancedTabExpense, dom.advancedTabSavings, dom.advancedTabInvest].forEach((tab) => {
    if (tab) tab.addEventListener("click", () => navigateToAdvancedGroup(tab.dataset.advancedTab));
  });
}

function bindSortControls(setItemSortMode) {
  [dom.expenseSortMode, dom.savingsSortMode, dom.investSortMode].forEach((select) => {
    if (!select) return;
    select.addEventListener("change", () => setItemSortMode(select.id.replace("SortMode", ""), select.value));
  });
}

function bindSankeyControls(visualization) {
  if (dom.sankeyViewAmount) dom.sankeyViewAmount.addEventListener("click", () => visualization.setSankeyValueMode(SANKEY_VALUE_MODES.AMOUNT));
  if (dom.sankeyViewPercent) dom.sankeyViewPercent.addEventListener("click", () => visualization.setSankeyValueMode(SANKEY_VALUE_MODES.PERCENT));
  if (dom.sankeySortMode) dom.sankeySortMode.addEventListener("change", () => visualization.setSankeySortMode(dom.sankeySortMode.value));
  if (dom.sankeyGroupingExpense) dom.sankeyGroupingExpense.addEventListener("change", () => visualization.setSankeyGrouping("expense", dom.sankeyGroupingExpense.value));
  if (dom.sankeyGroupingSavings) dom.sankeyGroupingSavings.addEventListener("change", () => visualization.setSankeyGrouping("savings", dom.sankeyGroupingSavings.value));
  if (dom.sankeyGroupingInvest) dom.sankeyGroupingInvest.addEventListener("change", () => visualization.setSankeyGrouping("invest", dom.sankeyGroupingInvest.value));
  if (dom.sankeyExport) dom.sankeyExport.addEventListener("click", exportSankeyToPng);
}

function bindProjectionControls(render) {
  if (dom.modeTR) dom.modeTR.addEventListener("click", () => render.setProjectionMode("TR"));
  if (dom.modePR) dom.modePR.addEventListener("click", () => render.setProjectionMode("PR"));
  ["colShowFlow", "colShowBalance", "colShowDividend"].forEach((id) => {
    if (!dom[id]) return;
    dom[id].addEventListener("change", () => {
      const optionKey = id.replace("colShow", "show").charAt(0).toLowerCase() + id.replace("colShow", "show").slice(1);
      state.projectionOptions[optionKey] = dom[id].checked;
      render.renderAll();
    });
  });
}

function bindViewModeControls(persistence) {
  if (dom.saveViewToLocal) dom.saveViewToLocal.addEventListener("click", persistence.handleSaveViewToLocal);
  if (dom.dismissViewModeGuide) {
    dom.dismissViewModeGuide.addEventListener("click", () => {
      if (dom.viewModeGuide) dom.viewModeGuide.hidden = true;
    });
  }
  if (dom.returnToNormalMode) {
    dom.returnToNormalMode.addEventListener("click", () => {
      window.location.href = window.location.pathname;
    });
  }
}

function bindSnapshotControls() {
  if (dom.snapshotSelector) {
    dom.snapshotSelector.addEventListener("change", (event) => handleSnapshotSelection(event.target.value));
  }
  if (dom.saveSnapshotBtn) dom.saveSnapshotBtn.addEventListener("click", handleSaveSnapshot);
  if (dom.deleteSnapshotBtn) dom.deleteSnapshotBtn.addEventListener("click", handleDeleteSnapshot);
}

function bindSmartAddControls() {
  if (dom.openSmartAddBtn) dom.openSmartAddBtn.addEventListener("click", handleOpenSmartAdd);
  if (dom.closeSmartAddBtn) dom.closeSmartAddBtn.addEventListener("click", handleCloseSmartAdd);
  if (dom.smartAddInput) dom.smartAddInput.addEventListener("input", handleSmartAddInput);
  if (dom.applySmartAddBtn) {
    dom.applySmartAddBtn.addEventListener("click", () => handleApplySmartAdd(listRenderer.renderItemList));
  }
}

function bindSurplusTransferControl(markPendingChanges) {
  if (!dom.surplusTransferAccountSelect) return;
  dom.surplusTransferAccountSelect.addEventListener("change", (event) => {
    state.inputs.surplusTransferAccountId = event.target.value;
    state.inputs = sanitizeInputs(state.inputs);
    markPendingChanges();
  });
}

function bindPresetModal({ persistence }) {
  let selectedModalPresetStyle = "neutral";

  if (dom.openPresetBtn) {
    dom.openPresetBtn.addEventListener("click", () => {
      if (!dom.presetModal) return;
      dom.presetModal.hidden = false;
      setTimeout(() => {
        dom.presetModal.classList.add("is-active");
        IsfUtils.updateAllKoreanWonHints(dom.presetModal);
      }, 10);

      const incomeWon = getMonthlyIncomeTotalWon(state.inputs.incomes);
      const salaryWon = Math.min(99000000, Math.round(calculateAnnualSalaryFromMonthlyIncome(incomeWon)));
      if (dom.presetIncomeAmount) {
        dom.presetIncomeAmount.value = salaryWon > 0 ? salaryWon : 40000000;
      }

      selectedModalPresetStyle = "neutral";
      if (dom.presetModalStyleBtns) {
        dom.presetModalStyleBtns.forEach((button) => {
          button.classList.toggle("is-active", button.dataset.style === "neutral");
        });
      }
    });
  }

  const closePresetModal = () => {
    if (!dom.presetModal) return;
    dom.presetModal.classList.remove("is-active");
    setTimeout(() => {
      dom.presetModal.hidden = true;
    }, 250);
  };

  if (dom.closePresetBtn) dom.closePresetBtn.addEventListener("click", closePresetModal);
  if (dom.closePresetModalCancel) dom.closePresetModalCancel.addEventListener("click", closePresetModal);

  if (dom.presetModalStyleBtns) {
    dom.presetModalStyleBtns.forEach((button) => {
      button.addEventListener("click", () => {
        dom.presetModalStyleBtns.forEach((candidate) => candidate.classList.remove("is-active"));
        button.classList.add("is-active");
        selectedModalPresetStyle = button.dataset.style;
      });
    });
  }

  if (dom.applyModalPresetBtn) {
    dom.applyModalPresetBtn.addEventListener("click", () => {
      if (!dom.presetIncomeAmount) return;
      const salaryWon = IsfUtils.toWon(dom.presetIncomeAmount.value);
      if (Number.isNaN(salaryWon) || salaryWon < 0 || salaryWon > 99000000) {
        alert("연봉은 0원 이상 9,900만 원 이하로 입력해주세요.");
        return;
      }

      const isDirty = persistence.hasPendingChanges() || JSON.stringify(state.inputs) !== JSON.stringify(DEFAULT_INPUTS);
      if (isDirty && !window.confirm("데이터 초기화 경고: 기존에 작성하신 자산 데이터가 모두 초기화되고 프리셋으로 덮어씌워집니다. 계속하시겠습니까?")) {
        return;
      }

      const presetInputs = applyPresetBySalary(salaryWon, selectedModalPresetStyle);
      if (!presetInputs) return;
      persistence.commitImmediateInputs(presetInputs);
      closePresetModal();
      showPresetAppliedFeedback();
    });
  }
}

function showPresetAppliedFeedback() {
  if (!dom.advancedSettings) return;
  dom.advancedSettings.open = true;
  dom.advancedSettings.classList.add("is-highlighted");
  setTimeout(() => dom.advancedSettings.classList.remove("is-highlighted"), 3000);
  dom.advancedSettings.scrollIntoView({ behavior: "smooth", block: "start" });
  window.IsfFeedback.showFeedback(dom.applyFeedback, "프리셋이 적용되었습니다. 아래 '고급 설정'에서 세부 항목을 조정해보세요.");
}

function bindModalEvents(persistence) {
  if (!dom.appHeader) dom.appHeader = document.querySelector("app-header");
  if (!dom.dataHubModal) dom.dataHubModal = document.querySelector("data-hub-modal");
  if (!dom.appHeader || !dom.dataHubModal) return;

  dom.appHeader.addEventListener("open-data-hub", () => {
    dom.dataHubModal.updateBackupList(state.backupEntries);
    dom.dataHubModal.open();
  });
  dom.dataHubModal.addEventListener("restore-backup", async (event) => {
    await persistence.restoreBackupById(event.detail.backupId);
    dom.dataHubModal.close();
  });
  dom.dataHubModal.addEventListener("export-json", persistence.handleExportJson);
  dom.dataHubModal.addEventListener("import-json", async (event) => {
    await persistence.handleImportJson(event.detail.file);
    dom.dataHubModal.close();
  });
  dom.dataHubModal.addEventListener("backup-now", persistence.handleManualBackup);
  dom.dataHubModal.addEventListener("generate-isf-code", persistence.handleGenerateIsfCode);
  dom.dataHubModal.addEventListener("apply-isf-code", persistence.handleApplyIsfCode);
  dom.dataHubModal.addEventListener("merge-isf-code", persistence.handleMergeIsfCode);
}

function bindActionButtons(handleResetInputs) {
  if (dom.resetInputs) dom.resetInputs.addEventListener("click", handleResetInputs);
  if (dom.jumpToTop) dom.jumpToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  function toggleControlsPanel() {
    const isHidden = dom.inputsPanelContent.hasAttribute("hidden");
    if (isHidden) {
      dom.inputsPanelContent.removeAttribute("hidden");
      dom.controlsPanel.classList.remove("is-collapsed");
      dom.toggleControlsBtn.setAttribute("aria-expanded", "true");
      dom.toggleControlsBtn.textContent = "▴";
    } else {
      dom.inputsPanelContent.setAttribute("hidden", "");
      dom.controlsPanel.classList.add("is-collapsed");
      dom.toggleControlsBtn.setAttribute("aria-expanded", "false");
      dom.toggleControlsBtn.textContent = "▾";
    }
  }

  function toggleProjectionPanel() {
    const projectionPanel = dom.projectionPanelContent.closest(".projection-panel");
    const isHidden = dom.projectionPanelContent.hasAttribute("hidden");
    if (isHidden) {
      dom.projectionPanelContent.removeAttribute("hidden");
      if (projectionPanel) projectionPanel.classList.remove("is-collapsed");
      dom.toggleProjectionBtn.setAttribute("aria-expanded", "true");
      dom.toggleProjectionBtn.textContent = "▴";
    } else {
      dom.projectionPanelContent.setAttribute("hidden", "");
      if (projectionPanel) projectionPanel.classList.add("is-collapsed");
      dom.toggleProjectionBtn.setAttribute("aria-expanded", "false");
      dom.toggleProjectionBtn.textContent = "▾";
    }
  }

  if (dom.toggleControlsBtn && dom.inputsPanelContent && dom.controlsPanel) {
    dom.toggleControlsBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleControlsPanel();
    });

    const controlsHeader = dom.controlsPanel.querySelector(".section-head");
    if (controlsHeader) {
      controlsHeader.addEventListener("click", (event) => {
        if (window.innerWidth > 760) return;
        if (typeof event.target.closest !== "function" || event.target.closest("#openPresetBtn") || event.target.closest(".help-tooltip-trigger") || event.target.closest(".panel-toggle-btn")) {
          return;
        }
        toggleControlsPanel();
      });
    }
  }

  if (dom.toggleProjectionBtn && dom.projectionPanelContent) {
    dom.toggleProjectionBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleProjectionPanel();
    });

    const projectionPanel = dom.projectionPanelContent.closest(".projection-panel");
    const projectionHeader = projectionPanel ? projectionPanel.querySelector(".section-head") : null;
    if (projectionHeader) {
      projectionHeader.addEventListener("click", (event) => {
        if (window.innerWidth > 760) return;
        if (typeof event.target.closest !== "function" || event.target.closest(".help-tooltip-trigger") || event.target.closest(".panel-toggle-btn")) {
          return;
        }
        toggleProjectionPanel();
      });
    }
  }
}

function bindGlobalEvents({ persistence, render }) {
  window.addEventListener("hashchange", persistence.handleHashChange);
  window.addEventListener("popstate", () => {
    syncViewModeUi();
    syncViewModeGuideUi();
  });
  window.addEventListener("resize", IsfUtils.debounce(() => {
    if (state.snapshot) renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
  }, 120));

  const mq = window.matchMedia(MOBILE_LAYOUT_QUERY);
  const onChange = () => {
    if (!mq.matches) {
      state.mobileInputsCollapsed = false;
      if (state.activeAdvancedTab === "rates") state.activeAdvancedTab = "expense";
    }
    syncMobileInputsPanelVisibility();
    syncAdvancedTabBlockVisibility();
    syncMobileItemEditorFab();
  };
  mq.addEventListener("change", onChange);
  window.addEventListener("orientationchange", () => {
    window.setTimeout(() => {
      if (dom.sankeySvg) dom.sankeySvg.removeAttribute("viewBox");
      render.renderAll();
    }, 200);
  });
}
