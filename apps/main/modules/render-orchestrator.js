import { IsfUtils } from "../../../shared/core/utils.js";

import {
  buildMonthlySnapshot,
  simulateProjection,
  calculateAccountFinancialIncomes,
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
    const corrections = Array.isArray(inputs?.accountCorrections) ? inputs.accountCorrections : [];
    dom.sankeyCorrectionStatus.classList.toggle("is-warning", corrections.length > 0);
    dom.sankeyCorrectionStatus.textContent = corrections.length > 0
      ? `${corrections.length}개 계좌 연결 보정됨`
      : "계좌 연결 정상";
    if (corrections.length > 0) {
      dom.sankeyCorrectionStatus.setAttribute(
        "title",
        corrections.map((correction) => correction.message).join("\n"),
      );
    } else {
      dom.sankeyCorrectionStatus.removeAttribute("title");
    }
  }

  function getVisibleInputs() {
    return helpers.getVisibleInputs(state);
  }

  function renderAll() {
    const inputs = getVisibleInputs();
    const snapshot = buildMonthlySnapshot(inputs);
    state.snapshot = snapshot;
    const projection = simulateProjection(inputs, { mode: state.projectionOptions.mode });
    renderFinancialSummaryGroups(dom.summaryCards, buildFinancialSummaryGroups(inputs));
    updateSankeyCorrectionStatus(inputs);

    const { warnings } = calculateAccountFinancialIncomes(inputs);
    if (dom.appHeader && typeof dom.appHeader.setFinancialWarning === "function") {
      let maxStatus = "none";
      let message = "";
      if (warnings && typeof warnings === "object") {
        const warningValues = Object.values(warnings);
        const hasCrit = warningValues.some((warning) => warning.status === "crit");
        const hasWarn = warningValues.some((warning) => warning.status === "warn");
        if (hasCrit) {
          maxStatus = "crit";
          const critWarnings = warningValues.filter((warning) => warning.status === "crit");
          message = `⚠️ 금융소득 종합과세 한도 초과!\n(${critWarnings.map((warning) => warning.message).join(", ")})`;
        } else if (hasWarn) {
          maxStatus = "warn";
          const warnWarnings = warningValues.filter((warning) => warning.status === "warn");
          message = `💡 금융소득 종합과세 주의 (Safety Margin 도달)\n(${warnWarnings.map((warning) => warning.message).join(", ")})`;
        }
      }
      dom.appHeader.setFinancialWarning(maxStatus, message);
    }

    const sankeyData = buildSankeyData(snapshot, state.sankeySortMode, state.sankeyGrouping);
    const transfers = sankeyData ? sankeyData.transfers : [];
    renderSankey(snapshot, buildSankeyData, state.sankeySortMode);

    listRenderer.renderTransferRulesList(inputs.transfers || [], inputs.accounts);
    listRenderer.renderTransferSelectOptions(inputs.accounts);

    const accountNodes = sankeyData ? sankeyData.nodes.filter((node) => node.column === 1 || node.column === 1.5) : [];
    const accountsWithValues = inputs.accounts.map((account) => {
      const node = accountNodes.find((candidate) => candidate.id === account.id);
      return {
        ...account,
        value: node ? node.value : 0,
      };
    });
    renderNetworkMap(dom.networkMapInner, accountsWithValues, transfers);
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
