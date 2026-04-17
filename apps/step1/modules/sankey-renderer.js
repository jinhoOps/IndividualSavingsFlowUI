import {
  SANKEY_VALUE_MODES,
  SANKEY_SORT_MODES,
  SANKEY_ZOOM_MIN,
  SANKEY_ZOOM_MAX,
  SANKEY_ZOOM_STEP,
  SANKEY_MOBILE_BASE_ZOOM,
  SANKEY_MOBILE_HEIGHT_RATIO,
  SANKEY_MOBILE_WIDTH_SCALE,
  SANKEY_MOBILE_MIN_COLUMN_STEP,
  SANKEY_MOBILE_MIN_COLUMN_STEP_WITH_INFLOW,
  TONE_COLORS,
  MOBILE_LAYOUT_QUERY
} from "./constants.js";
import { dom } from "./dom.js";
import { state } from "./state.js";
import { formatCurrency, formatSignedCurrency, formatSankeyDisplayValue } from "./formatters.js";

const sankeyTextMeasureCanvas = document.createElement("canvas");
const sankeyTextMeasureContext = sankeyTextMeasureCanvas.getContext("2d");

export function getEffectiveSankeyZoom(isMobileViewport = window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
  const base = Number(state.sankeyZoom) || 1;
  const clamped = Math.min(SANKEY_ZOOM_MAX, Math.max(SANKEY_ZOOM_MIN, base));
  return isMobileViewport ? clamped * SANKEY_MOBILE_BASE_ZOOM : clamped;
}

export function buildBandPath(x0, y0, y1, x1, y2, y3) {
  const xmid = (x0 + x1) / 2;
  const y0mid = (y0 + y2) / 2;
  const y1mid = (y1 + y3) / 2;
  return `M ${x0} ${y0} C ${xmid} ${y0} ${xmid} ${y2} ${x1} ${y2} L ${x1} ${y3} C ${xmid} ${y3} ${xmid} ${y1} ${x0} ${y1} Z`;
}

export function createSvgElement(tagName, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tagName);
  if (attrs) {
    Object.entries(attrs).forEach(([name, value]) => el.setAttribute(name, value));
  }
  return el;
}

export function measureSankeyTextWidth(text, fontSizePx = 12, fontWeight = 400) {
  if (!sankeyTextMeasureContext) return text.length * 8;
  sankeyTextMeasureContext.font = `${fontWeight} ${fontSizePx}px "Pretendard Variable", "Pretendard", -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif`;
  return Math.ceil(sankeyTextMeasureContext.measureText(text).width);
}

export function showSankeyTooltip(event, text) {
  if (!(event.target instanceof SVGPathElement) || !event.target.classList.contains("sankey-path")) {
    hideSankeyTooltip();
    return;
  }

  const wrapRect = dom.sankeyWrap.getBoundingClientRect();
  if (wrapRect.width <= 0 || wrapRect.height <= 0) {
    hideSankeyTooltip();
    return;
  }
  const tooltip = dom.sankeyTooltip;

  tooltip.hidden = false;
  tooltip.textContent = text;

  const maxX = Math.max(20, wrapRect.width - 250);
  const maxY = Math.max(20, wrapRect.height - 70);
  const x = Math.min(maxX, event.clientX - wrapRect.left + 12);
  const y = Math.min(maxY, event.clientY - wrapRect.top + 12);

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

export function hideSankeyTooltip() {
  if (dom.sankeyTooltip) {
    dom.sankeyTooltip.hidden = true;
  }
}

function normalizeSankeyValueMode(mode) {
  return Object.values(SANKEY_VALUE_MODES).includes(mode) ? mode : SANKEY_VALUE_MODES.AMOUNT;
}

function normalizeSankeySortMode(mode) {
  return Object.values(SANKEY_SORT_MODES).includes(mode) ? mode : SANKEY_SORT_MODES.GROUP;
}

export function renderSankey(snapshot, buildSankeyData) {
  if (!dom.sankeySvg || !dom.sankeyWrap) return;
  hideSankeyTooltip();

  const data = buildSankeyData(snapshot);
  dom.sankeySvg.innerHTML = "";
  dom.sankeyLegend.innerHTML = "";

  if (!data || !data.links.length) {
    dom.sankeyEmpty.hidden = false;
    if (dom.sankeyMeta) dom.sankeyMeta.textContent = "수입/배분 데이터가 없습니다.";
    return;
  }

  dom.sankeyEmpty.hidden = true;
  const valueMode = normalizeSankeyValueMode(state.sankeyValueMode);
  const sortMode = normalizeSankeySortMode(state.sankeySortMode);
  const sortModeTextMap = {
    [SANKEY_SORT_MODES.GROUP]: "정렬 그룹묶음",
    [SANKEY_SORT_MODES.AMOUNT_DESC]: "정렬 금액큰순",
    [SANKEY_SORT_MODES.AMOUNT_ASC]: "정렬 금액작은순",
    [SANKEY_SORT_MODES.NAME_ASC]: "정렬 이름순",
  };

  if (dom.sankeyMeta) {
    const splitCount = Array.isArray(data.splitGroups)
      ? data.splitGroups.reduce((sum, group) => sum + group.breakdown.length, 0)
      : 0;
    const splitText = splitCount > 0 ? ` · 상세 분기 ${splitCount}개` : "";
    const valueModeText = valueMode === SANKEY_VALUE_MODES.PERCENT ? "표시 %" : "표시 금액";
    const sortText = sortModeTextMap[sortMode] || sortModeTextMap[SANKEY_SORT_MODES.GROUP];
    const isMobileViewport = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
    const zoomText = isMobileViewport ? ` · 확대 ${Math.round(getEffectiveSankeyZoom(true) * 100)}%` : "";
    dom.sankeyMeta.textContent = `수입 ${formatCurrency(snapshot.income)} · 배분 ${formatCurrency(snapshot.requiredOutflow)} · 순현금흐름 ${formatSignedCurrency(snapshot.netCashflow)}${splitText} · ${valueModeText} · ${sortText}${zoomText}`;
  }

  const columns = [...new Set(data.nodes.map((node) => node.column))].sort((a, b) => a - b);
  const columnCount = columns.length;
  const firstColumn = columns[0];
  const lastColumn = columns[columns.length - 1];
  const hasIncomeInflow = Boolean(data.hasIncomeInflow);
  const hasGroupLayer = Boolean(data.hasGroupLayer);
  const isMobileViewport = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
  const effectiveSankeyZoom = getEffectiveSankeyZoom(isMobileViewport);
  const baseNodeWidth = isMobileViewport ? 16 : 18;
  const groupNodeWidth = baseNodeWidth + (isMobileViewport ? 4 : 6);
  const labelGap = isMobileViewport ? 8 : 10;
  const labelFontSize = isMobileViewport ? 11 : 12;
  const valueFontSize = isMobileViewport ? 10 : 11;
  const overlapPadding = hasGroupLayer ? 20 : 0;
  const minColumnStep = isMobileViewport
    ? (hasIncomeInflow ? SANKEY_MOBILE_MIN_COLUMN_STEP_WITH_INFLOW : SANKEY_MOBILE_MIN_COLUMN_STEP) + overlapPadding
    : 160 + overlapPadding;

  const getNodeTextWidth = (node) => Math.max(
    measureSankeyTextWidth(node?.label, labelFontSize, 700),
    measureSankeyTextWidth(formatCurrency(node?.value), valueFontSize, 400),
  );

  const leftLabelColumn = hasIncomeInflow && columnCount > 1 ? columns[1] : firstColumn;
  const leftLabelWidth = data.nodes
    .filter((node) => node.column === leftLabelColumn)
    .reduce((max, node) => Math.max(max, getNodeTextWidth(node)), 0);
  const rightLabelWidth = data.nodes
    .filter((node) => node.column === lastColumn)
    .reduce((max, node) => Math.max(max, getNodeTextWidth(node)), 0);

  const marginLeft = Math.max(72, Math.ceil(leftLabelWidth + labelGap + 14));
  const marginRight = Math.max(72, Math.ceil(rightLabelWidth + labelGap + 14));
  const flowMinWidth = groupNodeWidth + Math.max(0, columnCount - 1) * minColumnStep;
  const minWidth = Math.ceil(marginLeft + flowMinWidth + marginRight);
  const wrapWidth = Math.max(0, dom.sankeyWrap.clientWidth - (isMobileViewport ? 12 : 20));
  const widthTarget = isMobileViewport
    ? Math.ceil(wrapWidth * SANKEY_MOBILE_WIDTH_SCALE)
    : wrapWidth;
  const width = Math.max(minWidth, widthTarget);
  const maxCountPerColumn = columns.reduce((max, column) => {
    const count = data.nodes.filter((node) => node.column === column).length;
    return Math.max(max, count);
  }, 1);
  const nodeHeightUnit = isMobileViewport
    ? (hasGroupLayer ? 54 : 44)
    : (hasGroupLayer ? 62 : 48);
  const baseHeight = Math.max(
    isMobileViewport ? 340 : 380,
    (isMobileViewport ? 240 : 280) + maxCountPerColumn * nodeHeightUnit,
  );
  const mobileAspectHeight = isMobileViewport ? Math.round(width * SANKEY_MOBILE_HEIGHT_RATIO) : 0;
  const height = Math.max(baseHeight, mobileAspectHeight);
  const marginTop = isMobileViewport ? 24 : 32;
  const marginBottom = isMobileViewport ? 24 : 32;
  const nodeGap = isMobileViewport
    ? (hasGroupLayer ? 18 : 14)
    : (hasGroupLayer ? 22 : 16);

  dom.sankeySvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  dom.sankeySvg.style.width = `${Math.round(effectiveSankeyZoom * 100)}%`;
  dom.sankeySvg.style.maxWidth = "none";
  dom.sankeySvg.style.margin = isMobileViewport ? "0 auto" : "0";

  const inTotals = new Map();
  const outTotals = new Map();
  data.links.forEach((link) => {
    outTotals.set(link.source, (outTotals.get(link.source) || 0) + link.value);
    inTotals.set(link.target, (inTotals.get(link.target) || 0) + link.value);
  });

  const layoutNodes = data.nodes.map((node) => {
    const incoming = inTotals.get(node.id) || 0;
    const outgoing = outTotals.get(node.id) || 0;
    return {
      ...node,
      displayValue: Math.max(node.value || 0, incoming, outgoing),
    };
  });

  const scaleCandidates = columns.map((column) => {
    const nodesInColumn = layoutNodes.filter((node) => node.column === column);
    const columnValue = nodesInColumn.reduce((sum, node) => sum + node.displayValue, 0);
    const available = height - marginTop - marginBottom - nodeGap * Math.max(0, nodesInColumn.length - 1);
    return columnValue > 0 ? available / columnValue : Number.POSITIVE_INFINITY;
  });
  const scale = Math.min(...scaleCandidates);

  if (!Number.isFinite(scale) || scale <= 0) {
    dom.sankeyEmpty.hidden = false;
    return;
  }

  const usableWidth = Math.max(baseNodeWidth, width - marginLeft - marginRight - groupNodeWidth);
  const step = columnCount > 1 ? usableWidth / (columnCount - 1) : 0;

  const positionedNodes = [];
  columns.forEach((column, index) => {
    const nodesInColumn = layoutNodes.filter((node) => node.column === column);
    const columnHeight = nodesInColumn.reduce((sum, node) => sum + node.displayValue * scale, 0)
      + nodeGap * Math.max(0, nodesInColumn.length - 1);
    let y = (height - columnHeight) / 2;
    const x = marginLeft + index * step;
    const isGroupCol = hasGroupLayer && column === columns[columns.length - 2];
    const currentW = isGroupCol ? groupNodeWidth : baseNodeWidth;

    nodesInColumn.forEach((node) => {
      const h = node.displayValue * scale;
      positionedNodes.push({ ...node, x, y, h, w: currentW });
      y += h + nodeGap;
    });
  });

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));

  const orderedLinks = [...data.links].sort((a, b) => {
    const sourceA = nodeMap.get(a.source);
    const sourceB = nodeMap.get(b.source);
    const targetA = nodeMap.get(a.target);
    const targetB = nodeMap.get(b.target);
    const bySourceY = (sourceA?.y || 0) - (sourceB?.y || 0);
    if (bySourceY !== 0) return bySourceY;
    return (targetA?.y || 0) - (targetB?.y || 0);
  });

  const sourceOffsets = new Map(positionedNodes.map((node) => [node.id, 0]));
  const targetOffsets = new Map(positionedNodes.map((node) => [node.id, 0]));

  orderedLinks.forEach((link) => {
    const source = nodeMap.get(link.source);
    const target = nodeMap.get(link.target);
    if (!source || !target) return;

    const thickness = link.value * scale;
    const sourceOffset = sourceOffsets.get(source.id) || 0;
    const targetOffset = targetOffsets.get(target.id) || 0;

    const y0 = source.y + sourceOffset;
    const y1 = y0 + thickness;
    const y2 = target.y + targetOffset;
    const y3 = y2 + thickness;

    sourceOffsets.set(source.id, sourceOffset + thickness);
    targetOffsets.set(target.id, targetOffset + thickness);

    const path = createSvgElement("path", {
      d: buildBandPath(source.x + source.w, y0, y1, target.x, y2, y3),
      class: `sankey-path tone-${link.tone}`,
    });

    path.addEventListener("mousemove", (event) => {
      const splitGroup = (data.splitGroups || []).find((group) => link.target === group.parentId);
      const detailText = splitGroup ? formatAllocationBreakdownText(splitGroup.breakdown, data.totalValue, valueMode) : "";
      showSankeyTooltip(event, `${source.label} → ${target.label} · ${formatSankeyDisplayValue(link.value, data.totalValue, valueMode)}${detailText ? `\n${detailText}` : ""}`);
    });
    path.addEventListener("mouseleave", hideSankeyTooltip);
    dom.sankeySvg.appendChild(path);
  });

  positionedNodes.forEach((node) => {
    const side = (hasIncomeInflow && node.column === firstColumn) || node.column === lastColumn ? "target" : "source";
    drawNode(node, side, node.w, labelGap, data.totalValue, valueMode);
  });

  renderSankeyLegend(data, valueMode);
}

function formatAllocationBreakdownText(items, totalValue, valueMode) {
  if (!Array.isArray(items) || items.length === 0) return "";
  return "\n구성: " + items.map(item => `${item.label} ${formatSankeyDisplayValue(item.value, totalValue, valueMode)}`).join(", ");
}

function drawNode(node, side, nodeWidth, labelGap, totalValue, valueMode) {
  const rect = createSvgElement("rect", {
    x: node.x,
    y: node.y,
    width: nodeWidth,
    height: Math.max(1, node.h),
    class: `sankey-node tone-${node.tone}`,
  });
  dom.sankeySvg.appendChild(rect);

  const labelX = side === "source" ? node.x - labelGap : node.x + nodeWidth + labelGap;
  const anchor = side === "source" ? "end" : "start";
  const centerY = node.y + node.h / 2;
  const showValue = node.h >= 22;
  const labelY = showValue ? centerY - 6 : centerY;

  const label = createSvgElement("text", {
    x: labelX,
    y: labelY,
    class: "sankey-label",
    "text-anchor": anchor,
    "dominant-baseline": "middle",
  });
  label.textContent = node.label;
  dom.sankeySvg.appendChild(label);

  if (showValue) {
    const value = createSvgElement("text", {
      x: labelX,
      y: centerY + 10,
      class: "sankey-value",
      "text-anchor": anchor,
      "dominant-baseline": "middle",
    });
    value.textContent = formatSankeyDisplayValue(node.value, totalValue, valueMode);
    dom.sankeySvg.appendChild(value);
  }
}

export function renderSankeyLegend(data, valueMode) {
  const targetIdSet = new Set(Array.isArray(data.topLevelTargetIds) ? data.topLevelTargetIds : []);
  const items = data.nodes
    .filter((node) => targetIdSet.has(node.id))
    .map((node) => ({
      id: node.id,
      label: node.label,
      tone: node.tone,
      value: node.value,
    }));

  const splitGroupMap = new Map();
  (data.splitGroups || []).forEach((group) => {
    splitGroupMap.set(group.parentId, group);
  });

  items.forEach((item) => {
    const groupWrap = document.createElement("div");
    groupWrap.className = "legend-group";

    const chip = document.createElement("span");
    chip.className = "legend-item";

    const dot = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.backgroundColor = TONE_COLORS[item.tone] || "#999";

    const label = document.createElement("span");
    label.textContent = `${item.label} ${formatSankeyDisplayValue(item.value, data.totalValue, valueMode)}`;

    chip.append(dot, label);
    groupWrap.appendChild(chip);

    const splitGroup = splitGroupMap.get(item.id);
    if (splitGroup && Array.isArray(splitGroup.breakdown) && splitGroup.breakdown.length > 0) {
      const groupedTexts = Array.isArray(splitGroup.grouped)
        ? splitGroup.grouped.map((ge) => {
            const ct = (ge.items || []).map((e) => `${e.label} ${formatSankeyDisplayValue(e.value, data.totalValue, valueMode)}`).join(", ");
            return ct ? `${ge.label}: ${ct}` : "";
          }).filter(Boolean)
        : [];
      const groupedSummaryTexts = Array.isArray(splitGroup.grouped)
        ? splitGroup.grouped.map((ge) => `${ge.label} ${formatSankeyDisplayValue(ge.value, data.totalValue, valueMode)}`).filter(Boolean)
        : [];
      const ungroupedTexts = Array.isArray(splitGroup.ungrouped)
        ? splitGroup.ungrouped.map((e) => `${e.label} ${formatSankeyDisplayValue(e.value, data.totalValue, valueMode)}`)
        : [];

      if (groupedSummaryTexts.length > 0) {
        const details = document.createElement("details");
        details.className = "legend-group-toggle";
        const summary = document.createElement("summary");
        summary.className = "legend-group-summary";
        summary.textContent = [...groupedSummaryTexts, ...ungroupedTexts].join(" · ");
        const detail = document.createElement("p");
        detail.className = "legend-group-details";
        detail.textContent = [...groupedTexts, ...ungroupedTexts].join(" · ");
        details.append(summary, detail);
        groupWrap.appendChild(details);
      } else {
        const detail = document.createElement("p");
        detail.className = "legend-group-details";
        detail.textContent = ungroupedTexts.join(" · ");
        groupWrap.appendChild(detail);
      }
    }
    dom.sankeyLegend.appendChild(groupWrap);
  });
}
