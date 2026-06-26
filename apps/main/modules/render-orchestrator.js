import {
  buildMonthlySnapshot,
  simulateProjection,
} from "./calculator.js";
import { buildSankeyData } from "./sankey-builder.js";
import { renderSankey } from "./sankey-renderer.js";
import { buildFinancialSummaryGroups } from "./financial-summary.js";
import { renderFinancialSummaryGroups } from "./financial-summary-renderer.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
import { refreshInputsPanel } from "./ui-controller.js";

export function createRenderOrchestrator() {
  function getVisibleInputs() {
    return helpers.getVisibleInputs(state);
  }

  function hasAccountFlowHandoff(inputs) {
    const handoff = inputs?.accountFlowHandoff;
    if (!handoff || typeof handoff !== "object") return false;
    const lists = [
      handoff.accounts,
      handoff.incomes,
      handoff.incomeAllocations,
      handoff.expenseItems,
      handoff.savingsItems,
      handoff.investItems,
      handoff.itemAccounts,
      handoff.transfers,
    ];
    return lists.some((list) => Array.isArray(list) && list.length > 0);
  }

  function renderAccountFlowPortfolioGuide(inputs) {
    if (!dom.accountFlowPortfolioGuide) return;
    dom.accountFlowPortfolioGuide.hidden = !hasAccountFlowHandoff(inputs);
  }

  function renderAll() {
    const inputs = getVisibleInputs();
    const snapshot = buildMonthlySnapshot(inputs);
    state.snapshot = snapshot;
    const projection = simulateProjection(inputs, { mode: state.projectionOptions.mode });
    renderFinancialSummaryGroups(dom.summaryCards, buildFinancialSummaryGroups(inputs, { projection }));

    const warnings = {};
    if (dom.appHeader && typeof dom.appHeader.setFinancialWarning === "function") {
      dom.appHeader.setFinancialWarning("none", "");
    }
	
    renderAccountFlowPortfolioGuide(inputs);
    renderSankey(snapshot, buildSankeyData, state.sankeySortMode);

    listRenderer.renderProjectionTable(projection, inputs.horizonYears, inputs.annualExpenseGrowth);
    listRenderer.renderInputHints(inputs);
    refreshInputsPanel(inputs, warnings);
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
