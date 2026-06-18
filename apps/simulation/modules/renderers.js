import { state } from "./state.js";
import { dom } from "./dom.js";
import {
  formatCurrency,
  calculateStrategyComparison,
} from "./calculator.js";
import { utils } from "./utils.js";
import { getStrategyAssumptions } from "./assumptions.js";

const STRATEGY_VIEW = {
  index: {
    key: "index",
    cardKey: "indexGrowth",
    title: "지수/성장",
    color: "#3175b6",
    conclusion: "총자산 성장 기준선",
    caveat: "월 현금흐름은 작게 시작합니다.",
  },
  schd: {
    key: "schd",
    cardKey: "dividendGrowth",
    title: "SCHD 배당성장",
    color: "#1e8b7c",
    conclusion: "성장과 현금흐름의 균형",
    caveat: "지수보다 총자산은 낮을 수 있습니다.",
  },
  coveredCall: {
    key: "coveredCall",
    cardKey: "coveredCallMonthlyIncome",
    title: "커버드콜 월 현금흐름",
    color: "#ea5b2a",
    conclusion: "은퇴 현금흐름 도구",
    caveat: "초보/자산 형성기에는 상승 참여 제한을 비교하세요.",
  },
};

function getSelectedStrategyKey() {
  const selected = state.draft?.dividendSim?.strategyKey || "dividendGrowth";
  if (selected === "indexGrowth") return "index";
  if (selected === "coveredCallMonthlyIncome") return "coveredCall";
  return "schd";
}

function formatSignedCurrency(value) {
  const amount = Number(value || 0);
  if (amount === 0) return "0원";
  return `${amount > 0 ? "+" : "-"}${formatCurrency(Math.abs(amount))}`;
}

function clearNode(node) {
  if (!node) return;
  while (node.firstChild) node.removeChild(node.firstChild);
}

function appendText(parent, tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

function formatWonInputValue(value) {
  if (typeof window !== "undefined" && window.IsfUtils?.formatWonInputValue) {
    return window.IsfUtils.formatWonInputValue(value);
  }
  return String(Math.round(Number(value || 0)));
}

export function renderDividendSimulation() {
  if (!dom.simTable) return;
  const comparison = calculateStrategyComparison(state.draft || {});

  renderKpiCards(comparison);
  renderComparisonCards(comparison);
  renderFinalGuidance(comparison);
  renderDetailSummaryCards(comparison);
  renderComparisonTable(comparison);

  if (dom.simChartSvg) drawSimulationChart(dom.simChartSvg, comparison);

  if (dom.appHeader && typeof dom.appHeader.setFinancialWarning === "function") {
    const final = comparison.final;
    const annualCashFlow = final?.strategies?.coveredCall?.annualCashFlowGross || 0;
    const status = utils.getFinancialIncomeStatus(annualCashFlow);
    const message = status === "normal"
      ? ""
      : `커버드콜 연 현금흐름 세전 ${formatCurrency(annualCashFlow)} 기준 과세 구간을 확인하세요.`;
    dom.appHeader.setFinancialWarning(status === "normal" ? "none" : status, message);
  }
}

export function renderKpiCards(comparison) {
  if (!dom.simKpiGrid || !comparison?.final) return;

  const initialAsset = state.draft?.totalInitialAsset || 0;
  if (dom.dividendWarningBanner) {
    dom.dividendWarningBanner.style.display = initialAsset < 50000000 ? "flex" : "none";
  }

  const selectedKey = getSelectedStrategyKey();
  const final = comparison.final;
  const selected = final.strategies[selectedKey];
  const benchmarkLabel = comparison.selectedBenchmarkLabel || "벤치마크";
  const delta = selected?.benchmarkDelta || 0;

  clearNode(dom.simKpiGrid);

  const cards = [
    {
      label: "최종 예상 자산",
      value: formatCurrency(selected.finalAsset),
      sub: selected.label,
      accent: false,
    },
    {
      label: "예상 월 배당/현금흐름",
      value: formatCurrency(selected.monthlyCashFlowAfterTax),
      sub: "세후 월평균",
      accent: true,
    },
    {
      label: `${benchmarkLabel} 대비 차이`,
      value: formatSignedCurrency(delta),
      sub: delta < 0 ? "총자산 기회비용" : "총자산 초과분",
      accent: delta >= 0,
    },
  ];

  cards.forEach((card) => {
    const wrapper = document.createElement("div");
    wrapper.className = `card kpi-card${card.accent ? " kpi-card--accent" : ""}`;
    appendText(wrapper, "div", "kpi-label", card.label);
    appendText(wrapper, "div", "kpi-value", card.value);
    appendText(wrapper, "div", "kpi-sub-value", card.sub);
    dom.simKpiGrid.appendChild(wrapper);
  });
}

function renderComparisonCards(comparison) {
  if (!dom.strategyComparisonCards || !comparison?.final) return;
  clearNode(dom.strategyComparisonCards);

  Object.values(STRATEGY_VIEW).forEach((view) => {
    const strategy = comparison.final.strategies[view.key];
    const card = document.createElement("article");
    card.className = `comparison-card${getSelectedStrategyKey() === view.key ? " is-active" : ""}`;
    card.dataset.strategy = view.cardKey;

    appendText(card, "p", "comparison-card__eyebrow", view.title);
    appendText(card, "h3", "", view.conclusion);

    const metrics = document.createElement("div");
    metrics.className = "comparison-card__metrics";
    appendText(metrics, "span", "", formatCurrency(strategy.finalAsset));
    appendText(metrics, "span", "", `월 ${formatCurrency(strategy.monthlyCashFlowAfterTax)}`);
    card.appendChild(metrics);

    appendText(card, "p", "comparison-card__caveat", view.caveat);
    dom.strategyComparisonCards.appendChild(card);
  });
}

function renderFinalGuidance(comparison) {
  if (!dom.finalGuidance || !comparison?.final) return;
  const covered = comparison.final.strategies.coveredCall;
  const index = comparison.final.strategies.index;
  const cashFlowAdvantage = covered.monthlyCashFlowAfterTax - index.monthlyCashFlowAfterTax;
  dom.finalGuidance.textContent = `자산 형성기에는 ${comparison.selectedBenchmarkLabel} 같은 지수/성장 전략을 먼저 비교하고, 은퇴 준비나 월 현금흐름이 중요한 시기에는 배당성장 또는 커버드콜 전략을 검토하세요. 커버드콜은 월 ${formatCurrency(cashFlowAdvantage)}가량의 현금흐름 우위가 있을 수 있지만 상승 참여 제한으로 최종 자산은 낮아질 수 있습니다.`;
}

function renderDetailSummaryCards(comparison) {
  if (!dom.detailSummaryCards || !comparison?.rows?.length) return;
  clearNode(dom.detailSummaryCards);
  const rows = comparison.rows;
  const pickIndexes = [0, Math.floor((rows.length - 1) / 2), rows.length - 1];
  [...new Set(pickIndexes)].forEach((idx) => {
    const row = rows[idx];
    const card = document.createElement("div");
    card.className = "detail-summary-card";
    appendText(card, "span", "", `${row.year}년차`);
    appendText(card, "strong", "", formatCurrency(row.finalAssets[getSelectedStrategyKey()]));
    appendText(card, "small", "", `월 현금흐름 ${formatCurrency(row.monthlyCashFlowAfterTax[getSelectedStrategyKey()])}`);
    dom.detailSummaryCards.appendChild(card);
  });
}

function renderComparisonTable(comparison) {
  const table = dom.simTable?.closest("table");
  const thead = table?.querySelector("thead");
  if (!dom.simTable || !thead || !comparison?.rows) return;

  thead.innerHTML = `
    <tr>
      <th>연차</th>
      <th>누적 원금</th>
      <th>${comparison.selectedBenchmarkLabel} 자산</th>
      <th>SCHD 자산</th>
      <th>${comparison.selectedCoveredCallLabel} 자산</th>
      <th>SCHD 월 현금흐름</th>
      <th>${comparison.selectedCoveredCallLabel} 월 현금흐름</th>
      <th>커버드콜 벤치마크 차이</th>
    </tr>
  `;

  dom.simTable.innerHTML = comparison.rows.map((row) => `
    <tr>
      <td>${row.year}년</td>
      <td>${formatCurrency(row.principal)}</td>
      <td>${formatCurrency(row.finalAssets.index)}</td>
      <td>${formatCurrency(row.finalAssets.schd)}</td>
      <td>${formatCurrency(row.finalAssets.coveredCall)}</td>
      <td>${formatCurrency(row.monthlyCashFlowAfterTax.schd)}</td>
      <td>${formatCurrency(row.monthlyCashFlowAfterTax.coveredCall)}</td>
      <td>${formatSignedCurrency(row.benchmarkDelta.coveredCall)}</td>
    </tr>
  `).join("");
}

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
  return el;
}

function drawSimulationChart(svg, comparison) {
  svg.innerHTML = "";
  const rows = comparison?.rows || [];
  if (!rows.length) return;

  const width = 640;
  const height = 280;
  const paddingL = 70;
  const paddingR = 34;
  const paddingT = 38;
  const paddingB = 42;
  const plotW = width - paddingL - paddingR;
  const plotH = height - paddingT - paddingB;
  const denominator = Math.max(rows.length - 1, 1);
  const maxVal = Math.max(...rows.flatMap((row) => Object.values(row.finalAssets)), 1);

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.fontFamily = "var(--font-body)";

  for (let i = 0; i <= 4; i += 1) {
    const y = paddingT + plotH - (plotH * i / 4);
    const value = maxVal * i / 4;
    svg.appendChild(createSvgEl("line", {
      x1: paddingL,
      y1: y,
      x2: width - paddingR,
      y2: y,
      stroke: "var(--line)",
      "stroke-dasharray": "4 4",
    }));
    const label = createSvgEl("text", {
      x: paddingL - 8,
      y: y + 4,
      "text-anchor": "end",
      "font-size": 10,
      fill: "var(--muted)",
    });
    label.textContent = utils.toMan(value).toLocaleString();
    svg.appendChild(label);
  }

  const getPoint = (row, index, key) => {
    const x = paddingL + (index / denominator) * plotW;
    const y = paddingT + plotH - (row.finalAssets[key] / maxVal) * plotH;
    return { x, y };
  };

  Object.values(STRATEGY_VIEW).forEach((view) => {
    const points = rows.map((row, index) => {
      const point = getPoint(row, index, view.key);
      return `${point.x},${point.y}`;
    }).join(" ");
    const line = createSvgEl("polyline", {
      points,
      fill: "none",
      stroke: view.color,
      "stroke-width": getSelectedStrategyKey() === view.key ? 3 : 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      class: "strategy-line",
    });
    svg.appendChild(line);
  });

  rows.forEach((row, index) => {
    if (index % Math.ceil(rows.length / 5) === 0 || index === rows.length - 1) {
      const point = getPoint(row, index, "index");
      const label = createSvgEl("text", {
        x: point.x,
        y: height - 14,
        "text-anchor": "middle",
        "font-size": 10,
        fill: "var(--muted)",
      });
      label.textContent = `${row.year}년`;
      svg.appendChild(label);
    }
  });

  Object.values(STRATEGY_VIEW).forEach((view, index) => {
    const legend = createSvgEl("text", {
      x: width - paddingR,
      y: 20 + index * 18,
      "text-anchor": "end",
      "font-size": 11,
      fill: view.color,
    });
    legend.textContent = `● ${view.title}`;
    svg.appendChild(legend);
  });

  const tooltip = dom.simChartTooltip || document.querySelector(".sim-tooltip");
  const rectWidth = plotW / denominator;
  rows.forEach((row, index) => {
    const x = paddingL + (index / denominator) * plotW;
    const rect = createSvgEl("rect", {
      x: x - rectWidth / 2,
      y: 0,
      width: rectWidth,
      height,
      fill: "transparent",
    });
    rect.style.cursor = "pointer";

    const showTooltip = () => {
      if (!tooltip) return;
      tooltip.hidden = false;
      tooltip.textContent = `${row.year}년차: ${comparison.selectedBenchmarkLabel} ${formatCurrency(row.finalAssets.index)} / SCHD 월 ${formatCurrency(row.monthlyCashFlowAfterTax.schd)} / ${comparison.selectedCoveredCallLabel} 월 ${formatCurrency(row.monthlyCashFlowAfterTax.coveredCall)}`;
      const containerRect = svg.getBoundingClientRect();
      const scale = containerRect.width / width;
      const tooltipWidth = Math.min(280, containerRect.width - 16);
      let left = x * scale - tooltipWidth / 2;
      left = Math.max(8, Math.min(left, containerRect.width - tooltipWidth - 8));
      tooltip.style.width = `${tooltipWidth}px`;
      tooltip.style.left = `${left}px`;
      tooltip.style.top = "12px";
    };
    rect.addEventListener("mouseenter", showTooltip);
    rect.addEventListener("touchstart", (event) => {
      event.preventDefault();
      showTooltip();
    });
    rect.addEventListener("mouseleave", () => {
      if (tooltip) tooltip.hidden = true;
    });
    svg.appendChild(rect);
  });
}

export function initGlobalTooltips() {
  let tooltip = document.getElementById("isf-table-tooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "isf-table-tooltip";
    tooltip.className = "isf-table-tooltip";
    document.body.appendChild(tooltip);
  }

  const show = (e) => {
    const target = e.target.closest("[data-tooltip]");
    if (!target) return;
    tooltip.textContent = target.dataset.tooltip;
    tooltip.style.display = "block";
    const r = target.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    let left = r.left + r.width / 2 - tw / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tw - 8));
    tooltip.style.left = `${left + window.scrollX}px`;
    tooltip.style.top = `${r.bottom + window.scrollY + 8}px`;
  };

  const hide = () => { tooltip.style.display = "none"; };

  document.addEventListener("mouseover", (e) => {
    if (e.target.closest("[data-tooltip]")) show(e);
    else hide();
  });
  document.addEventListener("focusin", show);
  document.addEventListener("focusout", hide);

  document.addEventListener("touchstart", (e) => {
    if (e.target.closest("[data-tooltip]")) show(e);
    else hide();
  }, { passive: true });
}

function syncStrategyControls() {
  const sim = state.draft?.dividendSim || {};
  if (dom.strategyCardGroup) {
    dom.strategyCardGroup.querySelectorAll("[data-strategy-card]").forEach((card) => {
      const active = card.dataset.strategyCard === (sim.strategyKey || "dividendGrowth");
      card.classList.toggle("is-active", active);
      card.setAttribute("aria-checked", active ? "true" : "false");
    });
  }
  if (dom.benchmarkSelect) dom.benchmarkSelect.value = sim.selectedBenchmark || "nasdaq";
  if (dom.coveredCallSelect) dom.coveredCallSelect.value = sim.coveredCallExample || "jepi";
  if (dom.assumptionRangeNote) {
    const assumptions = getStrategyAssumptions({
      selectedBenchmark: sim.selectedBenchmark,
      coveredCallExample: sim.coveredCallExample,
    });
    const active = sim.strategyKey === "indexGrowth"
      ? assumptions.benchmark
      : sim.strategyKey === "coveredCallMonthlyIncome"
        ? assumptions.coveredCall
        : assumptions.dividendGrowth;
    const ranges = active.displayRanges || {};
    dom.assumptionRangeNote.textContent = `${active.label} 예시 범위: 현금흐름 ${ranges.cashFlowYield || ranges.dividendYield}, 성장 ${ranges.dividendGrowth || ranges.distributionGrowth}, 주가 ${ranges.capitalGrowth}. ${assumptions.copy.disclaimer}`;
  }
}

export function renderDraft() {
  if (!state.draft) return;
  try {
    if (dom.totalInitialAsset) {
      dom.totalInitialAsset.value = formatWonInputValue(state.draft.totalInitialAsset || 0);
    }
    if (dom.totalMonthlyInvestCapacity) {
      dom.totalMonthlyInvestCapacity.value = formatWonInputValue(state.draft.totalMonthlyInvestCapacity || 0);
    }

    if (state.draft.dividendSim) {
      if (dom.simDividendYield) dom.simDividendYield.value = state.draft.dividendSim.yield;
      if (dom.simDividendGrowth) dom.simDividendGrowth.value = state.draft.dividendSim.growth;
      if (dom.simCapitalGrowth) dom.simCapitalGrowth.value = state.draft.dividendSim.capitalGrowth;
      if (dom.simHorizonYears) dom.simHorizonYears.value = state.draft.dividendSim.years;
      if (dom.simDrip) dom.simDrip.checked = state.draft.dividendSim.isDrip;

      if (dom.simYearsTabs) {
        Array.from(dom.simYearsTabs.querySelectorAll(".tab-btn")).forEach((tab) => {
          const active = Number(tab.dataset.years) === Number(state.draft.dividendSim.years);
          tab.classList.toggle("is-active", active);
          tab.setAttribute("aria-selected", active ? "true" : "false");
        });
      }

      if (dom.activePresetName) {
        const pName = state.draft.dividendSim.presetName || "";
        dom.activePresetName.textContent = pName;
        dom.activePresetName.style.display = pName ? "inline-block" : "none";
      }
    }

    syncStrategyControls();
    renderDividendSimulation();
  } catch (err) {
    console.error("renderDraft failed:", err);
  }
}
