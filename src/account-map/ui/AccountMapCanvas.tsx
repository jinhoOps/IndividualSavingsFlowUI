import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { MapInteractionState } from '../application/reducer';
import type { AccountMapApplied } from '../domain/model';
import { buildAccountMapGraph, layoutAccountMap, type MapZoom } from './mapLayout';

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
  onLayoutChange(layout: AccountMapApplied['layout']): void;
}

export function AccountMapCanvas({
  applied, main, locations, interaction, viewport,
  onTransient, onBlur, onInvoke, onBackground, onLayoutChange,
}: AccountMapCanvasProps): JSX.Element {
  const [zoom, setZoom] = useState<MapZoom>('default');
  const canvasRef = useRef<HTMLDivElement>(null);
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
  const graph = useMemo(() => buildAccountMapGraph(applied, locations, main, zoom), [applied, locations, main, zoom]);
  const positioned = useMemo(() => layoutAccountMap(graph, applied.layout, effectiveViewport, zoom), [graph, applied.layout, effectiveViewport.width, effectiveViewport.height, zoom]);
  const nodeById = new Map(positioned.nodes.map((node) => [node.id, node]));
  const focusedId = interaction.transientNodeId ?? interaction.pinnedNodeId;
  const connectedIds = new Set<string>(focusedId === null ? [] : positioned.edges.flatMap((edge) => (
    edge.purposeId === focusedId || edge.locationId === focusedId ? [edge.purposeId, edge.locationId] : []
  )));
  if (focusedId !== null) connectedIds.add(focusedId);

  function changeZoom(delta: number) {
    const index = zooms.indexOf(zoom);
    setZoom(zooms[Math.max(0, Math.min(zooms.length - 1, index + delta))]!);
  }

  return (
    <section className="account-map-canvas-shell" aria-labelledby="account-map-canvas-title">
      <header className="account-map-canvas-toolbar">
        <div><p className="account-map-eyebrow">연결 지도</p><h2 id="account-map-canvas-title">목적과 계좌의 연결</h2></div>
        <div className="account-map-layout-control" role="group" aria-label="지도 정렬">
          <button type="button" aria-pressed={applied.layout === 'purpose'} onClick={() => onLayoutChange('purpose')}>목적 중심</button>
          <button type="button" aria-pressed={applied.layout === 'account'} onClick={() => onLayoutChange('account')}>계좌 중심</button>
        </div>
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
        style={{ height: positioned.height }}
        onPointerDown={(event) => { if (event.target === event.currentTarget) onBackground(); }}
      >
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
            key={node.id}
            type="button"
            className={`account-map-node account-map-node--${node.kind} is-${node.status}${dimmed ? ' is-dimmed' : ''}${interaction.pinnedNodeId === node.id ? ' is-pinned' : ''}`}
            style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
            aria-label={`${node.label}${node.amountWon === undefined ? '' : ` · ${formatWon(node.amountWon)}`}${statusLabel(node.status)}`}
            onMouseEnter={() => onTransient(node.id)}
            onMouseLeave={() => onBlur(node.id)}
            onFocus={() => onTransient(node.id)}
            onBlur={() => onBlur(node.id)}
            onClick={() => onInvoke(node.id)}
          ><span>{node.label}</span>{node.amountWon === undefined ? null : <strong>{formatWon(node.amountWon)}</strong>}{node.secondary === undefined ? null : <small>{node.secondary}</small>}{node.status === 'unassigned' ? <small>연결 필요</small> : node.status === 'excess' ? <small>초과 연결</small> : null}</button>;
        })}
      </div>
      <table className="sr-only account-map-linear-table" tabIndex={0} aria-label="계좌 연결 읽기 표">
        <thead><tr>{applied.layout === 'purpose' ? <><th>목적</th><th>계좌·보관처</th></> : <><th>계좌·보관처</th><th>목적</th></>}<th>월 금액</th><th>상태</th></tr></thead>
        <tbody>{positioned.edges.map((edge) => {
          const purpose = nodeById.get(edge.purposeId);
          const location = nodeById.get(edge.locationId);
          if (purpose === undefined || location === undefined) return null;
          return <tr key={`row:${edge.id}`}>{applied.layout === 'purpose' ? <><td>{purpose.label}</td><td>{location.label}</td></> : <><td>{location.label}</td><td>{purpose.label}</td></>}<td>{formatWon(edge.amountWon)}</td><td>{edge.status === 'active' ? '연결됨' : '중지됨'}</td></tr>;
        })}</tbody>
      </table>
    </section>
  );
}

function statusLabel(status: string): string { return status === 'unassigned' ? ' · 연결 필요' : status === 'excess' ? ' · 초과 연결' : status === 'deficit' ? ' · 부족함' : ''; }
function formatWon(value: number): string { return `${new Intl.NumberFormat('ko-KR').format(value)}원`; }
