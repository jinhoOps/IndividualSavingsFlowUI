import { createSvgElement } from "./sankey-renderer.js";
import { IsfUtils } from "../../../shared/core/utils.js";
 
export function renderNetworkMap(container, accounts, transfers) {
  if (!container) return;
  container.innerHTML = "";
 
  const isMobileViewport = window.matchMedia("(max-width: 760px)").matches;
  const clientW = container.clientWidth || 600;
  const width = isMobileViewport ? Math.max(820, clientW) : Math.max(920, clientW);
  const height = Math.max(container.clientHeight || 480, isMobileViewport ? 460 : 520);
  const cx = width / 2;
  const cy = height / 2;
  
  // 계좌 개수가 많지 않을 때 정교한 배치를 위한 R 계산
  const r = Math.min(width, height) * 0.33; 
 
  // 1. SVG 엘리먼트 생성
  const svg = createSvgElement("svg", {
    id: "accountFlowNetworkMap",
    width: isMobileViewport ? `${width}px` : "100%",
    height: isMobileViewport ? `${height}px` : "100%",
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
 
  // 3. 노드 좌우(LR) 좌표 배치
  const nodeMap = {};
  const N = safeAccounts.length;
  safeAccounts.forEach((acc, i) => {
    // x 좌표는 좌에서 우로 균등 배분 (좌우 마진 80px)
    const startX = isMobileViewport ? 100 : 130;
    const endX = width - startX;
    const x = N > 1 ? startX + (i * (endX - startX)) / (N - 1) : cx;
    
    // y 좌표는 중앙선을 기준으로 위/아래로 지그재그(Alternating) 배치하여
    // 수평 링크 꼬임 및 노드 겹침을 최소화 (N이 2개 이상일 때만 지그재그 적용)
    let y = cy;
    if (N > 2) {
      y = cy + (i % 2 === 0 ? -86 : 86);
    }
    
    nodeMap[acc.id] = {
      id: acc.id,
      name: acc.name,
      x,
      y
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
 
    // 각 이체 경로에 맞춰진 고유한 방향 그라데이션 동적 생성
    const gradId = `flow-grad-${index}`;
    const grad = createSvgElement("linearGradient", {
      id: gradId,
      gradientUnits: "userSpaceOnUse",
      x1: x0,
      y1: y0,
      x2: x1,
      y2: y1
    });
    const color = tr.isManual ? "234, 91, 42" : "30, 139, 124";
    const stop1 = createSvgElement("stop", { offset: "0%", "stop-color": `rgba(${color}, 0.15)` });
    const stop2 = createSvgElement("stop", { offset: "50%", "stop-color": `rgba(${color}, 0.95)` });
    const stop3 = createSvgElement("stop", { offset: "100%", "stop-color": `rgba(${color}, 0.15)` });
    grad.append(stop1, stop2, stop3);
    defs.appendChild(grad);

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
      stroke: `url(#${gradId})`,
      "stroke-width": "3.5",
      "stroke-linecap": "round",
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
    textNode.textContent = `${tr.label} (${IsfUtils.formatMoney(tr.value * 10000)})`;
    
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
 
    const rectWidth = isMobileViewport ? 124 : 136;
    const rectHeight = isMobileViewport ? 46 : 50;
    
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
 
    // 계좌 실시간 금액 매핑 (만원 환산)
    const accObj = safeAccounts.find(a => a.id === node.id);
    const valWon = accObj ? (Number(accObj.value) || 0) : 0;

    // 노드 이름 텍스트
    const nameText = createSvgElement("text", {
      x: node.x,
      y: node.y - 2,
      "text-anchor": "middle",
      class: "network-node-text-name",
      style: `font-size: ${isMobileViewport ? 12 : 13}px; font-weight: 700; fill: #102220; font-family: "Gowun Dodum";`
    });
    nameText.textContent = node.name;

    // 노드 금액 텍스트
    const valText = createSvgElement("text", {
      x: node.x,
      y: node.y + 11,
      "text-anchor": "middle",
      class: "network-node-text-val",
      style: `font-size: ${isMobileViewport ? 10.5 : 11}px; font-weight: 600; fill: var(--muted); font-family: "Gowun Dodum";`
    });
    valText.textContent = IsfUtils.formatMoney(valWon * 10000);
 
    group.appendChild(rect);
    group.appendChild(nameText);
    group.appendChild(valText);
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
