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
    if (dom.totalInitialAsset) {
      dom.totalInitialAsset.value = utils.toMan(state.draft.totalInitialAsset || 0);
    }
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
  
  renderKpiCards(data);

  dom.simTable.innerHTML = data.map(d => {
    const statusClass = utils.getFinancialIncomeStatus(d.dividendNominalTR);
    const trClass = statusClass !== 'normal' ? `status--${statusClass}` : '';
    const badge = statusClass === 'warn' ? '<span class="status-badge status-badge--warn">과세주의</span>' : 
                  statusClass === 'crit' ? '<span class="status-badge status-badge--crit">과세경고</span>' : '';

    return `
      <tr class="${trClass}">
        <td>${d.year}년</td>
        <td>${formatCurrency(d.principal)}</td>
        <td class="nominal">${formatCurrency(d.assetNominalPR)}</td>
        <td class="real">${formatCurrency(d.assetRealPR)}</td>
        <td class="nominal">${formatCurrency(d.assetNominalTR)}</td>
        <td class="real">${formatCurrency(d.assetRealTR)}</td>
        <td class="nominal">${formatCurrency(d.dividendAfterTaxPR)}</td>
        <td class="real">${formatCurrency(d.dividendAfterTaxRealPR)}</td>
        <td class="nominal">${formatCurrency(d.dividendAfterTaxTR)} ${badge}</td>
        <td class="real">${formatCurrency(d.dividendAfterTaxRealTR)}</td>
      </tr>
    `;
  }).join("");

  if (dom.simChartSvg) drawSimulationChart(dom.simChartSvg, data);
}

export function renderKpiCards(data) {
  if (!dom.simKpiGrid || !data || data.length === 0) return;
  
  const isDrip = state.draft?.dividendSim?.isDrip !== false;
  const last = data[data.length - 1];
  const finalAsset = isDrip ? last.assetNominalTR : last.assetNominalPR;
  const finalDividend = isDrip ? last.dividendAfterTaxTR : last.dividendAfterTaxPR;
  const totalPrincipal = last.principal;
  
  const returnRate = totalPrincipal > 0 
    ? ((finalAsset / totalPrincipal) - 1) * 100 
    : 0;

  dom.simKpiGrid.innerHTML = `
    <div class="kpi-card">
      <div class="kpi-label">최종 예상 자산 (${isDrip ? '재투자' : '미투자'})</div>
      <div class="kpi-value">${formatCurrency(finalAsset)}</div>
    </div>
    <div class="kpi-card kpi-card--accent">
      <div class="kpi-label">최종 연 배당금(세후)</div>
      <div class="kpi-value">${formatCurrency(finalDividend)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">누적 수익률</div>
      <div class="kpi-value">${returnRate.toFixed(1)}<span class="kpi-unit">%</span></div>
    </div>
  `;
}

function drawSimulationChart(svg, data) {
  svg.innerHTML = "";
  if (!data.length) return;
  const width = 600; const height = 260; const paddingL = 65; const paddingR = 30; const paddingTB = 40;
  
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "auto";
  svg.style.fontFamily = "var(--font-body)";

  const maxVal = Math.max(...data.map(d => d.assetNominalTR), 1);

  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const yVal = maxVal * (i / gridSteps);
    const yPos = height - paddingTB - (i / gridSteps) * (height - 2 * paddingTB);
    
    const gridLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
    gridLine.setAttribute("x1", paddingL); gridLine.setAttribute("y1", yPos);
    gridLine.setAttribute("x2", width - paddingR); gridLine.setAttribute("y2", yPos);
    gridLine.setAttribute("stroke", "var(--line)"); gridLine.setAttribute("stroke-dasharray", "4");
    svg.appendChild(gridLine);
    
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", paddingL - 8); text.setAttribute("y", yPos + 4);
    text.setAttribute("text-anchor", "end"); 
    text.setAttribute("font-size", "10"); 
    text.setAttribute("fill", "var(--muted)");
    text.textContent = utils.toMan(yVal).toLocaleString();
    svg.appendChild(text);
  }

  const denominator = Math.max(data.length - 1, 1);

  const pointsPolygon = [
    ...data.map((d, i) => {
      const x = paddingL + (i / denominator) * (width - paddingL - paddingR);
      const y = (height - paddingTB) - (d.assetNominalTR / maxVal) * (height - 2 * paddingTB);
      return `${x},${y}`;
    }),
    ...data.map((d, i) => {
      const revIndex = data.length - 1 - i;
      const revData = data[revIndex];
      const x = paddingL + (revIndex / denominator) * (width - paddingL - paddingR);
      const y = (height - paddingTB) - (revData.assetNominalPR / maxVal) * (height - 2 * paddingTB);
      return `${x},${y}`;
    })
  ].join(" ");
  const polyArea = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polyArea.setAttribute("points", pointsPolygon);
  polyArea.setAttribute("fill", "rgba(234, 91, 42, 0.08)");
  svg.appendChild(polyArea);

  const pointsPR = data.map((d, i) => {
    const x = paddingL + (i / denominator) * (width - paddingL - paddingR);
    const y = (height - paddingTB) - (d.assetNominalPR / maxVal) * (height - 2 * paddingTB);
    return `${x},${y}`;
  }).join(" ");

  const polyPR = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyPR.setAttribute("points", pointsPR);
  polyPR.setAttribute("fill", "none"); polyPR.setAttribute("stroke", "#94a3b8"); polyPR.setAttribute("stroke-width", "1.5");
  polyPR.setAttribute("stroke-dasharray", "4 4");
  svg.appendChild(polyPR);

  const pointsTR = data.map((d, i) => {
    const x = paddingL + (i / denominator) * (width - paddingL - paddingR);
    const y = (height - paddingTB) - (d.assetNominalTR / maxVal) * (height - 2 * paddingTB);
    return `${x},${y}`;
  }).join(" ");

  const polyTR = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyTR.setAttribute("points", pointsTR);
  polyTR.setAttribute("fill", "none"); polyTR.setAttribute("stroke", "var(--tone-primary)"); polyTR.setAttribute("stroke-width", "2.5");
  svg.appendChild(polyTR);

  data.forEach((d, i) => {
    const x = paddingL + (i / denominator) * (width - paddingL - paddingR);
    const yTR = (height - paddingTB) - (d.assetNominalTR / maxVal) * (height - 2 * paddingTB);
    const yPR = (height - paddingTB) - (d.assetNominalPR / maxVal) * (height - 2 * paddingTB);

    const statusClassTR = utils.getFinancialIncomeStatus(d.dividendNominalTR);
    const colorTR = statusClassTR === 'crit' ? '#dc2626' : statusClassTR === 'warn' ? '#f59e0b' : 'var(--tone-primary)';
    const statusClassPR = utils.getFinancialIncomeStatus(d.dividendNominalPR);
    const colorPR = statusClassPR === 'crit' ? '#dc2626' : statusClassPR === 'warn' ? '#f59e0b' : '#94a3b8';

    const circleTR = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circleTR.setAttribute("cx", x); circleTR.setAttribute("cy", yTR);
    circleTR.setAttribute("r", statusClassTR !== 'normal' ? "4.5" : "3.5"); 
    circleTR.setAttribute("fill", colorTR);
    circleTR.setAttribute("stroke", "#fff");
    circleTR.setAttribute("stroke-width", "1");
    svg.appendChild(circleTR);

    const circlePR = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circlePR.setAttribute("cx", x); circlePR.setAttribute("cy", yPR);
    circlePR.setAttribute("r", statusClassPR !== 'normal' ? "3.5" : "2.5"); 
    circlePR.setAttribute("fill", colorPR);
    circlePR.setAttribute("stroke", "#fff");
    circlePR.setAttribute("stroke-width", "1");
    svg.appendChild(circlePR);

    if (i % Math.ceil(data.length/5) === 0 || i === data.length - 1) {
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x); text.setAttribute("y", height - 10);
      text.setAttribute("text-anchor", "middle"); 
      text.setAttribute("font-size", "10"); 
      text.setAttribute("fill", "var(--muted)");
      text.textContent = `${d.year}년`;
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

  const rectWidth = (width - paddingL - paddingR) / denominator;
  data.forEach((d, i) => {
    const x = paddingL + (i / denominator) * (width - paddingL - paddingR);
    const yTR = (height - paddingTB) - (d.assetNominalTR / maxVal) * (height - 2 * paddingTB);
    const yPR = (height - paddingTB) - (d.assetNominalPR / maxVal) * (height - 2 * paddingTB);

    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", x - rectWidth / 2);
    rect.setAttribute("y", 0);
    rect.setAttribute("width", rectWidth);
    rect.setAttribute("height", height);
    rect.setAttribute("fill", "transparent");
    rect.style.cursor = "pointer";
    
    const showTooltip = (e) => {
        const isDrip = state.draft?.dividendSim?.isDrip !== false;
        const divNominal = isDrip ? d.dividendNominalTR : d.dividendNominalPR;
        const assetNominal = isDrip ? d.assetNominalTR : d.assetNominalPR;
        const statusClass = window.IsfUtils.getFinancialIncomeStatus(divNominal);
        
        const badge = statusClass === 'warn' ? '<div class="status-badge status-badge--warn" style="margin: 4px 0 0 0; display: block; text-align: center;">과세주의</div>' : 
                      statusClass === 'crit' ? '<div class="status-badge status-badge--crit" style="margin: 4px 0 0 0; display: block; text-align: center;">과세경고</div>' : '';

        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
            ${d.year}년 (${isDrip ? '재투자' : '일반'})
          </div>
          <div style="font-size: 0.75rem; opacity: 0.9;">자산: ${formatCurrency(assetNominal)}</div>
          <div style="font-size: 0.75rem; opacity: 0.9;">배당: ${formatCurrency(divNominal)} (세전)</div>
          ${badge}
        `;
        const containerRect = svg.getBoundingClientRect();
        const scale = containerRect.width / width;
        let actualX = x * scale;
        
        const tooltipWidth = 140;
        const halfWidth = tooltipWidth / 2;
        if (actualX - halfWidth < 0) actualX = halfWidth;
        if (actualX + halfWidth > containerRect.width) actualX = containerRect.width - halfWidth;

        tooltip.style.left = `${actualX}px`;
        
        // Dynamic Y position based on data points
        const targetY = isDrip ? yTR : yPR;
        const actualY = targetY * scale;
        if (actualY < containerRect.height / 2) {
          tooltip.style.top = `${actualY + 20}px`;
          tooltip.style.bottom = 'auto';
        } else {
          tooltip.style.top = 'auto';
          tooltip.style.bottom = `${(height - targetY) * scale + 20}px`;
        }
        tooltip.style.transform = 'translateX(-50%)';
      };
    
    rect.addEventListener("mouseenter", showTooltip);
    rect.addEventListener("touchstart", (e) => { e.preventDefault(); showTooltip(e); });
    rect.addEventListener("mouseleave", () => { tooltip.style.display = 'none'; });
    
    svg.appendChild(rect);
  });

  const legendTR = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendTR.setAttribute("x", width - paddingR); legendTR.setAttribute("y", 20);
  legendTR.setAttribute("text-anchor", "end"); legendTR.setAttribute("font-size", "11"); legendTR.setAttribute("fill", "#ea5b2a");
  legendTR.textContent = "● TR (재투자)";
  svg.appendChild(legendTR);

  const legendPR = document.createElementNS("http://www.w3.org/2000/svg", "text");
  legendPR.setAttribute("x", width - paddingR); legendPR.setAttribute("y", 38);
  legendPR.setAttribute("text-anchor", "end"); legendPR.setAttribute("font-size", "11"); legendPR.setAttribute("fill", "#8a8f98");
  legendPR.textContent = "○ PR (미투자)";
  svg.appendChild(legendPR);
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

