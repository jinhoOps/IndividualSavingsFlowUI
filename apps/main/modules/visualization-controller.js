import { SANKEY_VALUE_MODES } from "./constants.js";
import { buildSankeyData } from "./sankey-builder.js";
import { renderSankey } from "./sankey-renderer.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import {
  syncSankeyValueModeUi,
  syncSankeySortModeUi,
  syncSankeyGroupingUi,
} from "./ui-controller.js";

export function createVisualizationController() {
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
    const sankeyTabButtons = [dom.showSankeyBasicBtn, dom.showSankeyDetailBtn].filter(Boolean);
    if (sankeyTabButtons.length === 2) {
      const switchVisualization = (activeButton, detailMode) => {
        sankeyTabButtons.forEach((button) => {
          button.classList.toggle("is-active", button === activeButton);
          button.setAttribute("aria-selected", button === activeButton ? "true" : "false");
        });
        setSankeyDetailMode(detailMode);
      };
      dom.showSankeyBasicBtn.addEventListener("click", () => switchVisualization(dom.showSankeyBasicBtn, "basic"));
      dom.showSankeyDetailBtn.addEventListener("click", () => switchVisualization(dom.showSankeyDetailBtn, "detail"));
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

  }

  return {
    bindVisualizationAndTooltipEvents,
    setSankeyValueMode,
    setSankeySortMode,
    setSankeyGrouping,
    setSankeyDetailMode,
    setSankeyAmountMode: () => setSankeyValueMode(SANKEY_VALUE_MODES.AMOUNT),
    setSankeyPercentMode: () => setSankeyValueMode(SANKEY_VALUE_MODES.PERCENT),
  };
}
