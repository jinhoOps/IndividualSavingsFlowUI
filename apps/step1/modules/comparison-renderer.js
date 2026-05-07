import { formatCurrency, formatSignedCurrency, formatPercent } from "./formatters.js";

/**
 * Renders a grouped bar chart for expense comparison.
 * @param {SVGElement} svg - SVG element to render into
 * @param {Array} comparisonData - Array of { name, prev, curr, diff, ratio }
 */
export function renderComparisonChart(svg, comparisonData) {
  if (!svg || !Array.isArray(comparisonData)) return;

  const width = svg.clientWidth || 600;
  const itemHeight = 40;
  const padding = 20;
  const labelWidth = 120;
  const chartWidth = width - labelWidth - padding * 2;
  const height = comparisonData.length * itemHeight + padding * 2;

  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.height = `${height}px`;
  svg.innerHTML = "";

  if (comparisonData.length === 0) return;

  const maxVal = Math.max(...comparisonData.map(d => Math.max(d.prev, d.curr)), 1);

  comparisonData.forEach((d, i) => {
    const y = padding + i * itemHeight;
    const prevW = (d.prev / maxVal) * chartWidth;
    const currW = (d.curr / maxVal) * chartWidth;

    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Label
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", padding);
    text.setAttribute("y", y + 20);
    text.setAttribute("class", "chart-label");
    text.textContent = d.name;
    group.appendChild(text);

    // Prev Bar
    const rectPrev = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectPrev.setAttribute("x", padding + labelWidth);
    rectPrev.setAttribute("y", y + 5);
    rectPrev.setAttribute("width", prevW);
    rectPrev.setAttribute("height", 12);
    rectPrev.setAttribute("class", "bar-prev");
    const titlePrev = document.createElementNS("http://www.w3.org/2000/svg", "title");
    titlePrev.textContent = `이전: ${formatCurrency(d.prev)}`;
    rectPrev.appendChild(titlePrev);
    group.appendChild(rectPrev);

    // Curr Bar
    const rectCurr = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rectCurr.setAttribute("x", padding + labelWidth);
    rectCurr.setAttribute("y", y + 20);
    rectCurr.setAttribute("width", currW);
    rectCurr.setAttribute("height", 12);
    rectCurr.setAttribute("class", "bar-curr");
    const titleCurr = document.createElementNS("http://www.w3.org/2000/svg", "title");
    titleCurr.textContent = `현재: ${formatCurrency(d.curr)}`;
    rectCurr.appendChild(titleCurr);
    group.appendChild(rectCurr);

    // Value Diff Label
    const valText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    valText.setAttribute("x", width - padding);
    valText.setAttribute("y", y + 20);
    valText.setAttribute("text-anchor", "end");
    valText.setAttribute("class", "chart-value");
    valText.textContent = `${formatSignedCurrency(d.diff)} (${formatPercent(d.ratio)})`;
    group.appendChild(valText);

    svg.appendChild(group);
  });
}

/**
 * Renders the comparison summary card.
 * @param {HTMLElement} container - Container element
 * @param {Object} summary - { prev, curr, diff, ratio }
 */
export function renderComparisonSummary(container, summary) {
  if (!container || !summary) return;

  const isPositive = summary.diff > 0;
  const isNegative = summary.diff < 0;

  container.innerHTML = `
    <span class="label">총 지출 변화</span>
    <span class="main-val">${formatCurrency(summary.curr)}</span>
    <span class="diff-val ${isPositive ? 'is-positive' : (isNegative ? 'is-negative' : '')}">
      이전 대비 ${formatSignedCurrency(summary.diff)} (${formatPercent(summary.ratio)})
    </span>
  `;
}
