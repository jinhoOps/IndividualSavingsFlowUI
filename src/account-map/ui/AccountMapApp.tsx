import { useEffect, useMemo, useReducer, useRef, useState, type JSX } from 'react';
import { AppShell } from '../../components/common/AppShell';
import { appPath } from '../../journey/routes';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { bootstrapAccountMap } from '../application/bootstrap';
import { accountMapReducer, type ManualRecoveryAction, type ManualRecoveryTarget } from '../application/reducer';
import { rebaseAccountMapIntent, type AccountMapEditIntent } from '../domain/editIntent';
import type { AccountMapDraft, OutflowPurposeId, PurposeId, PurposeLocationLink } from '../domain/model';
import { customPurposeTargetCapacity, recalculateRemainder, reconcilePurpose } from '../domain/reconciliation';
import { BrowserAccountMapRepository, type AccountMapRepository, type AccountMapWriteResult } from '../infrastructure/accountMapRepository';
import { BrowserAccountMapMainSourceRepository, type AccountMapMainSourceRepository } from '../infrastructure/mainSourceRepository';
import { AccountMapManagementMenu } from './AccountMapManagementMenu';
import { AccountMapCanvas } from './AccountMapCanvas';
import { AccountMapModal, type AccountMapNodeEditInput } from './AccountMapModal';
import { AccountMapSetup } from './AccountMapSetup';
import './account-map.css';

export interface AccountMapRepositories { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository }
export function AccountMapApp({ repositories }: { repositories?: AccountMapRepositories } = {}): JSX.Element {
  const resolved = useMemo<AccountMapRepositories>(() => repositories ?? { accountMap: new BrowserAccountMapRepository(), main: new BrowserAccountMapMainSourceRepository() }, [repositories]);
  const [state, dispatch] = useReducer(accountMapReducer, undefined, () => bootstrapAccountMap(resolved.main.load(), resolved.accountMap.load()));
  const pendingModalWorkspaceRef = useRef<WorkspaceDocument | null>(null);
  const pendingModalRecoveryRef = useRef(false);
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const [restorePurposeId, setRestorePurposeId] = useState<`custom:${string}` | null>(null);

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
  const restoringPurpose = state.mode === 'map' && restorePurposeId !== null
    ? state.applied.customPurposes.find(({ id }) => id === restorePurposeId && state.applied.customPurposes.some((candidate) => candidate.id === id && candidate.archivedAt !== undefined))
    : undefined;
  const management = <AccountMapManagementMenu
    hasMap={state.mode === 'map'}
    hasLegacy={hasLegacy}
    mutationsDisabled={(state.mode === 'map' || state.mode === 'setup') && state.recovery.status !== 'none'}
    archivedPurposes={state.mode === 'map' ? state.applied.customPurposes.filter(({ archivedAt }) => archivedAt !== undefined).map((purpose) => ({ id: purpose.id, name: purpose.name, parentName: purposeParentLabel(purpose.parentId), targetMonthlyWon: purpose.targetMonthlyWon })) : []}
    onRestorePurpose={(purposeId) => {
      if (state.mode !== 'map' || state.recovery.status !== 'none') return;
      restoreFocusElementRef.current = document.querySelector<HTMLElement>('.journey-launcher__management-trigger');
      setRestorePurposeId(purposeId);
    }}
    onReset={async () => {
      if (state.mode !== 'map' && state.mode !== 'setup') return false;
      if (state.recovery.status !== 'none') return false;
      const result = await resolved.accountMap.reset(state.workspace.revision);
      if (result.status !== 'saved') {
        if (result.status === 'conflict') { captureManualConflict('reset-map', []); return true; }
        else dispatch({ type: 'save-failed', reason: failureReason(result) });
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
  if (state.mode === 'map') return <AppShell currentApp="account-map" managementMenu={management}><main className="account-map-page account-map-page--map"><header className="account-map-map-header"><div><p className="account-map-eyebrow">계좌 연결</p><h1>계좌 연결 지도</h1><p>Main의 월 금액은 읽기만 합니다. 노드를 한 번 누르면 연결에 집중합니다.</p></div></header><AccountMapCanvas applied={state.applied} main={state.main} locations={state.workspace.locations} interaction={state.interaction} recovery={state.recovery} recoveryPending={state.save.status === 'pending'} saveFailed={state.save.status === 'failed'} hasExternalModal={restoringPurpose !== undefined} onReapply={reapplyIntent} onKeepLatest={() => dispatch({ type: 'latest-kept' })} onTransient={(nodeId) => dispatch({ type: 'node-hovered', nodeId })} onBlur={(nodeId) => dispatch({ type: 'node-blurred', nodeId })} onInvoke={(nodeId) => dispatch({ type: 'node-invoked', nodeId })} onBackground={() => dispatch({ type: 'map-background-invoked' })} onEscape={() => dispatch({ type: 'escape-invoked' })} onModalClose={() => {
    const pending = pendingModalWorkspaceRef.current;
    pendingModalWorkspaceRef.current = null;
    const recovered = pendingModalRecoveryRef.current;
    pendingModalRecoveryRef.current = false;
    if (pending !== null) dispatch({ type: recovered ? 'reapply-succeeded' : 'save-succeeded', workspace: pending });
    dispatch({ type: 'modal-closed' });
  }} onSaveNodeEdit={async (nodeId, input) => {
    if (state.recovery.status !== 'none') return false;
    const result = await saveNodeEdit(nodeId, input);
    if (result.status !== 'saved') {
      if (result.status !== 'conflict') dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onConnectLocation={async (purposeId, locationId, monthlyAmountWon) => {
    if (state.recovery.status !== 'none') return false;
    const restoresArchivedLocation = state.workspace.locations.some(({ id, archivedAt }) => (
      id === locationId && archivedAt !== undefined
    ));
    const intent: AccountMapEditIntent = {
      kind: 'add-link', surface: 'applied', purposeId: purposeId as PurposeId, locationId, base: null,
      ...(monthlyAmountWon === undefined ? {} : { monthlyAmountWon }),
    };
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: restoresArchivedLocation ? 'restore-and-connect-location' : 'connect-location',
      surface: 'applied', purposeId: purposeId as PurposeId, locationId,
      ...(monthlyAmountWon === undefined ? {} : { monthlyAmountWon }),
    });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        if (restoresArchivedLocation) captureManualConflict('connection-prerequisite', []);
        else captureIntentConflict(intent);
      }
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onCreateAndConnectLocation={async (purposeId, location, monthlyAmountWon) => {
    if (state.recovery.status !== 'none') return false;
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'create-and-connect-location', surface: 'applied', purposeId: purposeId as PurposeId, location,
      ...(monthlyAmountWon === undefined ? {} : { monthlyAmountWon }),
    });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') captureManualConflict('connection-prerequisite', []);
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onArchivePurpose={async (purposeId) => {
    if (state.recovery.status !== 'none') return false;
    const purpose = state.applied.customPurposes.find(({ id }) => id === purposeId);
    if (purpose === undefined || purpose.archivedAt !== undefined) return false;
    const base = { name: purpose.name, targetMonthlyWon: purpose.targetMonthlyWon, archivedAt: purpose.archivedAt };
    const intent: AccountMapEditIntent = { kind: 'purpose', id: purpose.id, edit: { base, next: { ...base, archivedAt: Date.now() } } };
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'archive-custom-purpose', purposeId });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') captureIntentConflict(intent);
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onArchiveLocation={async (locationId, replacementRemainderByPurpose) => {
    if (state.recovery.status !== 'none') return false;
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'archive-location', locationId, replacementRemainderByPurpose });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') captureManualConflict('archive-location', [
        { kind: 'location', id: locationId },
        ...manualLinkTargets(Object.values(replacementRemainderByPurpose), 'link'),
      ]);
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onRestoreLocation={async (locationId, restoreLinkIds, remainderByPurpose) => {
    if (state.recovery.status !== 'none') return false;
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'restore-location', locationId, restoreLinkIds, remainderByPurpose });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        const restored = new Set(restoreLinkIds);
        captureManualConflict('restore-location', [
          { kind: 'location', id: locationId },
          ...manualLinkTargets(restoreLinkIds, 'restorable-link'),
          ...manualLinkTargets(Object.values(remainderByPurpose).filter((id) => id !== null && !restored.has(id)), 'link'),
        ]);
      }
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
    return true;
  }} onLayoutChange={(layout) => {
    if (layout === state.applied.layout || state.recovery.status !== 'none') return;
    const applied = { ...state.applied, layout, updatedAt: Date.now() };
    dispatch({ type: 'layout-changed', layout });
    dispatch({ type: 'save-requested' });
    void resolved.accountMap.save(state.workspace.revision, { type: 'apply-map', applied }).then((result) => {
      if (result.status === 'saved') dispatch({ type: 'save-succeeded', workspace: result.workspace });
      else if (result.status === 'conflict') captureManualConflict('layout-change', []);
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
    });
  }} />{restoringPurpose === undefined ? null : <AccountMapModal
    initialMode="restore-purpose"
    node={{
      id: restoringPurpose.id,
      kind: 'purpose',
      label: restoringPurpose.name,
      amountWon: restoringPurpose.targetMonthlyWon,
      connectionCount: state.applied.links.filter(({ purposeId, status }) => purposeId === restoringPurpose.id && status === 'active').length,
      status: 'suspended',
    }}
    related={state.applied.links.filter(({ purposeId }) => purposeId === restoringPurpose.id).map((link) => ({
      label: state.workspace.locations.find(({ id }) => id === link.locationId)?.shortName ?? '연결',
      amountWon: link.monthlyAmountWon,
      status: link.status,
      linkId: link.id,
      purposeId: link.purposeId,
      locationId: link.locationId,
      remainder: link.remainder,
    }))}
    sourceElement={null}
    fallbackElement={restoreFocusElementRef.current}
    reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches}
    recovery={state.recovery}
    recoveryPending={state.save.status === 'pending'}
    saveFailed={state.save.status === 'failed'}
    purposeParentLabel={purposeParentLabel(restoringPurpose.parentId)}
    purposeTargetCapacityWon={customPurposeTargetCapacity(restoringPurpose.parentId, state.applied.customPurposes, state.main, restoringPurpose.id)}
    onReapply={reapplyIntent}
    onKeepLatest={() => dispatch({ type: 'latest-kept' })}
    onClose={() => {
      const pending = pendingModalWorkspaceRef.current;
      pendingModalWorkspaceRef.current = null;
      const recovered = pendingModalRecoveryRef.current;
      pendingModalRecoveryRef.current = false;
      if (pending !== null) dispatch({ type: recovered ? 'reapply-succeeded' : 'save-succeeded', workspace: pending });
      setRestorePurposeId(null);
    }}
    onRestorePurpose={async (purposeId, targetMonthlyWon) => {
      if (state.recovery.status !== 'none') return false;
      const purpose = state.applied.customPurposes.find(({ id }) => id === purposeId);
      if (purpose === undefined || purpose.archivedAt === undefined) return false;
      const base = { name: purpose.name, targetMonthlyWon: purpose.targetMonthlyWon, archivedAt: purpose.archivedAt };
      const intent: AccountMapEditIntent = { kind: 'purpose', id: purpose.id, edit: { base, next: { name: purpose.name, targetMonthlyWon, archivedAt: undefined } } };
      const result = await resolved.accountMap.save(state.workspace.revision, { type: 'restore-custom-purpose', purposeId, targetMonthlyWon });
      if (result.status !== 'saved') {
        if (result.status === 'conflict') captureIntentConflict(intent);
        else dispatch({ type: 'save-failed', reason: failureReason(result) });
        return false;
      }
      pendingModalWorkspaceRef.current = result.workspace;
      return true;
    }}
  />}</main></AppShell>;

  async function saveDraft(draft: AccountMapDraft): Promise<boolean> {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return false;
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'save-draft', draft });
    if (result.status !== 'saved') { if (result.status === 'conflict') captureManualConflict('save-draft', []); else dispatch({ type: 'save-failed', reason: failureReason(result) }); return false; }
    dispatch({ type: 'draft-updated', draft });
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    return true;
  }

  async function commitConnection(input: { purposeId: PurposeId; locationId: string; newLocation?: FinancialLocation; monthlyAmountWon?: number; restoreLocation?: boolean }): Promise<boolean> {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return false;
    dispatch({ type: 'save-requested' });
    const intent: AccountMapEditIntent = {
      kind: 'add-link',
      surface: 'draft',
      purposeId: input.purposeId,
      locationId: input.locationId,
      base: null,
      ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
    };
    const command = input.restoreLocation === true
      ? {
          type: 'restore-and-connect-location' as const,
          surface: 'draft' as const,
          purposeId: input.purposeId,
          locationId: input.locationId,
          ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
        }
      : input.newLocation === undefined
      ? {
          type: 'connect-location' as const,
          surface: 'draft' as const,
          purposeId: input.purposeId,
          locationId: input.locationId,
          ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
        }
      : {
          type: 'create-and-connect-location' as const,
          surface: 'draft' as const,
          purposeId: input.purposeId,
          location: input.newLocation,
          ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
        };
    const result = await resolved.accountMap.save(state.workspace.revision, command);
    if (result.status === 'conflict') {
      if (input.newLocation === undefined && input.restoreLocation !== true) captureIntentConflict(intent);
      else captureManualConflict('connection-prerequisite', []);
      return false;
    }
    if (result.status !== 'saved') {
      dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    const savedDraft = result.workspace.accountMap.draft;
    if (savedDraft !== null) dispatch({ type: 'draft-updated', draft: savedDraft });
    return true;
  }

  async function applyMap() {
    if (state.mode !== 'setup' || state.draft === null || state.recovery.status !== 'none') return;
    const now = Date.now();
    const applied = { schemaVersion: 1 as const, sourceMainUpdatedAt: state.main.updatedAt, customPurposes: state.draft.customPurposes, links: state.draft.links, layout: 'purpose' as const, setupCompletedAt: now, updatedAt: now };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'apply-map', applied });
    if (result.status !== 'saved') { if (result.status === 'conflict') captureManualConflict('apply-map', []); else dispatch({ type: 'save-failed', reason: failureReason(result) }); return; }
    dispatch({ type: 'apply-succeeded', applied, workspace: result.workspace });
  }

  async function saveNodeEdit(nodeId: string, input: AccountMapNodeEditInput): Promise<AccountMapWriteResult> {
    if (state.mode !== 'map' || state.recovery.status !== 'none') return { status: 'unavailable' };
    const editById = new Map(input.links.map((item) => [item.id, item]));
    const purposeByLinkId = new Map(state.applied.links.map((item) => [item.id, item.purposeId]));
    const intents: AccountMapEditIntent[] = [];
    const currentPurpose = nodeId.startsWith('custom:')
      ? state.applied.customPurposes.find(({ id }) => id === nodeId)
      : undefined;
    if (currentPurpose !== undefined) {
      const base = { name: currentPurpose.name, targetMonthlyWon: currentPurpose.targetMonthlyWon, archivedAt: currentPurpose.archivedAt };
      const next = { ...base, ...(input.label === undefined ? {} : { name: input.label }), ...(input.targetMonthlyWon === undefined ? {} : { targetMonthlyWon: input.targetMonthlyWon }) };
      if (JSON.stringify(base) !== JSON.stringify(next)) intents.push({ kind: 'purpose', id: currentPurpose.id, edit: { base, next } });
    }
    const rawLocationId = nodeId.startsWith('location:') ? nodeId.replace(/^location:/u, '') : null;
    const currentLocation = rawLocationId === null ? undefined : state.workspace.locations.find(({ id }) => id === rawLocationId);
    if (currentLocation !== undefined && input.label !== undefined && input.label !== currentLocation.shortName) {
      intents.push({
        kind: 'location', id: currentLocation.id,
        edit: {
          base: { shortName: currentLocation.shortName, institution: currentLocation.institution },
          next: { shortName: input.label, institution: currentLocation.institution },
        },
      });
    }
    let hasUnsupportedRemoval = false;
    for (const edit of input.links) {
      const current = state.applied.links.find(({ id }) => id === edit.id);
      if (current === undefined) continue;
      if (edit.status === 'removed') { hasUnsupportedRemoval = true; continue; }
      const base = { monthlyAmountWon: current.monthlyAmountWon, status: current.status, remainder: current.remainder };
      const next = { monthlyAmountWon: edit.monthlyAmountWon, status: edit.status, remainder: edit.remainder };
      if (JSON.stringify(base) !== JSON.stringify(next)) intents.push({ kind: 'link', id: current.id, edit: { base, next } });
    }
    if (!hasUnsupportedRemoval && intents.length === 1) {
      return await saveIntent(state.workspace.revision, intents[0]!);
    }
    const selectedRemainders = new Map<string, string>();
    for (const item of input.links) {
      const purposeId = purposeByLinkId.get(item.id);
      if (purposeId !== undefined && item.status === 'active' && item.remainder) selectedRemainders.set(purposeId, item.id);
    }
    const customPurposes = state.applied.customPurposes.map((purpose) => purpose.id !== nodeId ? purpose : {
      ...purpose,
      ...(input.label === undefined ? {} : { name: input.label }),
      ...(input.targetMonthlyWon === undefined ? {} : { targetMonthlyWon: input.targetMonthlyWon }),
      updatedAt: Date.now(),
    });
    let links = state.applied.links.flatMap((current): PurposeLocationLink[] => {
      const edit = editById.get(current.id);
      if (edit?.status === 'removed') return [];
      const selectedRemainder = selectedRemainders.get(current.purposeId);
      if (edit === undefined) {
        if (selectedRemainder === undefined || current.status === 'suspended') return [current];
        return [{ ...current, remainder: current.id === selectedRemainder, updatedAt: Date.now() }];
      }
      if (edit.status === 'suspended') return [{ ...current, monthlyAmountWon: edit.monthlyAmountWon, remainder: false as const, status: 'suspended' as const, suspendedReason: 'user' as const, updatedAt: Date.now() }];
      return [{ id: current.id, purposeId: current.purposeId, locationId: current.locationId, monthlyAmountWon: edit.monthlyAmountWon, remainder: selectedRemainder === undefined ? edit.remainder : current.id === selectedRemainder, status: 'active' as const, createdAt: current.createdAt, updatedAt: Date.now() }];
    });
    for (const [purposeId, remainderId] of selectedRemainders) {
      const target = reconcilePurpose(purposeId as PurposeId, { ...state.applied, customPurposes, links }, state.workspace.locations, state.main).targetWon;
      const recalculated = recalculateRemainder(purposeId as PurposeId, remainderId, target, links);
      if (recalculated.ok) links = recalculated.links;
    }
    const applied = { ...state.applied, links, customPurposes, updatedAt: Date.now() };
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'edit-map-node', applied,
      ...(currentLocation === undefined || input.label === undefined ? {} : {
        location: {
          locationId: currentLocation.id,
          ...(currentLocation.institution === undefined ? {} : { institution: currentLocation.institution }),
          shortName: input.label,
        },
      }),
    });
    if (result.status === 'conflict') {
      const latest = resolved.accountMap.load();
      if (latest.status === 'found') {
        dispatch({
          type: 'save-manual-conflicted', latest: latest.workspace,
          action: 'edit-node', targets: manualEditTargets(nodeId, intents, input),
          reason: hasUnsupportedRemoval ? 'removal' : 'compound-edit',
        });
      } else {
        dispatch({ type: 'save-failed', reason: latest.status === 'invalid' ? 'invalid' : 'unavailable' });
      }
    }
    return result;
  }

  return <AppShell currentApp="account-map" managementMenu={management}><main className="account-map-page"><AccountMapSetup workspace={state.workspace} main={state.main} draft={state.draft} step={state.step} mainChanged={state.mainChanged} saveFailed={state.save.status === 'failed'} recoveryPending={state.save.status === 'pending'} recovery={state.recovery} onReapply={reapplyIntent} onKeepLatest={() => dispatch({ type: 'latest-kept' })} onCommitConnection={commitConnection} onSaveDraft={saveDraft} onReview={() => void changeSetupStep('review')} onBack={() => void changeSetupStep('connect')} onApply={() => void applyMap()} onExit={() => { if (state.recovery.status !== 'none') return; dispatch({ type: 'setup-exited' }); window.location.assign(appPath('main')); }} onCancelSetup={() => { if (state.recovery.status !== 'none') return; void resolved.accountMap.reset(state.workspace.revision).then((result) => { if (result.status === 'saved') dispatch({ type: 'setup-cancelled', workspace: result.workspace }); else if (result.status === 'conflict') captureManualConflict('cancel-setup', []); else dispatch({ type: 'save-failed', reason: failureReason(result) }); }); }} /></main></AppShell>;

  async function saveIntent(expectedRevision: number, intent: AccountMapEditIntent): Promise<AccountMapWriteResult> {
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.saveIntent(expectedRevision, intent);
    if (result.status === 'saved') {
      dispatch({ type: 'save-succeeded', workspace: result.workspace });
      return result;
    }
    if (result.status === 'conflict') {
      captureIntentConflict(intent);
      return result;
    }
    dispatch({ type: 'save-failed', reason: failureReason(result) });
    return result;
  }

  async function reapplyIntent(): Promise<boolean> {
    if ((state.mode !== 'setup' && state.mode !== 'map') || state.recovery.status === 'none') return false;
    if (state.recovery.status === 'manual') {
      dispatch({ type: 'review-latest' });
      return false;
    }
    const { latest, intent } = state.recovery;
    if (latest.main.applied === null) {
      dispatch({ type: 'latest-kept' });
      return false;
    }
    dispatch({ type: 'reapply-requested' });
    const replayWorkspace = latest;
    const rebased = rebaseAccountMapIntent(replayWorkspace, intent);
    if (!rebased.ok) {
      dispatch({
        type: 'reapply-collided',
        field: 'field' in rebased ? rebased.field : recoveryFallbackField(intent),
        reason: rebased.reason,
      });
      return false;
    }
    const result = await resolved.accountMap.save(replayWorkspace.revision, rebased.command);
    if (result.status === 'saved') {
      if (state.mode === 'map' && (state.interaction.modalNodeId !== null || restorePurposeId !== null)) {
        pendingModalWorkspaceRef.current = result.workspace;
        pendingModalRecoveryRef.current = true;
        return true;
      }
      dispatch({ type: 'reapply-succeeded', workspace: result.workspace });
      return true;
    }
    if (result.status === 'conflict') {
      const newer = resolved.accountMap.load();
      if (newer.status === 'found') dispatch({ type: 'save-conflicted', latest: newer.workspace, intent });
      else dispatch({ type: 'save-failed', reason: newer.status === 'invalid' ? 'invalid' : 'unavailable' });
      return false;
    }
    if (result.status === 'rejected') {
      dispatch({ type: 'reapply-collided', latest: replayWorkspace, field: result.field ?? recoveryFallbackField(intent), reason: result.reason });
      return false;
    }
    dispatch({ type: 'recovery-latest-updated', latest: replayWorkspace });
    dispatch({ type: 'save-failed', reason: failureReason(result) });
    return false;
  }

  function captureIntentConflict(intent: AccountMapEditIntent): void {
    const latest = resolved.accountMap.load();
    if (latest.status === 'found') dispatch({ type: 'save-conflicted', latest: latest.workspace, intent });
    else dispatch({ type: 'save-failed', reason: latest.status === 'invalid' ? 'invalid' : 'unavailable' });
  }

  function captureManualConflict(action: ManualRecoveryAction, targets: ManualRecoveryTarget[], reason: 'compound-edit' | 'removal' = 'compound-edit'): void {
    const latest = resolved.accountMap.load();
    if (latest.status === 'found') dispatch({ type: 'save-manual-conflicted', latest: latest.workspace, action, targets, reason });
    else dispatch({ type: 'save-failed', reason: latest.status === 'invalid' ? 'invalid' : 'unavailable' });
  }

  async function changeSetupStep(step: AccountMapDraft['step']) {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return;
    if (state.draft === null) {
      dispatch({ type: step === 'review' ? 'review-requested' : 'connect-requested' });
      return;
    }
    await saveDraft({ ...state.draft, step, updatedAt: Date.now() });
  }
}

function MessagePage({ title, children }: { title: string; children: React.ReactNode }) { return <main className="account-map-page"><section className="account-map-message"><h1>{title}</h1>{children}</section></main>; }
function purposeParentLabel(parentId: OutflowPurposeId): string { return parentId === 'system:housing' ? '주거' : parentId === 'system:living' ? '생활비' : parentId === 'system:saving' ? '저축' : '투자'; }
function failureReason(result: Exclude<AccountMapWriteResult, { status: 'saved' }>) { return result.status === 'conflict' ? 'conflict' : result.status === 'invalid' ? 'invalid' : result.status === 'rejected' ? 'rejected' : 'unavailable'; }
function createId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function recoveryFallbackField(intent: AccountMapEditIntent): string { return intent.kind === 'add-link' ? 'locationId' : intent.kind === 'link' ? 'monthlyAmountWon' : intent.kind === 'purpose' ? 'name' : 'shortName'; }
function manualLinkTargets(ids: Array<string | null>, kind: 'link' | 'restorable-link'): ManualRecoveryTarget[] {
  return [...new Set(ids.filter((id): id is string => id !== null))].map((id) => ({ kind, id }));
}
function manualEditTargets(nodeId: string, intents: AccountMapEditIntent[], input: AccountMapNodeEditInput): ManualRecoveryTarget[] {
  const targets: ManualRecoveryTarget[] = [];
  for (const intent of intents) {
    if (intent.kind === 'link') targets.push({ kind: 'link', id: intent.id });
    else if (intent.kind === 'purpose') targets.push({ kind: 'node', id: intent.id });
    else if (intent.kind === 'location') targets.push({ kind: 'node', id: `location:${intent.id}` });
  }
  for (const item of input.links) if (item.status === 'removed') targets.push({ kind: 'link', id: item.id });
  if (targets.length === 0) targets.push({ kind: 'node', id: nodeId });
  return targets.filter((target, index) => targets.findIndex((candidate) => candidate.kind === target.kind && candidate.id === target.id) === index);
}
