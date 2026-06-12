import { createSvgElement } from "./sankey-renderer.js";
import { IsfUtils } from "../../../shared/core/utils.js";
 
export function renderNetworkMap(container, accounts, transfers) {
  if (!container) return;
  container.innerHTML = "";
 
  const width = container.clientWidth || 600;
  const height = container.clientHeight || 480;
  const cx = width / 2;
  const cy = height / 2;
  
  // 계좌 개수가 많지 않을 때 정교한 배치를 위한 R 계산
  const r = Math.min(width, height) * 0.33; 
 
  // 1. SVG 엘리먼트 생성
  const svg = createSvgElement("svg", {
    width: "100%",
    height: "100%",
    viewBox: `0 0 ${width} ${height}`,
    style: "overflow: visible;"
  });
 
  // 2. 화살표 마커 정의
  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: "network-arrow",
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "6",
    markerHeight: "6",
    orient: "auto-start-reverse"
  });
  const markerPath = createSvgElement("path", {
    d: "M 0 1.5 L 8 5 L 0 8.5 z",
    fill: "rgba(234, 91, 42, 0.7)"
  });
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);
 
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  const safeTransfers = Array.isArray(transfers) ? transfers : [];
 
  if (safeAccounts.length === 0) {
    const emptyMsg = document.createElement("p");
    emptyMsg.className = "empty";
    emptyMsg.textContent = "표시할 계좌가 없습니다.";
    container.appendChild(emptyMsg);
    return;
  }
 
  // 3. 노드 원형 좌표 배치
  const nodeMap = {};
  const N = safeAccounts.length;
  safeAccounts.forEach((acc, i) => {
    // 12시 방향부터 균등 정렬되도록 -PI / 2 오프셋 적용
    const theta = (i * 2 * Math.PI) / N - Math.PI / 2;
    nodeMap[acc.id] = {
      id: acc.id,
      name: acc.name,
      x: cx + r * Math.cos(theta),
      y: cy + r * Math.sin(theta)
    };
  });
 
  // 4. 이체 관계선 (유향 엣지) 렌더링
  const linkGroup = createSvgElement("g", { class: "network-links" });
  svg.appendChild(linkGroup);
 
  safeTransfers.forEach((tr, index) => {
    const src = nodeMap[tr.source];
    const tgt = nodeMap[tr.target];
    if (!src || !tgt) return;
 
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
 
    // 노드 박스 외곽에서 선이 끝나도록 offset 지정
    const offset = 65;
    const x0 = src.x + (dx / dist) * (offset - 15);
    const y0 = src.y + (dy / dist) * (offset - 15);
    const x1 = src.x + (dx / dist) * (dist - offset);
    const y1 = src.y + (dy / dist) * (dist - offset);
 
    // 양방향 이체가 존재하는 경우 겹침 방지를 위해 곡선(Bezier)으로 렌더링
    let pathD = `M ${x0} ${y0} L ${x1} ${y1}`;
    const isBiDirectional = safeTransfers.some(other => other.source === tr.target && other.target === tr.source);
    if (isBiDirectional) {
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const nx = -dy / dist; 
      const ny = dx / dist;
      const bend = 22; 
      const qx = mx + nx * bend;
      const qy = my + ny * bend;
      pathD = `M ${x0} ${y0} Q ${qx} ${qy} ${x1} ${y1}`;
    }
 
    // 기본 바탕 이체선
    const baseLink = createSvgElement("path", {
      class: "network-link-base",
      d: pathD,
      fill: "none",
      stroke: "rgba(16, 34, 32, 0.08)",
      "stroke-width": "2.5",
      "data-source": tr.source,
      "data-target": tr.target
    });
 
    // 흐르는 펄스(에너지) 선
    const pulseLink = createSvgElement("path", {
      class: "network-link-pulse",
      d: pathD,
      fill: "none",
      stroke: tr.isManual ? "rgba(234, 91, 42, 0.8)" : "rgba(30, 139, 124, 0.7)",
      "stroke-width": "2",
      "stroke-dasharray": "6, 12",
      "marker-end": "url(#network-arrow)",
      "data-source": tr.source,
      "data-target": tr.target
    });
 
    // 이체 금액 및 제목 텍스트 그룹
    const textGroup = createSvgElement("g", {
      class: "network-link-label-group",
      "data-source": tr.source,
      "data-target": tr.target
    });
    
    // 선의 중간에 위치
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    
    // 텍스트 뒷배경 차단용 rect
    const textBg = createSvgElement("rect", {
      x: mx - 35,
      y: my - 16,
      width: 70,
      height: 12,
      rx: 2,
      ry: 2,
      fill: "#fbfaf7",
      opacity: "0.85"
    });
 
    const textNode = createSvgElement("text", {
      x: mx,
      y: my - 7,
      "text-anchor": "middle",
      class: "network-link-label",
      style: `fill: ${tr.isManual ? '#d35400' : '#16a085'}; font-size: 9px; font-weight: 500; font-family: "Gowun Dodum";`
    });
    const amountMan = Math.round(tr.value / 10000);
    textNode.textContent = `${tr.label} (${amountMan}만)`;
    
    textGroup.appendChild(textBg);
    textGroup.appendChild(textNode);
 
    linkGroup.appendChild(baseLink);
    linkGroup.appendChild(pulseLink);
    linkGroup.appendChild(textGroup);
  });
 
  // 5. 계좌 노드 렌더링
  const nodeGroup = createSvgElement("g", { class: "network-nodes" });
  svg.appendChild(nodeGroup);
 
  Object.values(nodeMap).forEach((node) => {
    const group = createSvgElement("g", {
      class: "network-node-group",
      "data-id": node.id,
      style: "cursor: pointer;"
    });
 
    const rectWidth = 100;
    const rectHeight = 38;
    
    // 노드 배경 박스
    const rect = createSvgElement("rect", {
      x: node.x - rectWidth / 2,
      y: node.y - rectHeight / 2,
      width: rectWidth,
      height: rectHeight,
      rx: "6",
      ry: "6",
      fill: "#ffffff",
      stroke: "rgba(16, 34, 32, 0.12)",
      "stroke-width": "1.2",
      class: "network-node-bg"
    });
 
    // 노드 이름 텍스트
    const text = createSvgElement("text", {
      x: node.x,
      y: node.y + 4,
      "text-anchor": "middle",
      class: "network-node-text",
      style: 'font-size: 11px; font-weight: 600; fill: #102220; font-family: "Gowun Dodum";'
    });
    text.textContent = node.name;
 
    group.appendChild(rect);
    group.appendChild(text);
    nodeGroup.appendChild(group);
 
    // 6. 마우스 호버 포커스 필터링 이벤트 등록
    group.addEventListener("mouseenter", () => {
      const activeId = node.id;
      
      // 관련 없는 다른 노드들 opacity 감소
      svg.querySelectorAll(".network-node-group").forEach((g) => {
        if (g.getAttribute("data-id") !== activeId) {
          g.classList.add("is-dimmed");
        }
      });
 
      // 관련 없는 링크 및 금액 배지 opacity 감소
      svg.querySelectorAll(".network-link-base, .network-link-pulse, .network-link-label-group").forEach((l) => {
        const src = l.getAttribute("data-source");
        const tgt = l.getAttribute("data-target");
        if (src !== activeId && tgt !== activeId) {
          l.classList.add("is-dimmed");
        }
      });
    });
 
    group.addEventListener("mouseleave", () => {
      // 투명도 복원
      svg.querySelectorAll(".is-dimmed").forEach((el) => {
        el.classList.remove("is-dimmed");
      });
    });
  });
 
  container.appendChild(svg);
}
