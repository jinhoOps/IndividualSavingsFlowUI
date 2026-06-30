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

const NODE_COLORS = {
  income: { fill: "#eaf2ff", stroke: "#7aa7e8", text: "#102220" },
  spending: { fill: "#fff8e8", stroke: "#e6bd63", text: "#102220" },
  savings: { fill: "#e9f8ef", stroke: "#74be8a", text: "#102220" },
  investment: { fill: "#eef0ff", stroke: "#8d96e8", text: "#102220" },
  payment: { fill: "#fff8e8", stroke: "#e6bd63", text: "#102220" },
  external: { fill: "#f6f4ef", stroke: "#cfc8bb", text: "#102220" },
};

const EXTERNAL_ROLES = new Set(["external", "payment"]);

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

function getNodeColors(role) {
  return NODE_COLORS[role] || NODE_COLORS.spending;
}

function isExternalNode(node) {
  return EXTERNAL_ROLES.has(node?.role) && !String(node?.id || "").startsWith("income-source-");
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

function stableOffset(id, spread = 1) {
  const text = String(id || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 997;
  }
  return ((hash % 7) - 3) * spread;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createFallbackVector(sourceId, targetId) {
  const angle = ((stableOffset(`${sourceId}:${targetId}`, 1) + 4) / 8) * Math.PI;
  return {
    x: Math.cos(angle) || 1,
    y: Math.sin(angle) || 0,
  };
}

function computePositions(nodes, relationships, width, height) {
  const left = nodes.filter((node) => node.id.startsWith("income-source-"));
  const right = nodes.filter(isExternalNode);
  const middle = nodes.filter((node) => !left.includes(node) && !right.includes(node));
  const columns = [
    { nodes: left, x: 92 },
    { nodes: middle, x: width / 2 },
    { nodes: right, x: width - 116 },
  ].filter((column) => column.nodes.length > 0);
  const positions = new Map();
  const anchors = new Map();

  columns.forEach((column) => {
    const gap = height / (column.nodes.length + 1);
    column.nodes.forEach((node, index) => {
      const anchor = {
        x: column.x,
        y: Math.max(58, Math.min(height - 44, gap * (index + 1))),
      };
      const lateralSpread = column.nodes === middle ? 12 : 5;
      anchors.set(node.id, anchor);
      positions.set(node.id, {
        x: clamp(anchor.x + stableOffset(node.id, lateralSpread), 70, width - 70),
        y: anchor.y,
      });
    });
  });

  const links = (Array.isArray(relationships) ? relationships : [])
    .map((relationship) => {
      const sourceId = String(relationship?.sourceAccountId || "");
      const targetId = String(relationship?.targetAccountId || "");
      const sourceAnchor = anchors.get(sourceId);
      const targetAnchor = anchors.get(targetId);
      if (!sourceAnchor || !targetAnchor) return null;
      const laneDistance = Math.abs(sourceAnchor.x - targetAnchor.x);
      return {
        sourceId,
        targetId,
        sameLane: laneDistance < 80,
        lateralDirection: stableOffset(`${sourceId}:${targetId}`, 1) >= 0 ? 1 : -1,
        distance: laneDistance < 80 ? 138 : clamp(laneDistance * 0.82, 156, 330),
      };
    })
    .filter(Boolean);

  const renderNodeIds = nodes.map((node) => node.id);
  const minDistance = 92;
  for (let iteration = 0; iteration < 72; iteration += 1) {
    links.forEach((link) => {
      const source = positions.get(link.sourceId);
      const target = positions.get(link.targetId);
      if (!source || !target) return;
      let dx = target.x - source.x;
      let dy = target.y - source.y;
      let distance = Math.hypot(dx, dy);
      if (distance < 0.001) {
        const vector = createFallbackVector(link.sourceId, link.targetId);
        dx = vector.x;
        dy = vector.y;
        distance = 1;
      }
      const force = (distance - link.distance) * 0.035;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;
      source.x += fx;
      source.y += fy;
      target.x -= fx;
      target.y -= fy;
      if (link.sameLane && Math.abs(target.x - source.x) < 46) {
        source.x -= link.lateralDirection * 0.42;
        target.x += link.lateralDirection * 0.42;
      }
    });

    for (let sourceIndex = 0; sourceIndex < renderNodeIds.length; sourceIndex += 1) {
      for (let targetIndex = sourceIndex + 1; targetIndex < renderNodeIds.length; targetIndex += 1) {
        const sourceId = renderNodeIds[sourceIndex];
        const targetId = renderNodeIds[targetIndex];
        const source = positions.get(sourceId);
        const target = positions.get(targetId);
        if (!source || !target) continue;
        let dx = target.x - source.x;
        let dy = target.y - source.y;
        let distance = Math.hypot(dx, dy);
        if (distance < 0.001) {
          const vector = createFallbackVector(sourceId, targetId);
          dx = vector.x;
          dy = vector.y;
          distance = 1;
        }
        if (distance >= minDistance) continue;
        const force = ((minDistance - distance) / minDistance) * 4.5;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        source.x -= fx;
        source.y -= fy;
        target.x += fx;
        target.y += fy;
      }
    }

    renderNodeIds.forEach((id) => {
      const position = positions.get(id);
      const anchor = anchors.get(id);
      if (!position || !anchor) return;
      position.x += (anchor.x - position.x) * 0.018;
      position.y += (anchor.y - position.y) * 0.006;
      position.x = clamp(position.x, 70, width - 70);
      position.y = clamp(position.y, 52, height - 52);
    });
  }

  return positions;
}

function applySavedPositions(positions, savedPositions, width, height) {
  if (!savedPositions || typeof savedPositions !== "object") return;
  Object.entries(savedPositions).forEach(([id, position]) => {
    if (!positions.has(id)) return;
    const x = Number(position?.x);
    const y = Number(position?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    positions.set(id, {
      x: clamp(x, 70, width - 70),
      y: clamp(y, 52, height - 52),
    });
  });
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

function getStableLayoutHeight(container) {
  const minHeight = Number.parseFloat(window.getComputedStyle(container).minHeight);
  return Math.max(330, Math.round(Number.isFinite(minHeight) ? minHeight : 430));
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
  const height = getStableLayoutHeight(container);
  const renderNodes = buildRenderNodes(accounts, relationships);
  const positions = computePositions(renderNodes, relationships, width, height);
  applySavedPositions(positions, options.positions, width, height);
  const selectedId = options.selectedId || "";

  const svg = svgElement("svg", {
    class: "account-map-svg",
    viewBox: `0 0 ${width} ${height}`,
    width,
    height,
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
  let dragState = null;

  const getSvgPoint = (event) => {
    const rect = svg.getBoundingClientRect();
    const scaleX = width / Math.max(1, rect.width);
    const scaleY = height / Math.max(1, rect.height);
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const drawEdges = () => {
    edgeLayer.replaceChildren();
    labelLayer.replaceChildren();
    relationships.forEach((relationship, index) => {
      const source = positions.get(String(relationship.sourceAccountId || ""));
      const target = positions.get(String(relationship.targetAccountId || ""));
      if (!source || !target) return;
      const meta = getTypeMeta(relationship.type);
      const offset = (index % 3 - 1) * 18;
      const midX = (source.x + target.x) / 2;
      const midY = (source.y + target.y) / 2 + offset;
      const sourceDirection = source.x <= target.x ? 1 : -1;
      const targetDirection = source.x <= target.x ? -1 : 1;
      const d = `M ${source.x + (42 * sourceDirection)} ${source.y} Q ${midX} ${midY} ${target.x + (42 * targetDirection)} ${target.y}`;
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
        fill: "#ffffff",
      }));
      labelLayer.appendChild(chip);
    });
  };

  const drawNodes = () => {
    nodeLayer.replaceChildren();
    renderNodes.forEach((node) => {
      const position = positions.get(node.id);
      if (!position) return;
      const selected = selectedId === `account:${node.id}`;
      const isDragging = dragState?.nodeId === node.id;
      const colors = getNodeColors(node.role || "spending");
      const group = svgElement("g", {
        class: `account-map-svg__node account-map-svg__node--${node.role || "spending"}${selected ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`,
        transform: `translate(${position.x}, ${position.y})`,
        tabindex: "0",
        role: "button",
        "aria-label": `${node.name} 계좌 선택`,
        "data-account-map-select": "account",
        "data-account-id": node.id,
      });
      group.addEventListener("pointerdown", (event) => {
        const start = getSvgPoint(event);
        svg.setPointerCapture?.(event.pointerId);
        dragState = {
          nodeId: node.id,
          sourceElement: group,
          pointerId: event.pointerId,
          originalPosition: { x: position.x, y: position.y },
          startX: start.x,
          startY: start.y,
          offsetX: start.x - position.x,
          offsetY: start.y - position.y,
          moved: false,
        };
        svg.classList.add("is-dragging");
      });
      group.appendChild(svgElement("rect", {
        x: "-58",
        y: "-25",
        width: "116",
        height: "50",
        rx: "8",
        fill: colors.fill,
        stroke: colors.stroke,
        "stroke-width": selected ? "2.5" : "1.4",
      }));
      group.appendChild(createSvgText(node.name, {
        x: "0",
        y: "3",
        "text-anchor": "middle",
        class: "account-map-svg__node-text",
        fill: colors.text,
      }));
      nodeLayer.appendChild(group);
    });
  };

  const redrawGraph = () => {
    drawEdges();
    drawNodes();
  };

  const finishDrag = async ({ persist }) => {
    if (!dragState) return;
    const nodeId = dragState.nodeId;
    const pointerId = dragState.pointerId;
    const sourceElement = dragState.sourceElement;
    const position = positions.get(nodeId);
    const moved = dragState.moved;
    const originalPosition = dragState.originalPosition;
    dragState = null;
    svg.classList.remove("is-dragging");
    try {
      if (pointerId !== undefined && svg.hasPointerCapture?.(pointerId)) {
        svg.releasePointerCapture(pointerId);
      }
    } catch (_error) {}
    if (!moved && persist && sourceElement) {
      sourceElement.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return;
    }
    if (!persist && originalPosition) {
      positions.set(nodeId, originalPosition);
    }
    if (moved) redrawGraph();
    if (persist && moved && position && typeof options.onNodePositionChange === "function") {
      await options.onNodePositionChange(nodeId, position);
    }
  };

  svg.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const point = getSvgPoint(event);
    if (!dragState.moved && Math.hypot(point.x - dragState.startX, point.y - dragState.startY) < 4) {
      return;
    }
    dragState.moved = true;
    positions.set(dragState.nodeId, {
      x: clamp(point.x - dragState.offsetX, 70, width - 70),
      y: clamp(point.y - dragState.offsetY, 52, height - 52),
    });
    event.preventDefault();
    redrawGraph();
  });

  svg.addEventListener("pointerup", async (event) => {
    if (dragState && event.pointerId !== dragState.pointerId) return;
    await finishDrag({ persist: true });
  });

  svg.addEventListener("pointercancel", async (event) => {
    if (dragState && event.pointerId !== dragState.pointerId) return;
    await finishDrag({ persist: false });
  });

  svg.addEventListener("pointerleave", async () => {
    if (!dragState) return;
    await finishDrag({ persist: true });
  });

  redrawGraph();
  svg.append(edgeLayer, labelLayer, nodeLayer);
  container.replaceChildren(svg);
}
