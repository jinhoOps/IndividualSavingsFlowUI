import { state } from "./state.js";
import { dom } from "./dom.js";
import { 
  formatCurrency, 
  calculateDividendProjection,
  calculateCAGR
} from "./calculator.js";
import { utils } from "./utils.js";

/**
 * Renders the main dividend simulation table and triggers chart drawing.
 */
export function renderDividendSimulation() {
  if (!dom.simTable) return;
  const data = calculateDividendProjection();
  
  renderKpiCards(data);

  const { showAsset, showDividend, showPR, showTR } = state.displayOptions;
  
  // Update table header based on options
  const table = dom.simTable.closest("table");
  if (table) {
    const thead = table.querySelector("thead");
    if (thead) {
      let headerRow1 = `
        <tr>
          <th rowspan="2" style="text-align: center; vertical-align: middle;">연차</th>
          <th rowspan="2" style="text-align: center; vertical-align: middle;">누적 원금</th>
      `;
      let headerRow2 = "<tr>";
      
      if (showAsset) {
        if (showPR) {
          headerRow1 += `<th colspan="2" style="text-align: center;" data-tooltip="배당을 재투자하지 않는 순수 주가 상승 케이스 (Price Return)">자산 (PR)</th>`;
          headerRow2 += `<th>명목</th><th>실질</th>`;
        }
        if (showTR) {
          headerRow1 += `<th colspan="2" style="text-align: center;" data-tooltip="배당을 전액 재투자하여 복리 효과를 극대화한 케이스 (Total Return)">자산 (TR)</th>`;
          headerRow2 += `<th>명목</th><th>실질</th>`;
        }
      }
      
      if (showDividend) {
        if (showPR) {
          headerRow1 += `<th colspan="2" style="text-align: center;" data-tooltip="재투자하지 않을 때 받는 세후 배당금">연 배당 (PR)</th>`;
          headerRow2 += `<th>명목</th><th>실질</th>`;
        }
        if (showTR) {
          headerRow1 += `<th colspan="2" style="text-align: center;" data-tooltip="재투자로 인해 늘어난 수량까지 합산된 세후 배당금">연 배당 (TR)</th>`;
          headerRow2 += `<th>명목</th><th>실질</th>`;
        }
      }
      
      headerRow1 += "</tr>";
      headerRow2 += "</tr>";
      thead.innerHTML = headerRow1 + headerRow2;
    }
  }

  dom.simTable.innerHTML = data.map(d => {
    const statusClass = utils.getFinancialIncomeStatus(d.dividendNominalTR);
    const trClass = statusClass !== 'normal' ? `status--${statusClass}` : '';

    let rowHtml = `
      <tr class="${trClass}">
        <td>${d.year}년</td>
        <td>${formatCurrency(d.principal)}</td>
    `;
    
    if (showAsset) {
      if (showPR) {
        rowHtml += `
          <td class="nominal">${formatCurrency(d.assetNominalPR)}</td>
          <td class="real">${formatCurrency(d.assetRealPR)}</td>
        `;
      }
      if (showTR) {
        rowHtml += `
          <td class="nominal">${formatCurrency(d.assetNominalTR)}</td>
          <td class="real">${formatCurrency(d.assetRealTR)}</td>
        `;
      }
    }
    
    if (showDividend) {
      if (showPR) {
        rowHtml += `
          <td class="nominal">${formatCurrency(d.dividendAfterTaxPR)}</td>
          <td class="real">${formatCurrency(d.dividendAfterTaxRealPR)}</td>
        `;
      }
      if (showTR) {
        rowHtml += `
          <td class="nominal">${formatCurrency(d.dividendAfterTaxTR)}</td>
          <td class="real">${formatCurrency(d.dividendAfterTaxRealTR)}</td>
        `;
      }
    }
    
    rowHtml += "</tr>";
    return rowHtml;
  }).join("");

  if (dom.simChartSvg) drawSimulationChart(dom.simChartSvg, data);

  // 글로벌 금융소득과세 인디케이터 갱신
  if (dom.appHeader && typeof dom.appHeader.setFinancialWarning === "function") {
    let maxStatus = "none";
    let message = "";
    
    // 시뮬레이션 전 기간 중 최초의 주의/경고 연차를 찾음
    const firstCrit = data.find(d => utils.getFinancialIncomeStatus(d.dividendNominalTR) === "crit");
    const firstWarn = data.find(d => utils.getFinancialIncomeStatus(d.dividendNominalTR) === "warn");
    
    if (firstCrit) {
      maxStatus = "crit";
      message = `⚠️ ${firstCrit.year}년차 연배당이 종합과세 한도 초과!\n(세전 ${window.IsfUtils.formatMoney(firstCrit.dividendNominalTR)})`;
    } else if (firstWarn) {
      maxStatus = "warn";
      message = `💡 ${firstWarn.year}년차 연배당이 종합과세 주의 (Safety Margin 도달)\n(세전 ${window.IsfUtils.formatMoney(firstWarn.dividendNominalTR)})`;
    }
    
    dom.appHeader.setFinancialWarning(maxStatus, message);
  }
}

/**
 * Renders KPI cards based on simulation data.
 */
export function renderKpiCards(data) {
  if (!dom.simKpiGrid || !data || data.length === 0) return;
  
  const isDrip = state.draft?.dividendSim?.isDrip !== false;
  const years = state.draft?.dividendSim?.years || 10;
  
  // Show/Hide warning if total operation scale < 100 million won (100,000,000 won)
  const initialAsset = state.draft?.totalInitialAsset || 0;
  const monthlyCapacity = state.draft?.totalMonthlyInvestCapacity || 0;
  const totalOperationScale = initialAsset + (monthlyCapacity * 12 * years);
  
  if (dom.dividendWarningBanner) {
    dom.dividendWarningBanner.style.display = totalOperationScale < 100000000 ? "flex" : "none";
  }

  const last = data[data.length - 1];
  const finalAsset = isDrip ? last.assetNominalTR : last.assetNominalPR;
  const finalDividend = isDrip ? last.dividendAfterTaxTR : last.dividendAfterTaxPR;
  const totalPrincipal = last.principal;
  
  const returnRate = totalPrincipal > 0 
    ? ((finalAsset / totalPrincipal) - 1) * 100 
    : 0;
    
  const cagr = calculateCAGR(finalAsset, totalPrincipal, years);

  dom.simKpiGrid.innerHTML = `
    <div class="card kpi-card">
      <div class="kpi-label">최종 예상 자산 (${isDrip ? '재투자' : '미투자'})</div>
      <div class="kpi-value">${formatCurrency(finalAsset)}</div>
    </div>
    <div class="card kpi-card kpi-card--accent">
      <div class="kpi-label">최종 연 배당금(세후)</div>
      <div class="kpi-value">${formatCurrency(finalDividend)}</div>
    </div>
    <div class="card kpi-card">
      <div class="kpi-label">누적 수익률</div>
      <div class="kpi-value">
        ${returnRate.toFixed(1)}<span class="kpi-unit">%</span>
        <span class="kpi-sub-value" style="font-size: 0.85rem; color: var(--muted); margin-left: 4px; font-weight: normal;">
          (연 ${cagr.toFixed(1)}%)
        </span>
      </div>
    </div>
  `;
}

/**
 * Draws the SVG chart for simulation data.
 */
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
        
        let statusText = "";
        if (statusClass === 'warn') statusText = ' <span style="color: #f59e0b; font-weight: 600;">(과세주의)</span>';
        if (statusClass === 'crit') statusText = ' <span style="color: #dc2626; font-weight: 600;">(과세경고)</span>';

        tooltip.style.display = 'block';
        tooltip.innerHTML = `
          <div style="font-weight: 600; margin-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 2px;">
            ${d.year}년 (${isDrip ? '재투자' : '일반'})${statusText}
          </div>
          <div style="font-size: 0.75rem; opacity: 0.9;">자산: ${formatCurrency(assetNominal)}</div>
          <div style="font-size: 0.75rem; opacity: 0.9;">배당: ${formatCurrency(divNominal)} (세전)</div>
        `;
        const containerRect = svg.getBoundingClientRect();
        const scale = containerRect.width / width;
        const tooltipWidth = 140;
        
        let leftPos = (x * scale) - (tooltipWidth / 2);
        if (leftPos < 8) leftPos = 8;
        if (leftPos + tooltipWidth > containerRect.width - 8) leftPos = containerRect.width - tooltipWidth - 8;

        tooltip.style.left = `${leftPos}px`;
        tooltip.style.transform = 'none';
        
        const targetY = isDrip ? yTR : yPR;
        const actualY = targetY * scale;
        const containerHeight = containerRect.height;

        if (actualY < containerHeight / 2) {
          tooltip.style.top = `${actualY + 20}px`;
          tooltip.style.bottom = 'auto';
        } else {
          tooltip.style.top = 'auto';
          tooltip.style.bottom = `${(containerHeight - actualY) + 20}px`;
        }
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
      
      if (dom.activePresetName) {
        const pName = state.draft.dividendSim.presetName || "";
        dom.activePresetName.textContent = pName;
        dom.activePresetName.style.display = pName ? "inline-block" : "none";
      }
    }

    renderDividendSimulation();
  } catch (err) {
    console.error("renderDraft failed:", err);
  }
}
