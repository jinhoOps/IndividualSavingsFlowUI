const SVG_NS = "http://www.w3.org/2000/svg";

const TYPE_META = {
  "income-deposit": { label: "income", color: "#2563eb" },
  "auto-transfer": { label: "transfer", color: "#0f766e" },
  "card-payment": { label: "card", color: "#db2777" },
  "utility-payment": { label: "utility", color: "#ea580c" },
  "loan-payment": { label: "loan", color: "#7c3aed" },
  "savings-transfer": { label: "savings", color: "#16a34a" },
  "investment-transfer": { label: "invest", color: "#4f46e5" },
};

function svgElement(tagName, attributes = {}) {
  const element = document.createElementNS(SVG_NS, tagName);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== undefined && value !== null) element.setAttribute(key, String(value));
  });
  return element;
}

function createSvgText(text, attributes = {}) {
  const element = svgElement("text", attributes);
  element.textContent = text;
  return element;
}

function getTypeMeta(type) {
  return TYPE_META[type] || { label: "link", color: "#64748b" };
}

function buildRenderNodes(accounts = [], relationships = []) {
  const nodes = new Map();
  accounts.forEach((account, index) => {
    const id = String(account?.id || `account-${index + 1}`);
    nodes.set(id, {
      id,
      name: String(account?.name || id || "계좌"),
      role: account?.role || "spending",
    });
  });

  relationships.forEach((relationship) => {
    const sourceId = String(relationship?.sourceAccountId || "");
    const targetId = String(relationship?.targetAccountId || "");
    if (sourceId && !nodes.has(sourceId)) {
      nodes.set(sourceId, { id: sourceId, name: sourceId.startsWith("income-source-") ? "수입원" : sourceId, role: "external" });
    }
    if (targetId && !nodes.has(targetId)) {
      nodes.set(targetId, { id: targetId, name: relationship?.label || targetId, role: "external" });
    }
  });

  return Array.from(nodes.values());
}

function computePositions(nodes, width, height) {
  const left = nodes.filter((node) => node.id.startsWith("income-source-"));
  const right = nodes.filter((node) => node.role === "external" && !node.id.startsWith("income-source-"));
  const middle = nodes.filter((node) => !left.includes(node) && !right.includes(node));
  const columns = [
    { nodes: left, x: 92 },
    { nodes: middle, x: width / 2 },
    { nodes: right, x: width - 116 },
  ].filter((column) => column.nodes.length > 0);
  const positions = new Map();

  columns.forEach((column) => {
    const gap = height / (column.nodes.length + 1);
    column.nodes.forEach((node, index) => {
      positions.set(node.id, {
        x: column.x,
        y: Math.max(58, Math.min(height - 44, gap * (index + 1))),
      });
    });
  });

  return positions;
}

function createMarker(color, id) {
  const marker = svgElement("marker", {
    id,
    markerWidth: "10",
    markerHeight: "10",
    refX: "8",
    refY: "3",
    orient: "auto",
    markerUnits: "strokeWidth",
  });
  marker.appendChild(svgElement("path", { d: "M0,0 L0,6 L9,3 z", fill: color }));
  return marker;
}

export function getRelationshipTypeMeta(type) {
  return getTypeMeta(type);
}

export function renderAccountMap(container, draft = {}, options = {}) {
  if (!container) return;

  const accounts = Array.isArray(draft.accounts) ? draft.accounts : [];
  const relationships = Array.isArray(draft.relationships) ? draft.relationships : [];
  if (!accounts.length && !relationships.length) {
    const empty = document.createElement("div");
    empty.className = "account-map-empty";
    const title = document.createElement("strong");
    title.textContent = "아직 Account Map 초안이 없습니다.";
    const body = document.createElement("span");
    body.textContent = "Main 데이터 가져오기로 계좌 관계 후보를 생성하세요.";
    empty.append(title, body);
    container.replaceChildren(empty);
    return;
  }

  const bounds = container.getBoundingClientRect();
  const width = Math.max(720, Math.round(bounds.width || 860));
  const height = Math.max(360, Math.round(bounds.height || 420));
  const renderNodes = buildRenderNodes(accounts, relationships);
  const positions = computePositions(renderNodes, width, height);
  const selectedId = options.selectedId || "";

  const svg = svgElement("svg", {
    class: "account-map-svg",
    viewBox: `0 0 ${width} ${height}`,
    role: "img",
    "aria-label": "Account Map 관계도",
  });

  const defs = svgElement("defs");
  Object.values(TYPE_META).forEach((meta, index) => {
    defs.appendChild(createMarker(meta.color, `account-map-arrow-${index}`));
  });
  svg.appendChild(defs);

  const markerByColor = new Map(Object.values(TYPE_META).map((meta, index) => [meta.color, `url(#account-map-arrow-${index})`]));
  const edgeLayer = svgElement("g", { class: "account-map-svg__edges" });
  const labelLayer = svgElement("g", { class: "account-map-svg__edge-labels" });
  const nodeLayer = svgElement("g", { class: "account-map-svg__nodes" });

  relationships.forEach((relationship, index) => {
    const source = positions.get(String(relationship.sourceAccountId || ""));
    const target = positions.get(String(relationship.targetAccountId || ""));
    if (!source || !target) return;
    const meta = getTypeMeta(relationship.type);
    const offset = (index % 3 - 1) * 18;
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2 + offset;
    const d = `M ${source.x + 42} ${source.y} Q ${midX} ${midY} ${target.x - 42} ${target.y}`;
    const id = String(relationship.id || `relationship-${index + 1}`);
    const selected = selectedId === `relationship:${id}`;

    const path = svgElement("path", {
      class: `account-map-svg__edge${selected ? " is-selected" : ""}`,
      d,
      fill: "none",
      stroke: meta.color,
      "stroke-width": selected ? "4" : "2.5",
      "marker-end": markerByColor.get(meta.color) || "",
      tabindex: "0",
      role: "button",
      "aria-label": `${meta.label} 관계 선택`,
      "data-account-map-select": "relationship",
      "data-relationship-id": id,
    });
    edgeLayer.appendChild(path);

    const chip = svgElement("g", {
      class: `account-map-svg__edge-chip${selected ? " is-selected" : ""}`,
      "data-account-map-select": "relationship",
      "data-relationship-id": id,
      tabindex: "0",
      role: "button",
    });
    chip.appendChild(svgElement("rect", {
      x: midX - 32,
      y: midY - 14,
      width: "64",
      height: "24",
      rx: "6",
      fill: meta.color,
    }));
    chip.appendChild(createSvgText(meta.label, {
      x: midX,
      y: midY + 3,
      "text-anchor": "middle",
      class: "account-map-svg__edge-text",
    }));
    labelLayer.appendChild(chip);
  });

  renderNodes.forEach((node) => {
    const position = positions.get(node.id);
    if (!position) return;
    const selected = selectedId === `account:${node.id}`;
    const group = svgElement("g", {
      class: `account-map-svg__node account-map-svg__node--${node.role || "spending"}${selected ? " is-selected" : ""}`,
      transform: `translate(${position.x}, ${position.y})`,
      tabindex: "0",
      role: "button",
      "aria-label": `${node.name} 계좌 선택`,
      "data-account-map-select": "account",
      "data-account-id": node.id,
    });
    group.appendChild(svgElement("rect", { x: "-58", y: "-25", width: "116", height: "50", rx: "8" }));
    group.appendChild(createSvgText(node.name, {
      x: "0",
      y: "3",
      "text-anchor": "middle",
      class: "account-map-svg__node-text",
    }));
    nodeLayer.appendChild(group);
  });

  svg.append(edgeLayer, labelLayer, nodeLayer);
  container.replaceChildren(svg);
}
