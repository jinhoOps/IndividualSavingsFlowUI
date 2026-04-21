/**
 * Step 2 UI Rendering
 */
import { state, colorCache } from "./state.js";
import { dom } from "./dom.js";
import { ASSET_COLORS } from "./constants.js";
import { 
  formatCurrency, 
  getTotalMonthlyInvestCapacity, 
  getAutoCashAmount, 
  getAllocationWeightTotal, 
  getTotalAccountWeight,
  calculateDividendProjection
} from "./calculator.js";

/**
 * Renders the entire draft UI
 */
export function renderDraft() {
  if (!state.draft) return;
  try {
    const utils = window.IsfUtils || {};
    if (dom.portfolioName) dom.portfolioName.value = state.draft.name || "";
    if (dom.portfolioNotes) dom.portfolioNotes.value = state.draft.notes || "";
    if (dom.totalMonthlyInvestCapacity) {
      dom.totalMonthlyInvestCapacity.value = utils.toMan ? utils.toMan(state.draft.totalMonthlyInvestCapacity || 0) : 0;
    }
    
    if (state.draft.dividendSim) {
      if (dom.simDividendYield) dom.simDividendYield.value = state.draft.dividendSim.yield;
      if (dom.simDividendGrowth) dom.simDividendGrowth.value = state.draft.dividendSim.growth;
      if (dom.simCapitalGrowth) dom.simCapitalGrowth.value = state.draft.dividendSim.capitalGrowth;
      if (dom.simHorizonYears) dom.simHorizonYears.value = state.draft.dividendSim.years;
      if (dom.simDrip) dom.simDrip.checked = state.draft.dividendSim.isDrip;
    }

    renderChartTabs(); 
    renderAccountList(); 
    renderAccountSummary(); 
    renderCharts();
  } catch (err) {
    console.error("renderDraft failed:", err);
  }
}

export function renderChartTabs() {
  const tab = state.activeChartTab;
  if (dom.chartTabSummary) dom.chartTabSummary.classList.toggle("is-active", tab === "summary"); 
  if (dom.chartTabAccount) dom.chartTabAccount.classList.toggle("is-active", tab === "account");
  if (dom.chartTabFlow) dom.chartTabFlow.classList.toggle("is-active", tab === "flow");

  if (dom.summaryChartPane) dom.summaryChartPane.hidden = tab !== "summary"; 
  if (dom.accountChartPane) dom.accountChartPane.hidden = tab !== "account";
  if (dom.flowChartPane) dom.flowChartPane.hidden = tab !== "flow";
}

export function renderAccountList() {
  if (!dom.accountList) return;
  const utils = window.IsfUtils || { escapeHtml: s => s, toMan: n => n };
  dom.accountList.innerHTML = (state.draft.accounts || []).map(a => {
    const isActive = String(a.id) === String(state.activeAccountId);
    const totalAlWeight = getAllocationWeightTotal(a);
    return `
    <div class="account-card ${isActive ? "is-active" : ""}" data-account-id="${a.id}">
      <div class="account-row-head" data-select-account-id="${a.id}">
        <div class="account-info">
          <input type="text" data-field="accountName" value="${utils.escapeHtml(a.name)}" placeholder="계좌명" onclick="event.stopPropagation()"/>
          <div class="account-meta">
            <input type="number" data-field="accountWeight" value="${a.accountWeight}" step="0.1" onclick="event.stopPropagation()"/>
            <span class="unit">%</span>
          </div>
        </div>
        <div class="account-actions">
          <button class="btn btn-ghost btn-sm" data-remove-account-id="${a.id}" onclick="event.stopPropagation()">삭제</button>
          <span class="chevron">${isActive ? "▲" : "▼"}</span>
        </div>
      </div>
      
      ${isActive ? `
      <div class="allocation-editor">
        <div class="allocation-table-head">
          <span></span>
          <span>종목명</span>
          <span>목표(%)</span>
          <span>현재액(만)</span>
          <span></span>
        </div>
        <div class="allocation-list">
          ${(a.allocations || []).map(al => `
            <div class="allocation-row ${al.isImportant ? "is-important" : ""}" data-allocation-id="${al.id}">
              <button class="btn-toggle-star ${al.isImportant ? "is-active" : ""}" data-toggle-important="${al.id}">${al.isImportant ? "★" : "☆"}</button>
              <input type="text" data-field="label" value="${utils.escapeHtml(al.label)}" placeholder="종목명" />
              <input type="number" data-field="targetWeight" value="${al.targetWeight}" step="0.1" />
              <input type="number" data-field="actualAmount" value="${utils.toMan(al.actualAmount)}" step="1" inputmode="decimal" />
              <button class="btn btn-ghost btn-sm" data-remove-allocation-id="${al.id}">삭제</button>
            </div>
          `).join("")}
        </div>
        <div class="allocation-footer">
          <span class="total ${totalAlWeight > 100.01 ? "is-error" : ""}">합계: ${totalAlWeight.toFixed(1)}%</span>
          <button class="btn btn-ghost btn-sm" data-add-allocation-id="${a.id}">+ 종목 추가</button>
        </div>
      </div>
      ` : ""}
    </div>
  `}).join("");
}

export function renderAccountSummary() { 
  if (!dom.accountSummary) return;
  const total = getTotalAccountWeight(); 
  dom.accountSummary.textContent = `전체 계좌 비중 합계: ${total.toFixed(2)}% / 자동 현금: ${formatCurrency(getAutoCashAmount())}`; 
  dom.accountSummary.classList.toggle("is-error", total > 100.01); 
}

export function renderCharts() { 
  renderSummaryChart(); 
  renderAccountChartCards(); 
  renderAmountBreakdown(); 
  renderSankey();
  renderDividendSimulation(); 
}

export function renderSummaryChart() { 
  const slices = buildSummarySlices(); 
  renderDonutChart(dom.summaryDonut, slices, { centerValue: formatCurrency(getTotalMonthlyInvestCapacity()) }); 
}

export function renderAccountChartCards() { 
  if (!dom.accountChartCards) return;
  dom.accountChartCards.innerHTML = (state.draft.accounts || []).map(a => `<div class="account-chart-card ${a.id === state.activeAccountId ? "is-active" : ""}"><p>${a.name} (${a.accountWeight}%)</p><button class="btn btn-ghost btn-sm" data-select-account-id="${a.id}">선택</button></div>`).join(""); 
}

export function renderAmountBreakdown() { 
  if (!dom.amountBreakdown) return;
  const slices = buildSummarySlices(); 
  dom.amountBreakdown.innerHTML = `<ul class="amount-breakdown-list">` + slices.map(s => `
    <li class="amount-breakdown-row ${s.isImportant ? "is-important" : ""}">
      <span class="amount-breakdown-label">${s.label}</span>
      <span class="amount-breakdown-percent">${((s.value / (getTotalMonthlyInvestCapacity() || 1)) * 100).toFixed(1)}%</span>
      <strong class="amount-breakdown-value">${formatCurrency(s.value)}</strong>
    </li>
  `).join("") + `</ul>`; 
}

export function buildSummarySlices() {
  const total = getTotalMonthlyInvestCapacity(); if (total <= 0) return [];
  const bucket = new Map();
  const utils = window.IsfUtils || { sanitizeWeight: n => n };
  (state.draft.accounts || []).forEach(acc => {
    const budget = Math.round(total * utils.sanitizeWeight(acc.accountWeight) / 100);
    (acc.allocations || []).forEach(al => {
      const amt = Math.round(budget * utils.sanitizeWeight(al.targetWeight) / 100); if (amt <= 0) return;
      const key = al.key || al.label; const prev = bucket.get(key);
      if (prev) { prev.value += amt; if (al.isImportant) prev.isImportant = true; }
      else bucket.set(key, { label: al.label, value: amt, color: getAssetColor(key), isImportant: al.isImportant });
    });
  });
  const slices = Array.from(bucket.values());
  const cash = getAutoCashAmount(); if (cash > 0) slices.push({ label: "자동 현금", value: cash, color: "#8a8f98" });
  return slices.sort((a, b) => b.value - a.value);
}

export function getAssetColor(key) { 
  if (!colorCache.has(key)) colorCache.set(key, ASSET_COLORS[colorCache.size % ASSET_COLORS.length]); 
  return colorCache.get(key); 
}

export function renderDonutChart(svg, slices, cfg) {
  if (!svg) return; svg.innerHTML = ""; const total = slices.reduce((s, al) => s + al.value, 0); if (total <= 0) return;
  const r = 80; const sw = 30; const circum = 2 * Math.PI * r; let offset = 0;
  const cx = 200; const cy = 150;

  slices.forEach(s => {
    const ratio = s.value / total; const dash = circum * ratio;
    const arc = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    arc.setAttribute("cx", cx); arc.setAttribute("cy", cy); arc.setAttribute("r", r);
    arc.setAttribute("fill", "none"); arc.setAttribute("stroke", s.color); arc.setAttribute("stroke-width", sw);
    arc.setAttribute("stroke-dasharray", `${dash} ${circum - dash}`); arc.setAttribute("stroke-dashoffset", -offset);
    arc.setAttribute("transform", `rotate(-90 ${cx} ${cy})`); svg.appendChild(arc);
    offset += dash;
  });
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", cx); text.setAttribute("y", cy + 5); text.setAttribute("text-anchor", "middle"); text.textContent = cfg.centerValue;
  svg.appendChild(text);
}

export function renderSankey() {
  if (!dom.flowSankey) return;
  const svg = dom.flowSankey; svg.innerHTML = "";
  const total = getTotalMonthlyInvestCapacity(); if (total <= 0) return;

  const width = 600; const height = 400; const nodeW = 100; const margin = 50;
  const col1 = margin; const col2 = width / 2 - nodeW / 2; const col3 = width - margin - nodeW;

  // 1. Source Node (Total Capacity)
  drawSankeyNode(svg, col1, height/2 - 20, nodeW, 40, "월 투자 여력", formatCurrency(total), "#ea5b2a");

  // 2. Account Nodes
  let accY = margin;
  state.draft.accounts.forEach(acc => {
    const weight = (parseFloat(acc.accountWeight) || 0);
    const amt = Math.round(total * weight / 100);
    const nodeH = Math.max(30, (amt / total) * (height - 2*margin));
    drawSankeyNode(svg, col2, accY, nodeW, nodeH, acc.name, formatCurrency(amt), "#4dabf7");
    
    // Link from Source to Account
    drawSankeyLink(svg, col1 + nodeW, height/2, col2, accY + nodeH/2, nodeH * 0.8, "rgba(77, 171, 247, 0.2)");
    
    // 3. Product Nodes (Nested)
    let prodY = accY;
    acc.allocations.forEach(al => {
      const pWeight = (parseFloat(al.targetWeight) || 0);
      const pAmt = Math.round(amt * pWeight / 100);
      const pNodeH = Math.max(20, (pAmt / total) * (height - 2*margin));
      drawSankeyNode(svg, col3, prodY, nodeW, pNodeH, al.label, formatCurrency(pAmt), getAssetColor(al.label));
      
      // Link from Account to Product
      drawSankeyLink(svg, col2 + nodeW, accY + nodeH/2, col3, prodY + pNodeH/2, pNodeH * 0.8, "rgba(0,0,0,0.05)");
      prodY += pNodeH + 10;
    });

    accY += nodeH + 30;
  });
}

function drawSankeyNode(svg, x, y, w, h, label, val, color) {
  const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect.setAttribute("x", x); rect.setAttribute("y", y); rect.setAttribute("width", w); rect.setAttribute("height", h);
  rect.setAttribute("fill", color); rect.setAttribute("rx", 4); rect.setAttribute("opacity", 0.8);
  svg.appendChild(rect);

  const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
  txt.setAttribute("x", x + w/2); txt.setAttribute("y", y + h/2 + 4); txt.setAttribute("text-anchor", "middle");
  txt.setAttribute("font-size", "10"); txt.setAttribute("fill", "#fff"); txt.textContent = label;
  svg.appendChild(txt);
}

function drawSankeyLink(svg, x1, y1, x2, y2, thickness, color) {
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const cp1x = x1 + (x2 - x1) / 2;
  const d = `M ${x1} ${y1} C ${cp1x} ${y1}, ${cp1x} ${y2}, ${x2} ${y2}`;
  path.setAttribute("d", d); path.setAttribute("stroke", color); path.setAttribute("stroke-width", thickness);
  path.setAttribute("fill", "none"); svg.appendChild(path);
}

export function renderDividendSimulation() {
  if (!dom.simTable) return;
  const data = calculateDividendProjection();
  
  dom.simTable.innerHTML = data.map(d => `
    <tr>
      <td>${d.year}년</td>
      <td>${formatCurrency(d.principal)}</td>
      <td class="nominal">${formatCurrency(d.assetNominal)}</td>
      <td class="real">${formatCurrency(d.assetReal)}</td>
      <td class="nominal">${formatCurrency(d.dividendAfterTax)}</td>
      <td class="real">${formatCurrency(d.dividendAfterTaxReal)}</td>
      <td class="nominal">${formatCurrency(d.monthlyDivNominal)}</td>
      <td class="real">${formatCurrency(d.monthlyDivReal)}</td>
    </tr>
  `).join("");

  if (dom.simChartSvg) drawSimulationChart(dom.simChartSvg, data);
}

function drawSimulationChart(svg, data) {
  svg.innerHTML = "";
  if (!data.length) return;
  const width = 600; const height = 220; const padding = 40;
  const maxVal = Math.max(...data.map(d => d.dividendNominal));
  if (maxVal <= 0) return;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const y = (height - padding) - (d.dividendNominal / maxVal) * (height - 2 * padding);
    return `${x},${y}`;
  }).join(" ");

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("points", points);
  polyline.setAttribute("fill", "none"); polyline.setAttribute("stroke", "#ea5b2a"); polyline.setAttribute("stroke-width", "3");
  svg.appendChild(polyline);

  data.forEach((d, i) => {
    if (i % Math.ceil(data.length/5) !== 0 && i !== data.length - 1) return;
    const x = padding + (i / (data.length - 1)) * (width - 2 * padding);
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", x); text.setAttribute("y", height - 10);
    text.setAttribute("text-anchor", "middle"); text.setAttribute("font-size", "10"); text.textContent = `${d.year}년`;
    svg.appendChild(text);
  });
}
