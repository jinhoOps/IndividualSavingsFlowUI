import { state } from "./state.js";
import { dom } from "./dom.js";
import { 
  formatCurrency, 
  getTotalMonthlyInvestCapacity, 
  calculateDividendProjection
} from "./calculator.js";

import { utils } from "./utils.js";

export function renderDraft() {
  if (!state.draft) return;
  try {
    if (dom.totalMonthlyInvestCapacity) {
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
  const width = 600; const height = 250; const padding = 45;
  
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "auto";

  const maxVal = Math.max(...data.map(d => d.assetNominalTR), 1);

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = maxVal * (i / gridSteps);
    const yPos = height - padding - (i / gridSteps) * (height - 2 * padding);
    
    const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    gridLine.setAttribute("x1", padding); gridLine.setAttribute("y1", yPos);
    gridLine.setAttribute("x2", width - padding); gridLine.setAttribute("y2", yPos);
    gridLine.setAttribute("stroke", "#e5e7eb"); gridLine.setAttribute("stroke-dasharray", "4");
    svg.appendChild(gridLine);
    
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", padding - 5); text.setAttribute("y", yPos + 3);
    text.setAttribute("text-anchor", "end"); text.setAttribute("font-size", "10"); text.setAttribute("fill", "#6b7280");
    text.textContent = utils.toMan(yVal).toLocaleString();
    svg.appendChild(text);
  }

  const pointsPolygon = [
    ...data.map((d, i) => {
      const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
      const y = (height - padding) - (d.assetNominalTR / maxVal) * (height - 2 * padding);
      return `${x},${y}`;
    }),
    ...data.map((d, i) => {
      const revIndex = data.length - 1 - i;
      const revData = data[revIndex];
      const x = padding + (revIndex / (data.length - 1)) * (width - 2 * padding);
      const y = (height - padding) - (revData.assetNominalPR / maxVal) * (height - 2 * padding);
      return `${x},${y}`;
    })
  ].join(" ");
  const polyArea = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polyArea.setAttribute("points", pointsPolygon);
  polyArea.setAttribute("fill", "rgba(234, 91, 42, 0.1)");
  svg.appendChild(polyArea);

  const pointsPR = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = (height - padding) - (d.assetNominalPR / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  const polyPR = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyPR.setAttribute("points", pointsPR);
  polyPR.setAttribute("fill", "none"); polyPR.setAttribute("stroke", "#8a8f98"); polyPR.setAttribute("stroke-width", "2");
  polyPR.setAttribute("stroke-dasharray", "4 4");
  svg.appendChild(polyPR);

  const pointsTR = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = (height - padding) - (d.assetNominalTR / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  const polyTR = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyTR.setAttribute("points", pointsTR);
  polyTR.setAttribute("fill", "none"); polyTR.setAttribute("stroke", "#ea5b2a"); polyTR.setAttribute("stroke-width", "3");
  svg.appendChild(polyTR);

  data.forEach((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const yTR = (height - padding) - (d.assetNominalTR / maxVal) * (height - 2 * padding);
    const yPR = (height - padding) - (d.assetNominalPR / maxVal) * (height - 2 * padding);

    const circleTR = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circleTR.setAttribute("cx", x); circleTR.setAttribute("cy", yTR);
    circleTR.setAttribute("r", "3"); circleTR.setAttribute("fill", "#ea5b2a");
    svg.appendChild(circleTR);

    const circlePR = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circlePR.setAttribute("cx", x); circlePR.setAttribute("cy", yPR);
    circlePR.setAttribute("r", "2"); circlePR.setAttribute("fill", "#8a8f98");
    svg.appendChild(circlePR);

    if (i % Math.ceil(data.length/5) === 0 || i === data.length - 1) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x); text.setAttribute("y", height - 10);
      text.setAttribute("text-anchor", "middle"); text.setAttribute("font-size", "10"); text.textContent = `${d.year}년`;
      svg.appendChild(text);
    }
  });

  let tooltip = document.querySelector('.chart-tooltip');
  if (!tooltip) {
    tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    if(svg.parentNode) {
      svg.parentNode.style.position = 'relative';
      svg.parentNode.appendChild(tooltip);
    }
  }
  tooltip.style.display = 'none';

  const rectWidth = (width - 2 * padding) / Math.max((data.length - 1), 1);
  data.forEach((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x - rectWidth / 2);
    rect.setAttribute("y", 0);
    rect.setAttribute("width", rectWidth);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", "transparent");
    rect.style.cursor = "pointer";
    
    const showTooltip = (e) => {
        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 6px; border-bottom: 1px solid #eee; padding-bottom: 4px;">${d.year}년</div>
          <div style="font-size: 0.85em; color: #8a8f98; margin-bottom: 2px;">재투자 안함 (PR)</div>
          <div style="margin-bottom: 2px;">총 자산: ${utils.toMan(d.assetNominalPR).toLocaleString()} 만원</div>
          <div style="margin-bottom: 6px;">연 배당: ${utils.toMan(d.dividendNominalPR).toLocaleString()} 만원</div>
          <div style="font-size: 0.85em; color: #ea5b2a; margin-bottom: 2px;">자동 재투자 (TR)</div>
          <div style="margin-bottom: 2px;">총 자산: ${utils.toMan(d.assetNominalTR).toLocaleString()} 만원</div>
          <div>연 배당: ${utils.toMan(d.dividendNominalTR).toLocaleString()} 만원</div>
        `;
        const containerRect = svg.getBoundingClientRect();
        const scale = containerRect.width / width;
        let actualX = x * scale;
        
        const tooltipWidth = 140; // approximate width
        const halfWidth = tooltipWidth / 2;
        if (actualX - halfWidth < 0) actualX = halfWidth;
        if (actualX + halfWidth > containerRect.width) actualX = containerRect.width - halfWidth;
        
        tooltip.style.left = `${actualX}px`;
        tooltip.style.top = '10%';
        tooltip.style.transform = 'translateX(-50%)';
      };
    
    rect.addEventListener("mouseenter", showTooltip);
    rect.addEventListener("touchstart", (e) => { e.preventDefault(); showTooltip(e); });
    rect.addEventListener("mouseleave", () => { tooltip.style.display = 'none'; });
    
    svg.appendChild(rect);
  });

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

