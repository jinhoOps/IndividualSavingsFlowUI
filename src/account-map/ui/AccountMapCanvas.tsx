import { useEffect, useMemo, useRef, useState, type CSSProperties, type JSX } from 'react';
import { Button } from '../../components/common/Button';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { MapInteractionState, RecoveryState } from '../application/reducer';
import type { AccountMapApplied } from '../domain/model';
import { buildAccountMapGraph, layoutAccountMap, type MapZoom, type PositionedNode } from './mapLayout';
import { AccountMapModal, type AccountMapNodeEditInput } from './AccountMapModal';
import { summarizeLocationConnectionDetail } from './accountMapConnectionDetail';
import { animateConnectionDetail } from './motion';

const zooms: MapZoom[] = ['overview', 'default', 'detail'];
const zoomLabels = { overview: '전체 보기', default: '기본 보기', detail: '상세 보기' } as const;

export interface AccountMapCanvasProps {
  applied: AccountMapApplied;
  main: MainData;
  locations: readonly FinancialLocation[];
  interaction: MapInteractionState;
  viewport?: { width: number; height: number };
  onTransient(nodeId: string): void;
  onBlur(nodeId: string): void;
  onInvoke(nodeId: string): void;
  onBackground(): void;
  onEscape(): void;
  onModalClose?(): void;
  onSaveNodeEdit?(nodeId: string, input: AccountMapNodeEditInput): Promise<boolean>;
  onConnectLocation?(purposeId: string, locationId: string, amount?: number): Promise<boolean>;
  onCreateAndConnectLocation?(purposeId: string, location: FinancialLocation, amount?: number): Promise<boolean>;
  onArchivePurpose?(purposeId: `custom:${string}`): Promise<boolean>;
  onArchiveLocation?(locationId: string, replacementRemainderByPurpose: Record<string, string | null>): Promise<boolean>;
  onRestoreLocation?(locationId: string, restoreLinkIds: string[], remainderByPurpose: Record<string, string | null>): Promise<boolean>;
  recovery?: RecoveryState;
  recoveryPending?: boolean;
  saveFailed?: boolean;
  onReapply?(): Promise<boolean>;
  onKeepLatest?(): void;
  hasExternalModal?: boolean;
}

export function AccountMapCanvas({
  applied, main, locations, interaction, viewport,
  onTransient, onBlur, onInvoke, onBackground, onEscape, onModalClose = () => undefined,
  onSaveNodeEdit, onConnectLocation, onCreateAndConnectLocation, onArchivePurpose, onArchiveLocation, onRestoreLocation,
  recovery = { status: 'none' }, recoveryPending = false, saveFailed = false,
  onReapply = async () => false, onKeepLatest = () => undefined, hasExternalModal = false,
}: AccountMapCanvasProps): JSX.Element {
  const [zoom, setZoom] = useState<MapZoom>('default');
  const canvasRef = useRef<HTMLDivElement>(null);
  const connectionDetailRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const nodeRefs = useRef(new Map<string, HTMLButtonElement>());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const touchPanDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const reducedMotion = typeof window.matchMedia !== 'function'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [measuredViewport, setMeasuredViewport] = useState({ width: 1040, height: 620 });
  const effectiveViewport = viewport ?? measuredViewport;
  useEffect(() => {
    if (viewport !== undefined || typeof ResizeObserver === 'undefined') return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const update = (width: number) => setMeasuredViewport({ width: Math.max(280, width), height: width <= 768 ? 700 : 620 });
    update(canvas.clientWidth);
    const observer = new ResizeObserver((entries) => update(entries[0]?.contentRect.width ?? canvas.clientWidth));
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [viewport]);
  useEffect(() => {
    if (interaction.modalNodeId !== null || hasExternalModal) return;
    if (interaction.transientNodeId === null && interaction.pinnedNodeId === null) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (event.defaultPrevented || hasActiveOverlay()) return;
      event.preventDefault();
      onEscape();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [hasExternalModal, interaction.modalNodeId, interaction.pinnedNodeId, interaction.transientNodeId, onEscape]);
  const graph = useMemo(() => buildAccountMapGraph(applied, locations, main, zoom), [applied, locations, main, zoom]);
  const activeDetailGraph = useMemo(
    () => buildAccountMapGraph(applied, locations, main, 'detail'),
    [applied, locations, main],
  );
  const positioned = useMemo(() => layoutAccountMap(graph, effectiveViewport, zoom), [graph, effectiveViewport.width, effectiveViewport.height, zoom]);
  const nodeById = new Map(positioned.nodes.map((node) => [node.id, node]));
  const nodeOrderById = new Map(positioned.nodes.map((node, index) => [node.id, index]));
  const canonicalRows = positioned.nodes
    .filter((node) => node.kind === 'location')
    .flatMap((location) => positioned.edges
      .filter((edge) => edge.locationId === location.id)
      .sort((left, right) => {
        const purposeDifference = (nodeOrderById.get(left.purposeId) ?? Number.MAX_SAFE_INTEGER)
          - (nodeOrderById.get(right.purposeId) ?? Number.MAX_SAFE_INTEGER);
        return purposeDifference || left.id.localeCompare(right.id);
      }));
  const focusedId = interaction.transientNodeId ?? interaction.pinnedNodeId;
  const focusedNode = focusedId === null ? undefined : nodeById.get(focusedId);
  const connectionDetailTargetId = focusedNode?.kind === 'location' ? focusedNode.id : null;
  const connectionDetail = connectionDetailTargetId === null
    ? null
    : summarizeLocationConnectionDetail(activeDetailGraph, connectionDetailTargetId);
  const connectionDetailRows = connectionDetail === null ? [] : withDisplayedPercents(connectionDetail.rows);
  const pinnedNode = interaction.pinnedNodeId === null ? undefined : nodeById.get(interaction.pinnedNodeId);
  const pinnedLocationId = pinnedNode?.kind === 'location' ? pinnedNode.id : null;
  const previousPinnedLocationId = useRef<string | null>(pinnedLocationId);
  const connectionDetailPosition = connectionDetail === null || focusedNode === undefined
    ? null
    : positionConnectionDetail(focusedNode, positioned.nodes, positioned, pan);
  useEffect(() => {
    if (interaction.modalNodeId !== null) return;
    const staleTarget = [interaction.transientNodeId, interaction.pinnedNodeId]
      .some((targetId) => targetId !== null && !positioned.nodes.some(({ id }) => id === targetId));
    if (staleTarget) onBackground();
  }, [interaction.modalNodeId, interaction.pinnedNodeId, interaction.transientNodeId, onBackground, positioned]);
  useEffect(() => {
    const isNewlyPinned = previousPinnedLocationId.current !== pinnedLocationId;
    previousPinnedLocationId.current = pinnedLocationId;
    if (!isNewlyPinned || pinnedLocationId === null || connectionDetailTargetId !== pinnedLocationId || connectionDetailRef.current === null) return;
    return animateConnectionDetail(connectionDetailRef.current, { reducedMotion, onComplete: () => undefined }).cancel;
  }, [connectionDetailTargetId, pinnedLocationId]);
  const connectedIds = new Set<string>(focusedId === null ? [] : positioned.edges.flatMap((edge) => (
    edge.purposeId === focusedId || edge.locationId === focusedId ? [edge.purposeId, edge.locationId] : []
  )));
  if (focusedId !== null) connectedIds.add(focusedId);

  function changeZoom(delta: number) {
    const index = zooms.indexOf(zoom);
    setPan({ x: 0, y: 0 });
    setZoom(zooms[Math.max(0, Math.min(zooms.length - 1, index + delta))]!);
  }

  const modalNode = interaction.modalNodeId === null
    ? undefined
    : positioned.nodes.find(({ id }) => id === interaction.modalNodeId);
  const directModalRelated = modalNode === undefined ? [] : positioned.edges
    .filter((edge) => edge.purposeId === modalNode.id || edge.locationId === modalNode.id)
    .map((edge) => {
      const sourceLink = applied.links.find(({ id }) => id === edge.id);
      return {
      label: nodeById.get(edge.purposeId === modalNode.id ? edge.locationId : edge.purposeId)?.label ?? '연결',
      amountWon: edge.amountWon,
      status: edge.status,
      suspendedReason: sourceLink?.status === 'suspended' ? sourceLink.suspendedReason : undefined,
      linkId: edge.id,
      purposeId: edge.purposeId,
      purposeTargetWon: nodeById.get(edge.purposeId)?.allocationTargetWon,
      locationId: edge.locationId.replace(/^location:/u, ''),
      remainder: sourceLink?.remainder ?? false,
    }; });
  const replacementRelated = modalNode?.kind !== 'location' ? [] : [...new Set(directModalRelated.map(({ purposeId }) => purposeId).filter((id): id is string => id !== undefined))]
    .flatMap((purposeId) => positioned.edges
      .filter((edge) => edge.purposeId === purposeId && edge.locationId !== modalNode.id && edge.status === 'active')
      .map((edge) => ({
        label: nodeById.get(edge.locationId)?.label ?? '다른 계좌',
        amountWon: edge.amountWon,
        status: edge.status,
        linkId: edge.id,
        purposeId: edge.purposeId,
        purposeTargetWon: nodeById.get(edge.purposeId)?.allocationTargetWon,
        locationId: edge.locationId.replace(/^location:/u, ''),
        remainder: false,
        replacementCandidate: true,
      })));
  const modalRelated = [...directModalRelated, ...replacementRelated];

  function handleCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'touch') return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.account-map-node, .account-map-edge-amount') !== null) return;
    panDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handleCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (drag === null) return;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const moved = drag.moved || Math.hypot(deltaX, deltaY) >= 4;
    panDragRef.current = { ...drag, moved };
    if (moved) {
      event.preventDefault();
      setPan({ x: drag.originX + deltaX, y: drag.originY + deltaY });
    }
  }

  function handleCanvasPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (drag === null) return;
    panDragRef.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drag.moved) onBackground();
  }

  function handleCanvasTouchStart(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 1) return;
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('.account-map-node, .account-map-edge-amount') !== null) return;
    const touch = event.touches[0]!;
    touchPanDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      originX: pan.x,
      originY: pan.y,
      moved: false,
    };
  }

  function handleCanvasTouchMove(event: React.TouchEvent<HTMLDivElement>) {
    const drag = touchPanDragRef.current;
    if (drag === null || event.touches.length !== 1) return;
    const touch = event.touches[0]!;
    const deltaX = touch.clientX - drag.startX;
    const deltaY = touch.clientY - drag.startY;
    const distance = Math.hypot(deltaX, deltaY);
    if (!drag.moved && distance < 4) return;
    if (!drag.moved && Math.abs(deltaY) > Math.abs(deltaX)) {
      touchPanDragRef.current = null;
      return;
    }
    event.preventDefault();
    touchPanDragRef.current = { ...drag, moved: true };
    setPan({ x: drag.originX + deltaX, y: drag.originY + deltaY });
  }

  function handleCanvasTouchEnd() {
    const drag = touchPanDragRef.current;
    touchPanDragRef.current = null;
    if (drag !== null && !drag.moved) onBackground();
  }

  return (
    <section className="account-map-canvas-shell" aria-labelledby="account-map-canvas-title">
      <header className="account-map-canvas-toolbar">
        <div><p className="account-map-eyebrow">연결 지도</p><h2 ref={headingRef} id="account-map-canvas-title" tabIndex={-1}>목적과 계좌의 연결</h2></div>
        <div className="account-map-zoom-control" role="group" aria-label="지도 확대 수준">
          <button type="button" aria-label="축소" disabled={zoom === 'overview'} onClick={() => changeZoom(-1)}>−</button>
          <span>{zoomLabels[zoom]}</span>
          <button type="button" aria-label="확대" disabled={zoom === 'detail'} onClick={() => changeZoom(1)}>＋</button>
        </div>
      </header>
      <div
        ref={canvasRef}
        className="account-map-canvas"
        data-direction={positioned.direction}
        style={{ height: connectionDetailPosition?.canvasHeight ?? positioned.height }}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handleCanvasPointerMove}
        onPointerUp={handleCanvasPointerUp}
        onPointerCancel={() => { panDragRef.current = null; }}
        onTouchStart={handleCanvasTouchStart}
        onTouchMove={handleCanvasTouchMove}
        onTouchEnd={handleCanvasTouchEnd}
        onTouchCancel={() => { touchPanDragRef.current = null; }}
      >
        <div className="account-map-canvas__content" style={{
          width: positioned.width,
          height: positioned.height,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
        }}>
          <svg className="account-map-edges" viewBox={`0 0 ${positioned.width} ${positioned.height}`} preserveAspectRatio="none" aria-hidden="true">
            {positioned.edges.map((edge) => {
              const purpose = nodeById.get(edge.purposeId);
              const location = nodeById.get(edge.locationId);
              if (purpose === undefined || location === undefined) return null;
              const x1 = purpose.x + purpose.width / 2;
              const y1 = purpose.y + purpose.height / 2;
              const x2 = location.x + location.width / 2;
              const y2 = location.y + location.height / 2;
              const emphasized = focusedId !== null && (edge.purposeId === focusedId || edge.locationId === focusedId);
              return <path key={edge.id} d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} className={`${edge.status === 'suspended' ? 'is-suspended' : ''}${emphasized ? ' is-focused' : ''}`} />;
            })}
          </svg>
          {positioned.edges.map((edge) => {
            const purpose = nodeById.get(edge.purposeId);
            const location = nodeById.get(edge.locationId);
            const visible = focusedId !== null && (edge.purposeId === focusedId || edge.locationId === focusedId);
            if (!visible || purpose === undefined || location === undefined) return null;
            return <span key={`amount:${edge.id}`} className="account-map-edge-amount" style={{ left: (purpose.x + location.x + purpose.width) / 2, top: (purpose.y + location.y + purpose.height) / 2 }}>{formatWon(edge.amountWon)}</span>;
          })}
          {positioned.nodes.map((node) => {
            const dimmed = focusedId !== null && !connectedIds.has(node.id);
            return <button
              ref={(element) => { if (element === null) nodeRefs.current.delete(node.id); else nodeRefs.current.set(node.id, element); }}
              key={node.id}
              type="button"
              className={`account-map-node account-map-node--${node.kind} is-${node.status}${dimmed ? ' is-dimmed' : ''}${interaction.pinnedNodeId === node.id ? ' is-pinned' : ''}`}
              style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
              aria-label={nodeAccessibleName(node)}
              onMouseEnter={() => onTransient(node.id)}
              onMouseLeave={() => onBlur(node.id)}
              onFocus={() => onTransient(node.id)}
              onBlur={() => onBlur(node.id)}
              onClick={() => onInvoke(node.id)}
            ><span>{node.label}</span>{node.amountWon === undefined ? null : <strong>{formatWon(node.amountWon)}</strong>}{node.secondary === undefined ? null : <small>{node.secondary}</small>}{node.status === 'unassigned' ? <small>연결 필요</small> : node.status === 'excess' ? <small>초과 연결</small> : null}</button>;
          })}
        </div>
        {connectionDetail === null ? null : <aside
          ref={connectionDetailRef}
          className="account-map-connection-detail"
          aria-label={`${focusedNode?.label ?? '계좌'} 월 연결 구성`}
          style={connectionDetailPosition === null ? undefined : {
            left: connectionDetailPosition.left,
            top: connectionDetailPosition.top,
            maxBlockSize: connectionDetailPosition.maxBlockSize,
          }}
        >
          <div className="account-map-connection-detail__heading"><h3>월 연결 구성</h3><strong>{formatWon(connectionDetail.totalWon)}</strong></div>
          <p>월 계획 연결 기준 · 실제 잔액·거래·계좌 간 이동이 아님</p>
          {connectionDetailRows.length === 0 ? <p className="account-map-connection-detail__empty">활성 월 연결이 없습니다.</p> : <ul>{connectionDetailRows.map((row) => <li key={row.purposeId}>
            <div><span>{row.label}</span><strong>{formatWon(row.amountWon)} · {row.displayPercent}%</strong></div>
            <span className="account-map-connection-detail__track" aria-hidden="true"><span
              className="account-map-connection-detail__weight"
              data-account-map-connection-weight={row.percent / 100}
              style={{ '--account-map-connection-weight': row.percent / 100 } as CSSProperties}
            /></span>
          </li>)}</ul>}
        </aside>}
      </div>
      <table className="sr-only account-map-linear-table" aria-label="계좌 연결 읽기 표">
        <thead><tr><th>계좌·보관처</th><th>목적</th><th>월 금액</th><th>상태</th></tr></thead>
        <tbody>{canonicalRows.map((edge) => {
          const purpose = nodeById.get(edge.purposeId);
          const location = nodeById.get(edge.locationId);
          if (purpose === undefined || location === undefined) return null;
          return <tr key={`row:${edge.id}`}><td>{location.label}</td><td>{purpose.label}</td><td>{formatWon(edge.amountWon)}</td><td>{edge.status === 'active' ? '연결됨' : '중지됨'}</td></tr>;
        })}</tbody>
      </table>
      {modalNode === undefined && !hasExternalModal && recovery.status !== 'none' ? <div className="account-map-error" role={recovery.status === 'stale' ? 'status' : 'alert'}><p id="account-map-global-recovery">{recovery.status === 'manual' && recovery.reason === 'target-missing' ? '최신 상태에서 작업 대상을 찾을 수 없습니다. 최신 값을 유지하거나 작업을 다시 확인해 주세요.' : '다른 곳에서 변경된 최신 상태를 불러왔습니다. 자동으로 다시 저장하지 않습니다.'}</p><div className="account-map-actions"><Button variant="primary" type="button" aria-describedby="account-map-global-recovery" disabled={recoveryPending} onClick={() => void onReapply()}>{recovery.status === 'manual' ? '최신 상태에서 다시 검토' : '최신 상태에서 다시 적용'}</Button><Button variant="secondary" type="button" disabled={recoveryPending} onClick={onKeepLatest}>최신 값 유지</Button></div></div> : null}
      {modalNode === undefined ? null : <AccountMapModal node={modalNode} related={modalRelated} locations={[...locations]} sourceElement={nodeRefs.current.get(modalNode.id) ?? null} fallbackElement={headingRef.current} reducedMotion={reducedMotion} recovery={recovery} recoveryPending={recoveryPending} saveFailed={saveFailed} onReapply={onReapply} onKeepLatest={onKeepLatest} onClose={onModalClose} onSaveEdit={onSaveNodeEdit === undefined ? undefined : (input) => onSaveNodeEdit(modalNode.id, input)} onConnectLocation={modalNode.kind !== 'purpose' || onConnectLocation === undefined ? undefined : (locationId, amount) => onConnectLocation(modalNode.id, locationId, amount)} onCreateAndConnectLocation={modalNode.kind !== 'purpose' || onCreateAndConnectLocation === undefined ? undefined : (location, amount) => onCreateAndConnectLocation(modalNode.id, location, amount)} onArchivePurpose={onArchivePurpose} onArchiveLocation={onArchiveLocation} onRestoreLocation={onRestoreLocation} />}
    </section>
  );
}

function hasActiveOverlay(): boolean {
  return [...document.querySelectorAll<HTMLElement>('dialog[open], [role="dialog"], [role="menu"], [role="tooltip"]')]
    .some((element) => element.getAttribute('aria-hidden') !== 'true' && !element.hidden);
}

function statusLabel(status: string): string { return status === 'unassigned' ? ' · 연결 필요' : status === 'excess' ? ' · 초과 연결' : status === 'deficit' ? ' · 부족함' : ''; }
function nodeAccessibleName(node: PositionedNode): string {
  const kind = node.kind === 'purpose' ? '목적' : node.kind === 'location' ? '계좌·보관처' : '전체 상태';
  const primaryIncome = node.kind === 'location' && node.isPrimaryIncome === true ? ' · 주 수입 계좌' : '';
  const amount = node.amountWon === undefined
    ? '금액 없음'
    : node.kind === 'location'
      ? `활성 월 연결 합계 ${formatWon(node.amountWon)}`
      : node.kind === 'status'
        ? statusAmountLabel(node)
        : formatWon(node.amountWon);
  const status = {
    resolved: '연결 완료',
    unassigned: '연결 필요',
    excess: '초과 연결',
    suspended: '보관됨',
    surplus: '미배정',
    deficit: '부족함',
  }[node.status];
  return `${kind} · ${node.label}${primaryIncome} · ${amount} · 활성 연결 ${node.connectionCount}개 · ${status}`;
}

function statusAmountLabel(node: PositionedNode): string {
  return node.status === 'deficit'
    ? `전체 부족 ${formatWon(Math.abs(node.amountWon ?? 0))}`
    : `전체 미배정 ${formatWon(Math.abs(node.amountWon ?? 0))}`;
}
function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }

function withDisplayedPercents<Row extends { percent: number }>(rows: readonly Row[]): Array<Row & { displayPercent: number }> {
  const floors = rows.map(({ percent }) => Math.floor(percent));
  const remaining = 100 - floors.reduce((sum, percent) => sum + percent, 0);
  const indices = rows.map(({ percent }, index) => ({ index, remainder: percent - floors[index]! }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index += 1) floors[indices[index]?.index ?? 0]! += 1;
  return rows.map((row, index) => ({ ...row, displayPercent: floors[index]! }));
}

function positionConnectionDetail(
  node: PositionedNode,
  nodes: readonly PositionedNode[],
  canvas: { width: number; height: number },
  pan: { x: number; y: number },
): { left: number; top: number; maxBlockSize: number; canvasHeight: number } {
  const inset = 16;
  const gap = 12;
  const detailWidth = canvas.width <= 600 ? canvas.width - inset * 2 : Math.min(312, canvas.width - inset * 2);
  const detailHeight = Math.min(220, canvas.height - inset * 2);
  const clampLeft = (left: number) => Math.max(inset, Math.min(left, canvas.width - detailWidth - inset));
  const clampTop = (top: number) => Math.max(inset, Math.min(top, canvas.height - detailHeight - inset));
  const target = nodeRectangle(node, pan);
  const nodeRectangles = nodes.map((candidate) => nodeRectangle(candidate, pan));
  const visibleRectangles = nodeRectangles.filter((rectangle) => rectanglesOverlap(rectangle, {
    left: 0, top: 0, right: canvas.width, bottom: canvas.height,
  }));
  const candidates = [
    { left: target.right + gap, top: clampTop(target.top) },
    { left: target.right + gap, top: target.bottom + gap },
    { left: target.left - detailWidth - gap, top: clampTop(target.top) },
    { left: clampLeft(target.left), top: target.bottom + gap },
    { left: clampLeft(target.left), top: target.top - detailHeight - gap },
  ];
  const adjacent = candidates.find(({ left, top }) => {
    const detail = { left, top, right: left + detailWidth, bottom: top + detailHeight };
    return detail.left >= inset && detail.top >= inset
      && detail.right <= canvas.width - inset && detail.bottom <= canvas.height - inset
      && visibleRectangles.every((rectangle) => !rectanglesOverlap(detail, rectangle));
  });
  if (adjacent !== undefined) {
    return { ...adjacent, maxBlockSize: detailHeight, canvasHeight: canvas.height };
  }

  const horizontallyVisible = nodeRectangles.filter(({ left, right }) => right > 0 && left < canvas.width);
  const top = Math.max(canvas.height, ...horizontallyVisible.map(({ bottom }) => bottom)) + inset;
  return {
    left: clampLeft(target.left),
    top,
    maxBlockSize: detailHeight,
    canvasHeight: top + detailHeight + inset,
  };
}

interface DetailRectangle { left: number; top: number; right: number; bottom: number }

function nodeRectangle(node: PositionedNode, pan: { x: number; y: number }): DetailRectangle {
  return {
    left: node.x + pan.x,
    top: node.y + pan.y,
    right: node.x + pan.x + node.width,
    bottom: node.y + pan.y + node.height,
  };
}

function rectanglesOverlap(left: DetailRectangle, right: DetailRectangle): boolean {
  return left.left < right.right && left.right > right.left
    && left.top < right.bottom && left.bottom > right.top;
}
