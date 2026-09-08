import { Fragment, useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { MapInteractionState } from '../application/reducer';
import { calculateAccountFlow, type AccountFlowCalculation } from '../domain/accountFlowCalculator';
import type { AccountMapApplied, AccountMapAppliedV3, PurposeId } from '../domain/model';
import { AccountFlowDetail } from './AccountFlowDetail';
import { buildAccountFlowGraph, type AccountFlowEdge } from './accountFlowGraph';
import { layoutAccountFlow, type AccountFlowViewport, type AccountFlowZoom, type PositionedAccountFlowNode, type RoutedAccountFlowEdge } from './accountFlowLayout';
import { buildAccountFlowViewModel, type AccountFlowSelection, type AccountFlowViewModel } from './accountFlowViewModel';
import { animateFocusedFlow } from './motion';

const zooms: readonly AccountFlowZoom[] = ['overview', 'default', 'detail'];
const zoomLabels = { overview: '전체 보기', default: '기본 보기', detail: '상세 보기' } as const;
type FlowApplied = AccountMapApplied | AccountMapAppliedV3;

export interface AccountMapCanvasProps {
  applied: FlowApplied;
  main: MainData;
  locations: readonly FinancialLocation[];
  interaction: MapInteractionState;
  viewport?: AccountFlowViewport;
  calculation?: AccountFlowCalculation;
  onTransient(nodeId: string): void;
  onBlur(nodeId: string): void;
  onInvoke(nodeId: string): void;
  onBackground(): void;
  onEscape(): void;
  onEditLocation?(locationId: string, trigger: HTMLElement): void;
  onAddTransfer?(sourceLocationId: string): void;
  onEditTransfer?(transferId: string): void;
  hasExternalModal?: boolean;
}

/** Rendering and intent only: all money and topology arrive through pure projections. */
export function AccountMapCanvas({
  applied, main, locations, interaction, viewport, calculation: suppliedCalculation,
  onTransient, onBlur, onInvoke, onBackground, onEscape,
  onEditLocation, onAddTransfer, onEditTransfer, hasExternalModal = false,
}: AccountMapCanvasProps): JSX.Element {
  const [zoom, setZoom] = useState<AccountFlowZoom>('default');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const previousPinnedId = useRef<string | null>(interaction.pinnedNodeId);
  const dismissedPreviewId = useRef<string | null>(null);
  const [measuredViewport, setMeasuredViewport] = useState<AccountFlowViewport>({ width: 1040, height: 620, screenWidth: window.innerWidth });
  const effectiveViewport = viewport ?? measuredViewport;
  const reducedMotion = typeof window.matchMedia !== 'function'
    || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panDragRef = useRef<{ pointerId: number; touch: boolean; x: number; y: number; originX: number; originY: number; moved: boolean } | null>(null);

  useEffect(() => {
    if (viewport !== undefined || typeof ResizeObserver === 'undefined') return;
    const canvas = canvasRef.current;
    if (canvas === null) return;
    const update = (width: number) => setMeasuredViewport({ width: Math.max(280, width), height: window.innerWidth <= 768 ? 700 : 620, screenWidth: window.innerWidth });
    update(canvas.clientWidth);
    const observer = new ResizeObserver((entries) => update(entries[0]?.contentRect.width ?? canvas.clientWidth));
    observer.observe(canvas);
    const onResize = () => update(canvas.clientWidth);
    window.addEventListener('resize', onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
    };
  }, [viewport]);

  const calculation = useMemo(() => suppliedCalculation ?? calculateAccountFlow({
    main, locations, links: applied.links, transfers: applied.schemaVersion === 3 ? applied.transfers : [],
  }), [applied, locations, main, suppliedCalculation]);
  const graph = useMemo(() => buildAccountFlowGraph(calculation, applied, locations, main), [applied, calculation, locations, main]);
  const positioned = useMemo(() => layoutAccountFlow(graph, effectiveViewport, zoom), [effectiveViewport.height, effectiveViewport.width, effectiveViewport.screenWidth, graph, zoom]);
  const activeId = interaction.transientNodeId ?? interaction.pinnedNodeId;
  const selection = selectionForId(activeId);
  const viewModel = useMemo(() => buildAccountFlowViewModel(graph, selection), [graph, selection]);
  const pinned = interaction.pinnedNodeId !== null;

  useEffect(() => {
    if (hasExternalModal || activeId === null) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      event.preventDefault();
      dismissedPreviewId.current = activeId;
      onEscape();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [activeId, hasExternalModal, onEscape]);

  useEffect(() => {
    const newlyPinned = previousPinnedId.current !== interaction.pinnedNodeId;
    previousPinnedId.current = interaction.pinnedNodeId;
    if (!newlyPinned || interaction.pinnedNodeId === null || canvasRef.current === null) return;
    return animateFocusedFlow(canvasRef.current, reducedMotion).cancel;
  }, [interaction.pinnedNodeId, reducedMotion]);

  function changeZoom(delta: number) {
    const index = zooms.indexOf(zoom);
    setPan({ x: 0, y: 0 });
    setZoom(zooms[Math.max(0, Math.min(zooms.length - 1, index + delta))]!);
  }
  function startPan(event: React.PointerEvent<HTMLDivElement>) {
    if (targetIsFlowControl(event.target)) return;
    const touch = event.pointerType === 'touch';
    panDragRef.current = { pointerId: event.pointerId, touch, x: event.clientX, y: event.clientY, originX: pan.x, originY: pan.y, moved: false };
    if (!touch) event.currentTarget.setPointerCapture?.(event.pointerId);
  }
  function movePan(event: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    const moved = drag.moved || Math.hypot(dx, dy) >= 4;
    panDragRef.current = { ...drag, moved };
    if (!moved || drag.touch) return;
    event.preventDefault();
    setPan({ x: drag.originX + dx, y: drag.originY + dy });
  }
  function endPan(event: React.PointerEvent<HTMLDivElement>) {
    const drag = panDragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    panDragRef.current = null;
    if (!drag.touch) event.currentTarget.releasePointerCapture?.(event.pointerId);
    if (!drag.moved) {
      dismissedPreviewId.current = activeId;
      onBackground();
    }
  }

  const selectedAccountId = selectedAccountLocationId(activeId, graph.edges);
  const accountLabel = selectedAccountId === null ? undefined : graph.nodes.find((node) => node.id === `account:${selectedAccountId}`)?.label;
  return <section className="account-map-canvas-shell" aria-labelledby="account-map-canvas-title">
    <header className="account-map-canvas-toolbar">
      <div><p className="account-map-eyebrow">계획 흐름</p><h2 id="account-map-canvas-title">전체 연결 지도</h2><p className="account-map-canvas-toolbar__help">월 계획 기준이며 실제 잔액·거래와 다를 수 있습니다.</p></div>
      <div className="account-map-canvas-toolbar__controls"><div className="account-map-zoom-control" role="group" aria-label="지도 확대 수준"><button type="button" aria-label="축소" disabled={zoom === 'overview'} onClick={() => changeZoom(-1)}>−</button><span>{zoomLabels[zoom]}</span><button type="button" aria-label="확대" disabled={zoom === 'detail'} onClick={() => changeZoom(1)}>＋</button></div></div>
    </header>
    <div ref={canvasRef} className="account-map-canvas account-flow-canvas" data-direction={positioned.direction} style={{ height: positioned.height }} onPointerDown={startPan} onPointerMove={movePan} onPointerUp={endPan} onPointerCancel={() => { panDragRef.current = null; }}>
      <FlowCanvasContent positioned={positioned} viewModel={viewModel} pinnedId={interaction.pinnedNodeId} activeId={activeId} pan={pan}
        onTransient={(id) => { if (dismissedPreviewId.current !== id) { dismissedPreviewId.current = null; onTransient(id); } }}
        onBlur={(id) => { if (dismissedPreviewId.current === id) dismissedPreviewId.current = null; onBlur(id); }}
        onInvoke={(id) => { dismissedPreviewId.current = null; onInvoke(id); }} />
      {activeId === null ? null : <AccountFlowDetail className={pinned ? 'is-pinned' : 'is-transient'} accountLabel={accountLabel} groups={viewModel.detailGroups} interactive={pinned} onEditLocation={selectedAccountId === null ? undefined : (trigger) => onEditLocation?.(selectedAccountId, trigger)} onAddTransfer={selectedAccountId === null ? undefined : () => onAddTransfer?.(selectedAccountId)} onEditTransfer={onEditTransfer} />}
    </div>
    <FlowLinearTable rows={viewModel.tableRows} />
  </section>;
}

function FlowCanvasContent({ positioned, viewModel, pinnedId, activeId, pan, onTransient, onBlur, onInvoke }: {
  positioned: ReturnType<typeof layoutAccountFlow>;
  viewModel: AccountFlowViewModel;
  pinnedId: string | null;
  activeId: string | null;
  pan: { x: number; y: number };
  onTransient(nodeId: string): void;
  onBlur(nodeId: string): void;
  onInvoke(nodeId: string): void;
}): JSX.Element {
  const dimmedNodes = new Set(viewModel.dimmedNodeIds);
  const dimmedEdges = new Set(viewModel.dimmedEdgeIds);
  const visibleAmounts = new Set(viewModel.visibleEdgeAmountIds);
  const nodeById = new Map<string, PositionedAccountFlowNode>(positioned.nodes.map((node) => [node.id, node]));
  const focusIndex = new Map(positioned.focusOrder.map((id, index) => [id, index]));
  return <div className="account-map-canvas__content" style={{ width: positioned.width, height: positioned.height, transform: `translate(${pan.x}px, ${pan.y}px)` }}>
    <svg className="account-map-edges account-flow-edges" aria-hidden="true"><defs><marker id="account-flow-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M 0 0 L 8 4 L 0 8 z" /></marker></defs></svg>
    {positioned.edges.filter((edge) => visibleAmounts.has(edge.id)).map((edge) => <span key={`amount:${edge.id}`} data-account-flow-edge-amount className="account-map-edge-amount account-flow-edge-amount" style={edgeAmountPosition(edge)}>{edge.kind === 'sweep' ? `남은 금액 전부 · 계획상 ${formatWon(edge.amountWon)}` : formatWon(edge.amountWon)}</span>)}
    {positioned.focusOrder.map((id) => {
      const node = nodeById.get(id)!;
      const outgoing = positioned.edges.filter((edge) => edge.sourceId === id)
        .sort((left, right) => (focusIndex.get(left.targetId) ?? 0) - (focusIndex.get(right.targetId) ?? 0) || left.id.localeCompare(right.id));
      return <Fragment key={id}>
        <FlowNode node={node} dimmed={dimmedNodes.has(id)} pinned={pinnedId === id} onTransient={onTransient} onBlur={onBlur} onInvoke={onInvoke} />
        <svg className="account-map-edges account-flow-edges" viewBox={`0 0 ${positioned.width} ${positioned.height}`} preserveAspectRatio="none">
          {outgoing.map((edge) => <FlowEdge key={edge.id} edge={edge} directionLabel={`${node.label} → ${nodeById.get(edge.targetId)?.label ?? edge.targetId}`} dimmed={dimmedEdges.has(edge.id)} focused={activeId !== null && viewModel.reachableEdgeIds.includes(edge.id)} onTransient={onTransient} onBlur={onBlur} onInvoke={onInvoke} />)}
        </svg>
      </Fragment>;
    })}
  </div>;
}

function FlowEdge({ edge, directionLabel, dimmed, focused, onTransient, onBlur, onInvoke }: { edge: RoutedAccountFlowEdge; directionLabel: string; dimmed: boolean; focused: boolean; onTransient(nodeId: string): void; onBlur(nodeId: string): void; onInvoke(nodeId: string): void }): JSX.Element {
  const interactive = edge.kind === 'fixed' || edge.kind === 'sweep';
  return <g className="account-flow-edge-control">
    <path d={edgePath(edge)} data-account-flow-edge aria-hidden="true" markerEnd={interactive ? 'url(#account-flow-arrow)' : undefined} className={`account-flow-edge account-flow-edge--${edge.kind}${edge.status === 'suspended' ? ' is-suspended' : ''}${dimmed ? ' is-dimmed' : ''}${focused ? ' is-focused' : ''}`} />
    {!interactive ? null : <path d={edgePath(edge)} data-account-flow-edge-hit className="account-flow-edge-hit" role="button" tabIndex={0} aria-label={`${directionLabel}, ${transferAccessibleName(edge)}`} onFocus={() => onTransient(edge.id)} onBlur={() => onBlur(edge.id)} onPointerEnter={(event) => { if (event.pointerType !== 'touch') onTransient(edge.id); }} onPointerLeave={() => onBlur(edge.id)} onClick={() => onInvoke(edge.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onInvoke(edge.id); } }} />}
  </g>;
}

function FlowNode({ node, dimmed, pinned, onTransient, onBlur, onInvoke }: { node: PositionedAccountFlowNode; dimmed: boolean; pinned: boolean; onTransient(nodeId: string): void; onBlur(nodeId: string): void; onInvoke(nodeId: string): void }): JSX.Element {
  return <button type="button" className={`account-map-node account-flow-node account-flow-node--${node.kind}${dimmed ? ' is-dimmed' : ''}${pinned ? ' is-pinned' : ''} is-${node.status}`} style={{ left: node.x, top: node.y, width: node.width, height: node.height }} aria-label={nodeAccessibleName(node)} onPointerEnter={(event) => { if (event.pointerType !== 'touch') onTransient(node.id); }} onPointerLeave={() => onBlur(node.id)} onFocus={() => onTransient(node.id)} onBlur={() => onBlur(node.id)} onClick={() => onInvoke(node.id)}><span>{node.label}</span>{node.kind === 'purpose' || node.kind === 'warning' ? <strong>{formatWon(node.amountWon)}</strong> : null}{node.kind === 'account' ? <small>{node.status === 'shortfall' ? '계획상 부족' : node.status === 'unassigned' ? '계획상 미배정' : '월 계획 계좌'}</small> : null}</button>;
}

function FlowLinearTable({ rows }: { rows: AccountFlowViewModel['tableRows'] }): JSX.Element {
  return <table className="sr-only account-map-linear-table" aria-label="계좌 흐름 읽기 표"><thead><tr><th>출발</th><th>도착</th><th>규칙·금액</th><th>상태</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.sourceLabel}:${row.targetLabel}:${index}`}><td>{row.sourceLabel}</td><td>{row.targetLabel}</td><td>{tableRule(row.kind, row.amountWon)}</td><td>{row.statusLabel}</td></tr>)}</tbody></table>;
}

function selectionForId(id: string | null): AccountFlowSelection {
  if (id === null) return null;
  if (id.startsWith('account:')) return { type: 'account', locationId: id.slice('account:'.length) };
  if (id.startsWith('purpose:')) return { type: 'purpose', purposeId: id.slice('purpose:'.length) as PurposeId };
  if (id.startsWith('transfer:')) return { type: 'transfer', transferId: id.slice('transfer:'.length) };
  return null;
}
function selectedAccountLocationId(id: string | null, edges: readonly AccountFlowEdge[]): string | null {
  if (id?.startsWith('account:')) return id.slice('account:'.length);
  if (!id?.startsWith('transfer:')) return null;
  const edge = edges.find((candidate) => candidate.id === id);
  return edge?.kind === 'fixed' || edge?.kind === 'sweep' ? edge.sourceId.slice('account:'.length) : null;
}
function edgePath(edge: RoutedAccountFlowEdge): string { return edge.points.map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' '); }
function edgeAmountPosition(edge: RoutedAccountFlowEdge): { left: number; top: number } { const middle = edge.points[Math.floor(edge.points.length / 2)] ?? edge.points[0]!; return { left: middle.x, top: middle.y }; }
function nodeAccessibleName(node: PositionedAccountFlowNode): string {
  if (node.kind === 'account') return `계좌 ${node.label}, ${node.status === 'shortfall' ? '계획상 부족' : node.status === 'unassigned' ? '계획상 미배정' : '월 계획 계좌'}. 선택하면 연결 흐름을 자세히 봅니다.`;
  if (node.kind === 'purpose') return `목적 ${node.label}, 월 계획 ${formatWon(node.amountWon)}. 선택하면 연결 흐름을 자세히 봅니다.`;
  if (node.kind === 'external-income') return '외부 수입. 선택하면 연결 흐름을 자세히 봅니다.';
  return `${node.label}, ${formatWon(node.amountWon)}. 확인이 필요한 월 계획 상태입니다.`;
}
function transferAccessibleName(edge: Extract<AccountFlowEdge, { kind: 'fixed' | 'sweep' }>): string { return `${edge.ruleLabel} 계좌 흐름, ${edge.status === 'active' ? '연결됨' : '중지됨'}. 선택하면 흐름을 자세히 봅니다.`; }
function tableRule(kind: AccountFlowViewModel['tableRows'][number]['kind'], amountWon: number): string { if (kind === 'sweep') return `남은 금액 전부 · 계획상 ${formatWon(amountWon)}`; if (kind === 'fixed') return `고정 금액 · ${formatWon(amountWon)}`; return formatWon(amountWon); }
function targetIsFlowControl(target: EventTarget | null): boolean { return target instanceof Element && target.closest('.account-flow-node, [data-account-flow-edge-hit], .account-flow-detail') !== null; }
function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
