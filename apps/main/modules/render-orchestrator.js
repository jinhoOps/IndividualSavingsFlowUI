import { IsfUtils } from "../../../shared/core/utils.js";

import {
  buildMonthlySnapshot,
  simulateProjection,
} from "./calculator.js";
import { buildSankeyData } from "./sankey-builder.js";
import { renderSankey } from "./sankey-renderer.js";
import { renderNetworkMap } from "./network-map-renderer.js";
import { buildFinancialSummaryGroups } from "./financial-summary.js";
import { renderFinancialSummaryGroups } from "./financial-summary-renderer.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
import { refreshInputsPanel } from "./ui-controller.js";

export function createRenderOrchestrator() {
  function updateSankeyCorrectionStatus(inputs) {
    if (!dom.sankeyCorrectionStatus) return;
    dom.sankeyCorrectionStatus.closest(".sankey-correction-control")?.setAttribute("hidden", "");
    const corrections = Array.isArray(inputs?.accountCorrections) ? inputs.accountCorrections : [];
    dom.sankeyCorrectionStatus.classList.toggle("is-warning", corrections.length > 0);
    dom.sankeyCorrectionStatus.textContent = "";
    dom.sankeyCorrectionStatus.removeAttribute("title");
  }

  function getVisibleInputs() {
    return helpers.getVisibleInputs(state);
  }

  function renderAll() {
    const inputs = getVisibleInputs();
    const snapshot = buildMonthlySnapshot(inputs);
    state.snapshot = snapshot;
    const projection = simulateProjection(inputs, { mode: state.projectionOptions.mode });
    renderFinancialSummaryGroups(dom.summaryCards, buildFinancialSummaryGroups(inputs, { projection }));
    updateSankeyCorrectionStatus(inputs);

    const warnings = {};
    if (dom.appHeader && typeof dom.appHeader.setFinancialWarning === "function") {
      dom.appHeader.setFinancialWarning("none", "");
    }

    const sankeyData = buildSankeyData(snapshot, state.sankeySortMode, state.sankeyGrouping);
    renderSankey(snapshot, buildSankeyData, state.sankeySortMode);

    listRenderer.renderTransferRulesList([], []);
    listRenderer.renderTransferSelectOptions([]);
    renderNetworkMap(dom.networkMapInner, [], []);
    listRenderer.updateSourceBalanceHint(inputs, dom.transferSourceSelect ? dom.transferSourceSelect.value : "");

    listRenderer.renderProjectionTable(projection, inputs.horizonYears, inputs.annualExpenseGrowth);
    listRenderer.renderInputHints(inputs);
    refreshInputsPanel(inputs, warnings);

    if (dom.surplusTransferBanner) {
      if (snapshot.surplus > 0) {
        dom.surplusTransferBanner.hidden = false;
        dom.surplusTransferBanner.classList.remove("is-deficit");
        if (dom.surplusNormalWrapper) dom.surplusNormalWrapper.hidden = false;
        if (dom.surplusDeficitWrapper) dom.surplusDeficitWrapper.hidden = true;

        if (dom.surplusAmountText) {
          dom.surplusAmountText.textContent = IsfUtils.formatMoney(snapshot.surplus);
        }
        if (dom.surplusTransferAccountSelect) {
          const currentInputs = getVisibleInputs();
          const accounts = currentInputs.accounts || [];
          dom.surplusTransferAccountSelect.replaceChildren(...accounts.map((account) => {
            const option = document.createElement("option");
            option.value = account.id;
            option.textContent = account.name;
            option.selected = account.id === currentInputs.surplusTransferAccountId;
            return option;
          }));
        }
      } else if (snapshot.deficit > 0) {
        dom.surplusTransferBanner.hidden = false;
        dom.surplusTransferBanner.classList.add("is-deficit");
        if (dom.surplusNormalWrapper) dom.surplusNormalWrapper.hidden = true;
        if (dom.surplusDeficitWrapper) dom.surplusDeficitWrapper.hidden = false;

        if (dom.deficitAmountText) {
          dom.deficitAmountText.textContent = `-${IsfUtils.formatMoney(snapshot.deficit)}`;
        }
      } else {
        dom.surplusTransferBanner.hidden = true;
      }
    }
  }

  function setProjectionMode(mode) {
    state.projectionOptions.mode = mode;
    [dom.modeTR, dom.modePR].forEach((button) => {
      if (!button) return;
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
    renderAll();
  }

  return {
    renderAll,
    setProjectionMode,
    getVisibleInputs,
  };
}
