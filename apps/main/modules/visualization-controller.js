import { IsfUtils } from "../../../shared/core/utils.js";

import { SANKEY_VALUE_MODES } from "./constants.js";
import { buildSankeyData } from "./sankey-builder.js";
import { renderSankey } from "./sankey-renderer.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { sanitizeInputs } from "./input-sanitizer.js";
import { summarizeAccountCorrections } from "./account-correction.js";
import * as helpers from "./state-helpers.js";
import * as listRenderer from "./list-renderer.js";
import {
  syncSankeyValueModeUi,
  syncSankeySortModeUi,
  syncSankeyGroupingUi,
} from "./ui-controller.js";

export function createVisualizationController({ markPendingChanges }) {
  function updateSankeyCorrectionStatus(corrections = state.inputs?.accountCorrections) {
    if (!dom.sankeyCorrectionStatus) return;
    const safeCorrections = Array.isArray(corrections) ? corrections : [];
    dom.sankeyCorrectionStatus.classList.toggle("is-warning", safeCorrections.length > 0);
    dom.sankeyCorrectionStatus.textContent = safeCorrections.length > 0
      ? `${safeCorrections.length}개 계좌 연결 보정됨`
      : "계좌 연결 정상";
    const detail = summarizeAccountCorrections(safeCorrections);
    if (detail) {
      dom.sankeyCorrectionStatus.setAttribute("title", detail);
    } else {
      dom.sankeyCorrectionStatus.removeAttribute("title");
    }
  }

  function refreshSankeyAccountCorrections() {
    const repairedInputs = sanitizeInputs(state.inputs);
    state.inputs = repairedInputs;
    state.draftInputs = null;
    markPendingChanges();
    updateSankeyCorrectionStatus(repairedInputs.accountCorrections);
  }

  function setSankeyValueMode(mode) {
    state.sankeyValueMode = mode;
    syncSankeyValueModeUi();
    renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
  }

  function setSankeySortMode(mode) {
    state.sankeySortMode = mode;
    syncSankeySortModeUi();
    renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
  }

  function setSankeyGrouping(category, value) {
    state.sankeyGrouping[category] = value;
    syncSankeyGroupingUi();
    if (state.snapshot) renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
  }

  function setSankeyDetailMode(mode) {
    state.sankeyDetailMode = mode;
    syncSankeyGroupingUi();
    if (state.snapshot) renderSankey(state.snapshot, buildSankeyData, state.sankeySortMode);
  }

  function bindVisualizationAndTooltipEvents() {
    const sankeyTabButtons = [dom.showSankeyBasicBtn, dom.showSankeyDetailBtn, dom.showNetworkBtn].filter(Boolean);
    if (sankeyTabButtons.length === 3 && dom.visualizationSlider) {
      const switchVisualization = (activeButton, detailMode, sliderIndex) => {
        sankeyTabButtons.forEach((button) => {
          button.classList.toggle("is-active", button === activeButton);
          button.setAttribute("aria-selected", button === activeButton ? "true" : "false");
        });
        dom.visualizationSlider.style.transform = sliderIndex === 1 ? "translateX(-50%)" : "translateX(0%)";
        if (detailMode !== null) setSankeyDetailMode(detailMode);
        if (detailMode === null) {
          const controls = dom.sankeyGroupingExpense ? dom.sankeyGroupingExpense.closest(".sankey-grouping-controls") : null;
          if (controls) {
            controls.hidden = true;
            controls.setAttribute("aria-hidden", "true");
          }
        }
      };
      dom.showSankeyBasicBtn.addEventListener("click", () => switchVisualization(dom.showSankeyBasicBtn, "basic", 0));
      dom.showSankeyDetailBtn.addEventListener("click", () => switchVisualization(dom.showSankeyDetailBtn, "detail", 0));
      dom.showNetworkBtn.addEventListener("click", () => switchVisualization(dom.showNetworkBtn, null, 1));
    }

    if (dom.addTransferRuleBtn) {
      dom.addTransferRuleBtn.addEventListener("click", () => {
        const sourceId = dom.transferSourceSelect.value;
        const targetId = dom.transferTargetSelect.value;
        const amount = IsfUtils.toWon(dom.transferAmount.value);
        const label = dom.transferLabel.value.trim();

        if (!sourceId || !targetId) {
          alert("출발 계좌와 도착 계좌를 모두 선택해주세요.");
          return;
        }
        if (sourceId === targetId) {
          alert("출발 계좌와 도착 계좌는 서로 달라야 합니다.");
          return;
        }
        if (amount <= 0) {
          alert("이체할 금액을 0보다 큰 값으로 입력해주세요.");
          return;
        }

        const draft = helpers.ensureDraftInputs(state);
        const transfers = Array.isArray(draft.transfers) ? draft.transfers : [];
        const isDuplicate = transfers.some((transfer) =>
          transfer.sourceAccountId === sourceId && transfer.targetAccountId === targetId && transfer.label === label
        );
        if (isDuplicate) {
          alert("동일한 이체 규칙이 이미 존재합니다.");
          return;
        }

        state.inputs.transfers = [
          ...transfers,
          {
            id: `tr-${Date.now()}`,
            sourceAccountId: sourceId,
            targetAccountId: targetId,
            amount,
            label: label || "계좌 이체",
          },
        ];
        state.inputs = sanitizeInputs(state.inputs);
        markPendingChanges();
        dom.transferAmount.value = "";
        dom.transferLabel.value = "";
      });
    }

    if (dom.sankeyCorrectionRefresh) {
      dom.sankeyCorrectionRefresh.addEventListener("click", refreshSankeyAccountCorrections);
    }

    if (dom.transferRuleList) {
      dom.transferRuleList.addEventListener("click", (event) => {
        const button = event.target.closest(".btn-delete-transfer");
        if (!button) return;
        const transferId = button.dataset.deleteTransferId;
        const transfers = Array.isArray(state.inputs.transfers) ? state.inputs.transfers : [];
        state.inputs.transfers = transfers.filter((transfer) => transfer.id !== transferId);
        state.inputs = sanitizeInputs(state.inputs);
        markPendingChanges();
      });
    }

    if (dom.transferSourceSelect) {
      dom.transferSourceSelect.addEventListener("change", () => {
        const inputs = state.draftInputs || state.inputs;
        listRenderer.updateSourceBalanceHint(inputs, dom.transferSourceSelect.value);
      });
    }

    document.addEventListener("mouseenter", (event) => {
      if (!event.target || typeof event.target.closest !== "function") return;
      const trigger = event.target.closest(".help-tooltip-trigger");
      if (!trigger || !dom.globalTooltip) return;

      const text = trigger.getAttribute("data-tooltip") || "";
      let htmlContent = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
        .replace(/\$\$(.*?)\$\$/g, "<div class='formula-box'>$1</div>")
        .replace(/`(.*?)`/g, "<code>$1</code>")
        .replace(/━━\s*(.*?)\s*━━/g, "<div class='tooltip-section-title'>$1</div>")
        .replace(/\n/g, "<br>");

      if (/^[①②③④⑤·]/m.test(text)) {
        htmlContent = htmlContent.replace(/(?:<br>)?([①②③④⑤·])\s*(.*?)(?=<br>|$)/g, "<li>$1 $2</li>");
        htmlContent = htmlContent.replace(/(?:<li>.*?<\/li>\s*)+/g, "<ul>$&</ul>");
        htmlContent = htmlContent.replace(/<br>\s*<ul>/g, "<ul>").replace(/<\/ul>\s*<br>/g, "</ul>");
      }

      dom.globalTooltip.innerHTML = htmlContent;
      dom.globalTooltip.hidden = false;

      const rect = trigger.getBoundingClientRect();
      const tooltipWidth = text.length > 120 ? 320 : 240;
      dom.globalTooltip.style.width = `${tooltipWidth}px`;
      let left = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
      if (left < 10) left = 10;
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }
      const tooltipHeight = dom.globalTooltip.offsetHeight;
      let top = rect.top + window.scrollY - tooltipHeight - 10;
      if (top < window.scrollY + 10) {
        top = rect.bottom + window.scrollY + 10;
      }
      dom.globalTooltip.style.left = `${left}px`;
      dom.globalTooltip.style.top = `${top}px`;
    }, true);

    document.addEventListener("mouseleave", (event) => {
      if (!event.target || typeof event.target.closest !== "function") return;
      const trigger = event.target.closest(".help-tooltip-trigger");
      if (trigger && dom.globalTooltip) {
        dom.globalTooltip.hidden = true;
      }
    }, true);

    const accordionHead = document.getElementById("transferAccordionHead");
    const accordionBody = document.getElementById("transferAccordionBody");
    const accordionIcon = document.getElementById("transferAccordionIcon");
    if (accordionHead && accordionBody && accordionIcon) {
      accordionHead.addEventListener("click", () => {
        const isVisible = accordionBody.style.display === "block";
        accordionBody.style.display = isVisible ? "none" : "block";
        accordionIcon.style.transform = isVisible ? "rotate(0deg)" : "rotate(180deg)";
      });
    }
  }

  return {
    bindVisualizationAndTooltipEvents,
    updateSankeyCorrectionStatus,
    setSankeyValueMode,
    setSankeySortMode,
    setSankeyGrouping,
    setSankeyDetailMode,
    setSankeyAmountMode: () => setSankeyValueMode(SANKEY_VALUE_MODES.AMOUNT),
    setSankeyPercentMode: () => setSankeyValueMode(SANKEY_VALUE_MODES.PERCENT),
  };
}
