/**
 * Individual Savings Flow (ISF) - Step 2: 배당 시뮬레이션 (Dividend Simulation)
 * v0.7.0
 * 
 * 파일 역할: 결과 데이터 렌더링 및 UI 업데이트 (Renderers)
 */
import { state } from "./state.js";
import { dom } from "./dom.js";
import { 
  formatCurrency, 
  getTotalMonthlyInvestCapacity, 
  calculateDividendProjection
} from "./calculator.js";

import { utils } from "./utils.js";

/**
 * Renders the entire draft UI
 */
export function renderDraft() {
  if (!state.draft) return;
  try {
    if (dom.totalMonthlyInvestCapacity) {
      // UI 표시 시 단위 변환만 수행 (절삭 방지)
      dom.totalMonthlyInvestCapacity.value = utils.toMan(state.draft.totalMonthlyInvestCapacity || 0);
    }
    
    if (state.draft.dividendSim) {
      if (dom.simDividendYield) dom.simDividendYield.value = state.draft.dividendSim.yield;
      if (dom.simDividendGrowth) dom.simDividendGrowth.value = state.draft.dividendSim.growth;
      if (dom.simCapitalGrowth) dom.simCapitalGrowth.value = state.draft.dividendSim.capitalGrowth;
      if (dom.simHorizonYears) dom.simHorizonYears.value = state.draft.dividendSim.years;
      if (dom.simDrip) dom.simDrip.checked = state.draft.dividendSim.isDrip;
    }

    renderCharts();
  } catch (err) {
    console.error("renderDraft failed:", err);
  }
}

export function renderCharts() { 
  renderDividendSimulation(); 
}

export function renderDividendSimulation() {
  if (!dom.simTable) return;
  const data = calculateDividendProjection();
  
  dom.simTable.innerHTML = data.map(d => `
    <tr>
      <td>${d.year}년</td>
      <td>${formatCurrency(d.principal)}</td>
      <td class="nominal">${formatCurrency(d.assetNominalPR)}</td>
      <td class="real">${formatCurrency(d.assetRealPR)}</td>
      <td class="nominal">${formatCurrency(d.assetNominalTR)}</td>
      <td class="real">${formatCurrency(d.assetRealTR)}</td>
      <td class="nominal">${formatCurrency(d.dividendAfterTaxPR)}</td>
      <td class="real">${formatCurrency(d.dividendAfterTaxRealPR)}</td>
      <td class="nominal">${formatCurrency(d.dividendAfterTaxTR)}</td>
      <td class="real">${formatCurrency(d.dividendAfterTaxRealTR)}</td>
    </tr>
  `).join("");

  if (dom.simChartSvg) drawSimulationChart(dom.simChartSvg, data);
}

function drawSimulationChart(svg, data) {
  svg.innerHTML = "";
  if (!data.length) return;
  const width = 600; const height = 220; const padding = 40;
  // TR 배당금을 기준으로 스케일 설정
  const maxVal = Math.max(...data.map(d => d.dividendNominalTR), 1);

  // 1. PR 선 (미투자 - 회색 점선)
  const pointsPR = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = (height - padding) - (d.dividendNominalPR / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  const polyPR = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyPR.setAttribute("points", pointsPR);
  polyPR.setAttribute("fill", "none"); polyPR.setAttribute("stroke", "#8a8f98"); polyPR.setAttribute("stroke-width", "2");
  polyPR.setAttribute("stroke-dasharray", "4 4");
  svg.appendChild(polyPR);

  // 2. TR 선 (재투자 - 주황색 실선)
  const pointsTR = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = (height - padding) - (d.dividendNominalTR / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  const polyTR = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyTR.setAttribute("points", pointsTR);
  polyTR.setAttribute("fill", "none"); polyTR.setAttribute("stroke", "#ea5b2a"); polyTR.setAttribute("stroke-width", "3");
  svg.appendChild(polyTR);

  // X축 라벨
  data.forEach((d, i) => {
    if (i % Math.ceil(data.length/5) !== 0 && i !== data.length - 1) return;
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x); text.setAttribute("y", height - 10);
    text.setAttribute("text-anchor", "middle"); text.setAttribute("font-size", "10"); text.textContent = `${d.year}년`;
    svg.appendChild(text);
  });

  // 범례 (Legend)
  const legendTR = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendTR.setAttribute("x", width - padding); legendTR.setAttribute("y", 20);
  legendTR.setAttribute("text-anchor", "end"); legendTR.setAttribute("font-size", "11"); legendTR.setAttribute("fill", "#ea5b2a");
  legendTR.textContent = "● TR (재투자)";
  svg.appendChild(legendTR);

  const legendPR = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendPR.setAttribute("x", width - padding); legendPR.setAttribute("y", 38);
  legendPR.setAttribute("text-anchor", "end"); legendPR.setAttribute("font-size", "11"); legendPR.setAttribute("fill", "#8a8f98");
  legendPR.textContent = "○ PR (미투자)";
  svg.appendChild(legendPR);
}
