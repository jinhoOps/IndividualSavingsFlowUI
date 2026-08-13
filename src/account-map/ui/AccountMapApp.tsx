import { useEffect, useMemo, useReducer, useRef, type JSX } from 'react';
import { AppShell } from '../../components/common/AppShell';
import { appPath } from '../../journey/routes';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { bootstrapAccountMap } from '../application/bootstrap';
import { accountMapReducer } from '../application/reducer';
import type { AccountMapDraft, PurposeId, PurposeLocationLink } from '../domain/model';
import { recalculateRemainder, reconcilePurpose } from '../domain/reconciliation';
import { BrowserAccountMapRepository, type AccountMapRepository, type AccountMapWriteResult } from '../infrastructure/accountMapRepository';
import { BrowserAccountMapMainSourceRepository, type AccountMapMainSourceRepository } from '../infrastructure/mainSourceRepository';
import { AccountMapManagementMenu } from './AccountMapManagementMenu';
import { AccountMapCanvas } from './AccountMapCanvas';
import { AccountMapSetup } from './AccountMapSetup';
import './account-map.css';

export interface AccountMapRepositories { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository }
export function AccountMapApp({ repositories }: { repositories?: AccountMapRepositories } = {}): JSX.Element {
  const resolved = useMemo<AccountMapRepositories>(() => repositories ?? { accountMap: new BrowserAccountMapRepository(), main: new BrowserAccountMapMainSourceRepository() }, [repositories]);
  const [state, dispatch] = useReducer(accountMapReducer, undefined, () => bootstrapAccountMap(resolved.main.load(), resolved.accountMap.load()));
  const pendingModalWorkspaceRef = useRef<WorkspaceDocument | null>(null);

  useEffect(() => {
    if (state.mode !== 'migrating') return;
    let active = true;
    void resolved.accountMap.migrate(state.revision).then((result) => {
      if (!active) return;
      if (result.status === 'saved') dispatch({ type: 'migration-succeeded', workspace: result.workspace });
      else if (result.status === 'conflict') {
        const current = resolved.accountMap.load();
        if (current.status === 'found' && !current.needsMigration) {
          dispatch({ type: 'migration-succeeded', workspace: current.workspace });
        } else {
          dispatch({ type: 'migration-failed', reason: failureReason(result) });
        }
      } else dispatch({ type: 'migration-failed', reason: failureReason(result) });
    });
    return () => { active = false; };
  }, [resolved.accountMap, state.mode === 'migrating' ? state.revision : -1]);

  const stateWorkspace = state.mode === 'setup' || state.mode === 'map' || state.mode === 'migrating'
    ? state.workspace
    : null;
  const hasLegacy = stateWorkspace !== null
    && (stateWorkspace.accountMap.legacyPhaseA.instruments.length > 0
      || stateWorkspace.accountMap.legacyPhaseA.flows.length > 0);
  const management = <AccountMapManagementMenu
    hasMap={state.mode === 'map'}
    hasLegacy={hasLegacy}
    onReset={async () => {
      if (state.mode !== 'map' && state.mode !== 'setup') return false;
      const result = await resolved.accountMap.reset(state.workspace.revision);
      if (result.status !== 'saved') {
        dispatch({ type: 'save-failed', reason: failureReason(result) });
        return false;
      }
      if (state.mode === 'map') dispatch({ type: 'reset-succeeded', workspace: result.workspace });
      else dispatch({ type: 'setup-cancelled', workspace: result.workspace });
      return true;
    }}
  />;
  if (state.mode === 'main-required') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="월 자금 계획이 먼저 필요해요"><p>Main의 다섯 월 금액을 만든 뒤 계좌 연결 지도를 시작할 수 있습니다.</p><a className="ui-button ui-button--primary" href={appPath('main')}>월 자금 계획 만들기</a></MessagePage></AppShell>;
  if (state.mode === 'invalid') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="저장된 데이터가 올바르지 않아요"><p>현재 데이터는 변경하지 않았습니다. Main 관리 메뉴에서 백업을 확인해 주세요.</p></MessagePage></AppShell>;
  if (state.mode === 'unavailable') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="저장소를 불러오지 못했어요"><p>브라우저 저장소 사용 가능 여부를 확인한 뒤 다시 시도해 주세요.</p></MessagePage></AppShell>;
  if (state.mode === 'migrating') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="계좌 연결을 준비하고 있어요"><p role="status">기존 데이터를 안전하게 옮기는 중입니다.</p></MessagePage></AppShell>;
  if (state.mode === 'map') return <AppShell currentApp="account-map" managementMenu={management}><main className="account-map-page account-map-page--map"><header className="account-map-map-header"><div><p className="account-map-eyebrow">계좌 연결</p><h1>계좌 연결 지도</h1><p>Main의 월 금액은 읽기만 합니다. 노드를 한 번 누르면 연결에 집중합니다.</p></div></header><AccountMapCanvas applied={state.applied} main={state.main} locations={state.workspace.locations} interaction={state.interaction} onTransient={(nodeId) => dispatch({ type: 'node-hovered', nodeId })} onBlur={(nodeId) => dispatch({ type: 'node-blurred', nodeId })} onInvoke={(nodeId) => dispatch({ type: 'node-invoked', nodeId })} onBackground={() => dispatch({ type: 'map-background-invoked' })} onModalClose={() => {
    const pending = pendingModalWorkspaceRef.current;
    pendingModalWorkspaceRef.current = null;
    if (pending !== null) dispatch({ type: 'save-succeeded', workspace: pending });
    dispatch({ type: 'modal-closed' });
  }} onArchiveLocation={async (locationId, replacementRemainderByPurpose) => {
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'archive-location', locationId, replacementRemainderByPurpose });
    if (result.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(result) }); return false; }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onRestoreLocation={async (locationId, restoreLinkIds, remainderByPurpose) => {
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'restore-location', locationId, restoreLinkIds, remainderByPurpose });
    if (result.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(result) }); return false; }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onLayoutChange={(layout) => {
    if (layout === state.applied.layout) return;
    const applied = { ...state.applied, layout, updatedAt: Date.now() };
    dispatch({ type: 'layout-changed', layout });
    dispatch({ type: 'save-requested' });
    void resolved.accountMap.save(state.workspace.revision, { type: 'apply-map', applied }).then((result) => {
      if (result.status === 'saved') dispatch({ type: 'save-succeeded', workspace: result.workspace });
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
    });
  }} /></main></AppShell>;

  async function saveDraft(draft: AccountMapDraft): Promise<boolean> {
    if (state.mode !== 'setup') return false;
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'save-draft', draft });
    if (result.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(result) }); return false; }
    dispatch({ type: 'draft-updated', draft });
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    return true;
  }

  async function commitConnection(input: { purposeId: PurposeId; locationId: string; newLocation?: FinancialLocation; monthlyAmountWon?: number; restoreLocation?: boolean }): Promise<boolean> {
    if (state.mode !== 'setup') return false;
    let workspace = state.workspace;
    const now = Date.now();
    const current = state.draft ?? { schemaVersion: 1, sourceMainUpdatedAt: state.main.updatedAt, customPurposes: [], links: [], step: 'connect', updatedAt: now };
    dispatch({ type: 'save-requested' });
    if (input.restoreLocation === true) {
      const restored = await resolved.accountMap.save(workspace.revision, { type: 'restore-location', locationId: input.locationId, restoreLinkIds: [], remainderByPurpose: {} });
      if (restored.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(restored) }); return false; }
      workspace = restored.workspace;
      dispatch({ type: 'save-succeeded', workspace });
    }
    if (input.newLocation !== undefined) {
      const locationResult = await resolved.accountMap.save(workspace.revision, { type: 'create-location', location: input.newLocation });
      if (locationResult.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(locationResult) }); return false; }
      workspace = locationResult.workspace;
      dispatch({ type: 'save-succeeded', workspace });
    }
    const requiredRole = roleFor(input.purposeId, current);
    const existing = workspace.locations.find(({ id }) => id === input.locationId);
    if (existing !== undefined && !existing.roles.includes(requiredRole)) {
      const updated = await resolved.accountMap.save(workspace.revision, { type: 'update-location', locationId: existing.id, ...(existing.institution === undefined ? {} : { institution: existing.institution }), shortName: existing.shortName, addRoles: [requiredRole] });
      if (updated.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(updated) }); return false; }
      workspace = updated.workspace;
      dispatch({ type: 'save-succeeded', workspace });
    }
    const locations = workspace.locations;
    const links = current.links.filter((link) => link.purposeId === input.purposeId && link.status === 'active');
    const target = reconcilePurpose(input.purposeId, current, locations, state.main).targetWon;
    const link: PurposeLocationLink = { id: `link:${createId()}`, purposeId: input.purposeId, locationId: input.locationId, monthlyAmountWon: links.length === 0 ? target : input.monthlyAmountWon ?? 0, remainder: links.length === 0, status: 'active', createdAt: now, updatedAt: now };
    let nextLinks = [...current.links, link];
    if (links.length > 0) {
      const remainder = links.find(({ remainder }) => remainder) ?? links[0];
      const recalculated = recalculateRemainder(input.purposeId, remainder!.id, target, nextLinks);
      if (!recalculated.ok) return false;
      nextLinks = recalculated.links;
    }
    const nextDraft: AccountMapDraft = { ...current, sourceMainUpdatedAt: state.main.updatedAt, links: nextLinks, updatedAt: now };
    const draftResult = await resolved.accountMap.save(workspace.revision, { type: 'save-draft', draft: nextDraft });
    if (draftResult.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(draftResult) }); return false; }
    dispatch({ type: 'draft-updated', draft: nextDraft });
    dispatch({ type: 'save-succeeded', workspace: draftResult.workspace });
    return true;
  }

  async function applyMap() {
    if (state.mode !== 'setup' || state.draft === null) return;
    const now = Date.now();
    const applied = { schemaVersion: 1 as const, sourceMainUpdatedAt: state.main.updatedAt, customPurposes: state.draft.customPurposes, links: state.draft.links, layout: 'purpose' as const, setupCompletedAt: now, updatedAt: now };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'apply-map', applied });
    if (result.status !== 'saved') { dispatch({ type: 'save-failed', reason: failureReason(result) }); return; }
    dispatch({ type: 'apply-succeeded', applied, workspace: result.workspace });
  }

  return <AppShell currentApp="account-map" managementMenu={management}><main className="account-map-page"><AccountMapSetup workspace={state.workspace} main={state.main} draft={state.draft} step={state.step} mainChanged={state.mainChanged} saveFailed={state.save.status === 'failed'} onCommitConnection={commitConnection} onSaveDraft={saveDraft} onReview={() => dispatch({ type: 'review-requested' })} onBack={() => dispatch({ type: 'connect-requested' })} onApply={() => void applyMap()} onExit={() => dispatch({ type: 'setup-exited' })} onCancelSetup={() => { void resolved.accountMap.reset(state.workspace.revision).then((result) => { if (result.status === 'saved') dispatch({ type: 'setup-cancelled', workspace: result.workspace }); else dispatch({ type: 'save-failed', reason: failureReason(result) }); }); }} /></main></AppShell>;
}

function MessagePage({ title, children }: { title: string; children: React.ReactNode }) { return <main className="account-map-page"><section className="account-map-message"><h1>{title}</h1>{children}</section></main>; }
function failureReason(result: Exclude<AccountMapWriteResult, { status: 'saved' }>) { return result.status === 'conflict' ? 'conflict' : result.status === 'invalid' ? 'invalid' : result.status === 'rejected' ? 'rejected' : 'unavailable'; }
function createId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function roleFor(purposeId: PurposeId, draft: AccountMapDraft) { const root = purposeId.startsWith('custom:') ? draft.customPurposes.find(({ id }) => id === purposeId)?.parentId : purposeId; return root === 'system:income' ? 'income' as const : root === 'system:saving' ? 'saving' as const : root === 'system:investing' ? 'investing' as const : 'spending' as const; }
