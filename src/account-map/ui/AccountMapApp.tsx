import { useEffect, useMemo, useReducer, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { AppContentFrame } from '../../components/common/AppContentFrame';
import { AppShell } from '../../components/common/AppShell';
import { Button } from '../../components/common/Button';
import { appPath } from '../../journey/routes';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { bootstrapAccountMap } from '../application/bootstrap';
import { accountMapReducer, type ManualRecoveryAction, type ManualRecoveryTarget } from '../application/reducer';
import { projectAccountMapSetup } from '../application/setupProjection';
import { rebaseAccountMapIntent, type AccountMapEditIntent } from '../domain/editIntent';
import type { AccountMapApplied, AccountMapAppliedV3, AccountMapDraft, AccountMapDraftV2, AccountMapSetupStep, OutflowPurposeId, PurposeId } from '../domain/model';
import type { AccountTransferEditorValue } from './AccountTransferEditor';
import type { AccountMapTransferSaveResult } from './setup/AccountMapTransfersStep';
import type { MainPlanEditTarget } from './setup/AccountMapBasisStep';
import { projectAccountMapAppliedForView, projectAccountMapDraftForView } from '../domain/accountMapVersioning';
import { customPurposeTargetCapacity, reconcilePurpose } from '../domain/reconciliation';
import { BrowserAccountMapRepository, type AccountMapRepository, type AccountMapWriteResult } from '../infrastructure/accountMapRepository';
import { BrowserAccountMapMainSourceRepository, type AccountMapMainSourceRepository } from '../infrastructure/mainSourceRepository';
import { AccountMapManagementMenu } from './AccountMapManagementMenu';
import { AccountMapCanvas } from './AccountMapCanvas';
import { AccountTransferEditor } from './AccountTransferEditor';
import { AccountMapModal, type AccountMapModalRelatedItem, type AccountMapNodeEditInput } from './AccountMapModal';
import { AccountMapSetup, type AccountMapDraftSaveResult } from './AccountMapSetup';
import './account-map.css';

export interface AccountMapRepositories { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository }
export interface AccountMapAppProps {
  repositories?: AccountMapRepositories;
  onRequestMainEdit?(target: MainPlanEditTarget): void;
  /** Journey host invalidates this after a successful Main-owned save. */
  refreshSignal?: number;
}
export function AccountMapApp({ repositories, onRequestMainEdit, refreshSignal }: AccountMapAppProps = {}): JSX.Element {
  const resolved = useMemo<AccountMapRepositories>(() => repositories ?? { accountMap: new BrowserAccountMapRepository(), main: new BrowserAccountMapMainSourceRepository() }, [repositories]);
  const [state, dispatch] = useReducer(accountMapReducer, undefined, () => bootstrapAccountMap(resolved.main.load(), resolved.accountMap.load()));
  const pendingModalWorkspaceRef = useRef<WorkspaceDocument | null>(null);
  const pendingModalRecoveryRef = useRef(false);
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const [restorePurposeId, setRestorePurposeId] = useState<`custom:${string}` | null>(null);
  const [restoreLocationId, setRestoreLocationId] = useState<string | null>(null);
  const [flowLocationEditorId, setFlowLocationEditorId] = useState<string | null>(null);
  const [flowTransferEditor, setFlowTransferEditor] = useState<{ mode: 'add'; sourceLocationId: string } | { mode: 'edit'; transferId: string } | null>(null);
  const handledRefreshSignal = useRef<number | undefined>(refreshSignal);
  const setupProjection = useMemo(() => state.mode !== 'setup'
    ? null
    : projectAccountMapSetup(state.main, state.workspace.locations, state.draft), [state]);

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

  useEffect(() => {
    if (refreshSignal === undefined || refreshSignal === handledRefreshSignal.current) return;
    handledRefreshSignal.current = refreshSignal;
    const workspace = resolved.accountMap.load();
    const main = resolved.main.load();
    if ((workspace.status !== 'found' && workspace.status !== 'empty') || main.status !== 'found') return;
    dispatch({ type: 'external-workspace-refreshed', workspace: workspace.workspace });
  }, [refreshSignal, resolved.accountMap, resolved.main]);

  const restoringPurpose = state.mode === 'map' && restorePurposeId !== null
    ? state.applied.customPurposes.find(({ id }) => id === restorePurposeId && state.applied.customPurposes.some((candidate) => candidate.id === id && candidate.archivedAt !== undefined))
    : undefined;
  const restoringLocation = (state.mode === 'map' || state.mode === 'setup') && restoreLocationId !== null
    ? state.workspace.locations.find(({ id, archivedAt }) => id === restoreLocationId && archivedAt !== undefined)
    : undefined;
  const locationRestoreState = state.mode === 'map'
    ? projectAccountMapAppliedForView(state.workspace.accountMap.applied ?? state.applied)
    : state.mode === 'setup' ? state.draft : null;
  const restoringLocationRelated = restoringLocation === undefined || locationRestoreState === null || (state.mode !== 'map' && state.mode !== 'setup')
    ? []
    : buildLocationRestoreRelated(restoringLocation.id, locationRestoreState, state.workspace.locations, state.main);
  const management = <AccountMapManagementMenu
    hasMap={state.mode === 'map'}
    mutationsDisabled={(state.mode === 'map' || state.mode === 'setup') && state.recovery.status !== 'none'}
    archivedPurposes={state.mode === 'map' ? state.applied.customPurposes.filter(({ archivedAt }) => archivedAt !== undefined).map((purpose) => ({ id: purpose.id, name: purpose.name, parentName: purposeParentLabel(purpose.parentId), targetMonthlyWon: purpose.targetMonthlyWon })) : []}
    archivedLocations={state.mode === 'map' || state.mode === 'setup' ? state.workspace.locations.filter(({ archivedAt }) => archivedAt !== undefined).map((location) => ({ id: location.id, shortName: location.shortName, institutionName: location.institution?.name ?? (location.kind === 'cash' ? '직접 보관' : '기관 없음') })) : []}
    onRestorePurpose={(purposeId) => {
      if (state.mode !== 'map' || state.recovery.status !== 'none') return;
      restoreFocusElementRef.current = document.querySelector<HTMLElement>('.journey-launcher__management-trigger');
      setRestoreLocationId(null);
      setRestorePurposeId(purposeId);
    }}
    onRestoreLocation={(locationId) => {
      if ((state.mode !== 'map' && state.mode !== 'setup') || state.recovery.status !== 'none') return;
      restoreFocusElementRef.current = document.querySelector<HTMLElement>('.journey-launcher__management-trigger');
      setRestorePurposeId(null);
      setRestoreLocationId(locationId);
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
  const locationRestoreModal = restoringLocation === undefined || (state.mode !== 'map' && state.mode !== 'setup') ? null : <AccountMapModal
    initialMode="restore-location"
    node={{
      id: `location:${restoringLocation.id}`,
      kind: 'location',
      label: restoringLocation.shortName,
      amountWon: 0,
      connectionCount: 0,
      status: 'suspended',
    }}
    related={restoringLocationRelated}
    sourceElement={null}
    fallbackElement={restoreFocusElementRef.current}
    reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches}
    recovery={state.recovery}
    recoveryPending={state.save.status === 'pending'}
    saveFailed={state.save.status === 'failed'}
    onReapply={reapplyIntent}
    onKeepLatest={() => dispatch({ type: 'latest-kept' })}
    onClose={() => {
      const pending = pendingModalWorkspaceRef.current;
      pendingModalWorkspaceRef.current = null;
      const recovered = pendingModalRecoveryRef.current;
      pendingModalRecoveryRef.current = false;
      if (pending !== null) dispatch({ type: recovered ? 'reapply-succeeded' : 'save-succeeded', workspace: pending });
      setRestoreLocationId(null);
    }}
    onRestoreLocation={restoreLocation}
  />;
  const mapMainConfirmationNotice = state.mode === 'map' && state.mainConfirmationRequired ? (
    <div className="account-map-alert" role="status">
      <strong>확인 필요</strong>
      <span>Main 기준이 바뀌었어요. 흐름을 확인해 주세요.</span>
      <Button type="button" variant="secondary" onClick={() => onRequestMainEdit?.('income')}>Main 금액 수정</Button>
    </div>
  ) : null;
  if (state.mode === 'main-required') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="월 자금 계획이 먼저 필요해요"><p>Main의 다섯 월 금액을 만든 뒤 계좌 연결 지도를 시작할 수 있습니다.</p><a className="ui-button ui-button--primary" href={appPath('main')}>월 자금 계획 만들기</a></MessagePage></AppShell>;
  if (state.mode === 'invalid') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="저장된 데이터가 올바르지 않아요"><p>현재 데이터는 변경하지 않았습니다. Main 관리 메뉴에서 백업을 확인해 주세요.</p></MessagePage></AppShell>;
  if (state.mode === 'unavailable') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="저장소를 불러오지 못했어요"><p>브라우저 저장소 사용 가능 여부를 확인한 뒤 다시 시도해 주세요.</p></MessagePage></AppShell>;
  if (state.mode === 'migrating') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="계좌 연결을 준비하고 있어요"><p role="status">기존 데이터를 안전하게 옮기는 중입니다.</p></MessagePage></AppShell>;
  if (state.mode === 'map') {
    const flowApplied = projectAccountMapAppliedForView(state.workspace.accountMap.applied ?? state.applied);
    const editingLocation = flowLocationEditorId === null ? undefined : state.workspace.locations.find(({ id }) => id === flowLocationEditorId);
    const editingTransfer = flowTransferEditor?.mode === 'edit'
      ? flowApplied.transfers.find(({ id }) => id === flowTransferEditor.transferId) ?? {}
      : {};
    return <AppShell currentApp="account-map" managementMenu={management}><AppContentFrame className="account-map-page account-map-page--map"><header className="account-map-map-header"><div><p className="account-map-eyebrow">계좌 연결</p><h1>계좌별 월 계획 흐름</h1><p>Main의 월 금액은 읽기만 합니다. 계좌를 한 번 누르면 연결 흐름을 확인하고, 편집은 명시적인 버튼으로 시작합니다.</p></div></header>{mapMainConfirmationNotice}<AccountMapCanvas applied={flowApplied} main={state.main} locations={state.workspace.locations} interaction={state.interaction} hasExternalModal={restoringPurpose !== undefined || restoringLocation !== undefined || editingLocation !== undefined || flowTransferEditor !== null} onTransient={(nodeId) => dispatch({ type: 'node-hovered', nodeId })} onBlur={(nodeId) => dispatch({ type: 'node-blurred', nodeId })} onInvoke={(nodeId) => dispatch({ type: 'node-invoked', nodeId })} onBackground={() => dispatch({ type: 'map-background-invoked' })} onEscape={() => dispatch({ type: 'escape-invoked' })} onEditLocation={setFlowLocationEditorId} onAddTransfer={(sourceLocationId) => setFlowTransferEditor({ mode: 'add', sourceLocationId })} onEditTransfer={(transferId) => setFlowTransferEditor({ mode: 'edit', transferId })} />{editingLocation === undefined ? null : <AccountMapModal locationOnly locations={state.workspace.locations} node={{ id: `location:${editingLocation.id}`, kind: 'location', label: editingLocation.shortName, amountWon: 0, connectionCount: 0, status: 'resolved' }} related={buildFlowLocationRelated(editingLocation.id, flowApplied, state.workspace.locations)} sourceElement={null} fallbackElement={null} reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches} recovery={state.recovery} recoveryPending={state.save.status === 'pending'} saveFailed={state.save.status === 'failed'} onReapply={reapplyIntent} onKeepLatest={() => dispatch({ type: 'latest-kept' })} onClose={() => { const pending = pendingModalWorkspaceRef.current; pendingModalWorkspaceRef.current = null; if (pending !== null) dispatch({ type: 'save-succeeded', workspace: pending }); setFlowLocationEditorId(null); }} onSaveEdit={async (input) => { const result = await saveFlowLocationEdit(editingLocation.id, input); if (result.status !== 'saved') return false; pendingModalWorkspaceRef.current = result.workspace; return true; }} onArchiveLocation={archiveFlowLocation} />}{flowTransferEditor === null ? null : <FlowTransferDialog key={flowTransferEditor.mode === 'add' ? `add:${flowTransferEditor.sourceLocationId}` : `edit:${flowTransferEditor.transferId}`} locations={state.workspace.locations} initialValue={flowTransferEditor.mode === 'add' ? { sourceLocationId: flowTransferEditor.sourceLocationId } : editingTransfer} onClose={() => setFlowTransferEditor(null)} onSave={async (value) => { const saved = await saveFlowTransfer(flowTransferEditor, value); if (saved) setFlowTransferEditor(null); return saved; }} />}{locationRestoreModal}{restoringPurpose === undefined ? null : <AccountMapModal initialMode="restore-purpose" node={{ id: restoringPurpose.id, kind: 'purpose', label: restoringPurpose.name, amountWon: restoringPurpose.targetMonthlyWon, connectionCount: state.applied.links.filter(({ purposeId, status }) => purposeId === restoringPurpose.id && status === 'active').length, status: 'suspended' }} related={state.applied.links.filter(({ purposeId }) => purposeId === restoringPurpose.id).map((link) => ({ label: state.workspace.locations.find(({ id }) => id === link.locationId)?.shortName ?? '연결', amountWon: link.monthlyAmountWon, status: link.status, linkId: link.id, purposeId: link.purposeId, locationId: link.locationId, remainder: link.remainder }))} sourceElement={null} fallbackElement={restoreFocusElementRef.current} reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches} recovery={state.recovery} recoveryPending={state.save.status === 'pending'} saveFailed={state.save.status === 'failed'} purposeParentLabel={purposeParentLabel(restoringPurpose.parentId)} purposeTargetCapacityWon={customPurposeTargetCapacity(restoringPurpose.parentId, state.applied.customPurposes, state.main, restoringPurpose.id)} onReapply={reapplyIntent} onKeepLatest={() => dispatch({ type: 'latest-kept' })} onClose={() => setRestorePurposeId(null)} onRestorePurpose={async (purposeId, targetMonthlyWon) => { if (state.recovery.status !== 'none') return false; const result = await resolved.accountMap.save(state.workspace.revision, { type: 'restore-custom-purpose', purposeId, targetMonthlyWon }); if (result.status !== 'saved') { if (result.status === 'conflict') captureIntentConflict({ kind: 'purpose', id: purposeId, edit: { base: { name: restoringPurpose.name, targetMonthlyWon: restoringPurpose.targetMonthlyWon, archivedAt: restoringPurpose.archivedAt }, next: { name: restoringPurpose.name, targetMonthlyWon, archivedAt: undefined } } }); else dispatch({ type: 'save-failed', reason: failureReason(result) }); return false; } pendingModalWorkspaceRef.current = result.workspace; return true; }} />}</AppContentFrame></AppShell>;
  }
  async function saveDraft(draft: AccountMapDraftV2): Promise<AccountMapDraftSaveResult> {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return { status: 'recovery' };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'save-draft', draft });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        captureManualConflict('save-draft', []);
        return { status: 'recovery' };
      }
      dispatch({ type: 'save-failed', reason: failureReason(result) });
      if (result.status === 'rejected' && result.reason === 'custom-target-capacity') {
        return { status: 'field-error', field: 'amount', message: '큰 목적의 월 금액을 넘을 수 없습니다.' };
      }
      return { status: 'failed', message: '저장하지 못했어요. 입력은 그대로 두었습니다.' };
    }
    dispatch({ type: 'draft-updated', draft });
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    return { status: 'saved' };
  }

  async function restoreLocation(locationId: string, restoreLinkIds: string[], remainderByPurpose: Record<string, string | null>, restoreTransferIds: string[] = []): Promise<boolean> {
    if ((state.mode !== 'map' && state.mode !== 'setup') || state.recovery.status !== 'none') return false;
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'restore-location', locationId, restoreLinkIds, restoreTransferIds, remainderByPurpose });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        const restored = new Set(restoreLinkIds);
        captureManualConflict('restore-location', [
          { kind: 'location', id: locationId },
          ...manualLinkTargets(restoreLinkIds, 'restorable-link'),
          ...manualLinkTargets(Object.values(remainderByPurpose).filter((id) => id !== null && !restored.has(id)), 'link'),
        ]);
      } else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return false;
    }
    pendingModalWorkspaceRef.current = result.workspace;
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
    const draft = projectAccountMapDraftForView(state.draft);
    const applied: AccountMapAppliedV3 = { schemaVersion: 3, sourceMainUpdatedAt: state.main.updatedAt, customPurposes: draft.customPurposes, links: draft.links, transfers: draft.transfers, setupCompletedAt: now, updatedAt: now };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'apply-map', applied });
    if (result.status !== 'saved') { if (result.status === 'conflict') captureManualConflict('apply-map', []); else dispatch({ type: 'save-failed', reason: failureReason(result) }); return; }
    dispatch({ type: 'apply-succeeded', applied: {
      schemaVersion: 2,
      sourceMainUpdatedAt: applied.sourceMainUpdatedAt,
      customPurposes: structuredClone(applied.customPurposes),
      links: structuredClone(applied.links),
      setupCompletedAt: applied.setupCompletedAt,
      updatedAt: applied.updatedAt,
    }, workspace: result.workspace });
  }

  async function addTransfer(value: AccountTransferEditorValue & { id: string }): Promise<AccountMapTransferSaveResult> {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return { status: 'recovery' };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'add-transfer',
      surface: 'draft',
      transfer: value,
    });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        captureManualConflict('edit-transfer', []);
        return { status: 'recovery' };
      }
      const failure = transferSaveFailure(result);
      if (failure.status === 'validation') dispatch({ type: 'save-succeeded', workspace: state.workspace });
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return failure;
    }
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    if (result.workspace.accountMap.draft !== null) {
      dispatch({ type: 'draft-updated', draft: result.workspace.accountMap.draft });
    }
    return { status: 'saved' };
  }

  async function editTransfer(id: string, value: AccountTransferEditorValue): Promise<AccountMapTransferSaveResult> {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return { status: 'recovery' };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'edit-transfer',
      surface: 'draft',
      transferId: id,
      fields: value,
    });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        captureManualConflict('edit-transfer', [{ kind: 'transfer', id }]);
        return { status: 'recovery' };
      }
      const failure = transferSaveFailure(result);
      if (failure.status === 'validation') dispatch({ type: 'save-succeeded', workspace: state.workspace });
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return failure;
    }
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    if (result.workspace.accountMap.draft !== null) {
      dispatch({ type: 'draft-updated', draft: result.workspace.accountMap.draft });
    }
    return { status: 'saved' };
  }

  async function removeTransfer(id: string): Promise<AccountMapTransferSaveResult> {
    if (state.mode !== 'setup' || state.recovery.status !== 'none') return { status: 'recovery' };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'remove-transfer',
      surface: 'draft',
      transferId: id,
    });
    if (result.status !== 'saved') {
      if (result.status === 'conflict') {
        captureTransferManualConflict('remove-transfer', id, 'removal');
        return { status: 'recovery' };
      }
      const failure = transferSaveFailure(result);
      if (failure.status === 'validation') dispatch({ type: 'save-succeeded', workspace: state.workspace });
      else dispatch({ type: 'save-failed', reason: failureReason(result) });
      return failure;
    }
    dispatch({ type: 'save-succeeded', workspace: result.workspace });
    if (result.workspace.accountMap.draft !== null) {
      dispatch({ type: 'draft-updated', draft: result.workspace.accountMap.draft });
    }
    return { status: 'saved' };
  }

  async function saveFlowTransfer(
    editor: NonNullable<typeof flowTransferEditor>,
    value: AccountTransferEditorValue,
  ): Promise<boolean> {
    if (state.mode !== 'map' || state.recovery.status !== 'none') return false;
    dispatch({ type: 'save-requested' });
    const command = editor.mode === 'add'
      ? { type: 'add-transfer' as const, surface: 'applied' as const, transfer: { ...value, id: createId() } }
      : { type: 'edit-transfer' as const, surface: 'applied' as const, transferId: editor.transferId, fields: value };
    const result = await resolved.accountMap.save(state.workspace.revision, command);
    if (result.status === 'saved') {
      dispatch({ type: 'transfer-save-succeeded', workspace: result.workspace });
      return true;
    }
    if (result.status === 'conflict') {
      if (editor.mode === 'edit') captureTransferManualConflict('edit-transfer', editor.transferId, 'compound-edit');
      else captureManualConflict('edit-transfer', []);
    } else {
      dispatch({ type: 'save-failed', reason: failureReason(result) });
    }
    return false;
  }

  async function saveFlowLocationEdit(locationId: string, input: AccountMapNodeEditInput): Promise<AccountMapWriteResult> {
    if (state.mode !== 'map' || state.recovery.status !== 'none') return { status: 'unavailable' };
    const location = state.workspace.locations.find(({ id }) => id === locationId);
    if (location === undefined) return { status: 'unavailable' };
    const details = input.locationDetails ?? {
      shortName: input.label ?? location.shortName,
      kind: location.kind,
      ...(location.institution === undefined ? {} : { institution: location.institution }),
    };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'update-location-details', locationId,
      shortName: details.shortName,
      kind: details.kind,
      ...(details.institution === undefined ? {} : { institution: details.institution }),
    });
    if (result.status === 'saved') return result;
    if (result.status === 'conflict') captureManualConflict('edit-node', [{ kind: 'location', id: locationId }]);
    else dispatch({ type: 'save-failed', reason: failureReason(result) });
    return result;
  }

  async function archiveFlowLocation(locationId: string, replacementRemainderByPurpose: Record<string, string | null>): Promise<boolean> {
    if (state.mode !== 'map' || state.recovery.status !== 'none') return false;
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'archive-location', locationId, replacementRemainderByPurpose });
    if (result.status === 'saved') {
      pendingModalWorkspaceRef.current = result.workspace;
      return true;
    }
    if (result.status === 'conflict') captureManualConflict('archive-location', [{ kind: 'location', id: locationId }]);
    else dispatch({ type: 'save-failed', reason: failureReason(result) });
    return false;
  }


  return <AppShell currentApp="account-map" managementMenu={management}><AppContentFrame className="account-map-page"><AccountMapSetup workspace={state.workspace} main={state.main} draft={state.draft} step={state.step} calculation={setupProjection!.calculation} suggestions={setupProjection!.suggestions} review={setupProjection!.review} canApply={setupProjection!.canApply} mainChanged={state.mainChanged} saveFailed={state.save.status === 'failed'} recoveryPending={state.save.status === 'pending'} recovery={state.recovery} onReapply={reapplyIntent} onKeepLatest={() => dispatch({ type: 'latest-kept' })} onRequestMainEdit={(target) => { onRequestMainEdit?.(target); }} onCommitConnection={commitConnection} onSaveDraft={saveDraft} onAddTransfer={addTransfer} onEditTransfer={editTransfer} onRemoveTransfer={removeTransfer} onApply={() => void applyMap()} onExit={() => { if (state.recovery.status !== 'none') return; dispatch({ type: 'setup-exited' }); window.location.assign(appPath('main')); }} onCancelSetup={() => { if (state.recovery.status !== 'none') return; void resolved.accountMap.reset(state.workspace.revision).then((result) => { if (result.status === 'saved') dispatch({ type: 'setup-cancelled', workspace: result.workspace }); else if (result.status === 'conflict') captureManualConflict('cancel-setup', []); else dispatch({ type: 'save-failed', reason: failureReason(result) }); }); }} />{locationRestoreModal}</AppContentFrame></AppShell>;


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

  function captureTransferManualConflict(action: 'edit-transfer' | 'remove-transfer', transferId: string, reason: 'compound-edit' | 'removal'): void {
    const latest = resolved.accountMap.load();
    if (latest.status === 'found') dispatch({ type: 'transfer-manual-conflicted', latest: latest.workspace, action, transferId, reason });
    else dispatch({ type: 'save-failed', reason: latest.status === 'invalid' ? 'invalid' : 'unavailable' });
  }

}

function FlowTransferDialog({
  locations,
  initialValue,
  onClose,
  onSave,
}: {
  locations: readonly FinancialLocation[];
  initialValue: Partial<AccountTransferEditorValue>;
  onClose(): void;
  onSave(value: AccountTransferEditorValue): Promise<boolean>;
}): JSX.Element {
  const [saveFailed, setSaveFailed] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  useEffect(() => {
    dialogRef.current?.querySelector<HTMLElement>('button, select, input, [tabindex]:not([tabindex="-1"])')?.focus();
  }, []);
  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); onClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="account-map-modal-backdrop"><section ref={dialogRef} className="account-map-modal account-flow-editor-modal" role="dialog" aria-modal="true" aria-label="계좌 흐름 편집" onKeyDown={trapFocus}><header><div><p>월 계획 흐름</p><h2>계좌 흐름 편집</h2></div><button type="button" className="account-map-modal__close" aria-label="닫기" onClick={onClose}>×</button></header><div className="account-map-modal__body"><AccountTransferEditor locations={locations} initialValue={initialValue} onCancel={onClose} onSave={(value) => { setSaveFailed(false); void onSave(value).then((saved) => { if (!saved) setSaveFailed(true); }, () => setSaveFailed(true)); }} />{saveFailed ? <p role="alert" className="account-map-modal__error">현재 흐름을 저장하지 못했습니다. 구조와 최신 상태를 확인한 뒤 다시 시도해 주세요.</p> : null}</div></section></div>;
}

function MessagePage({ title, children }: { title: string; children: React.ReactNode }) { return <AppContentFrame className="account-map-page"><section className="account-map-message"><h1>{title}</h1>{children}</section></AppContentFrame>; }
function purposeParentLabel(parentId: OutflowPurposeId): string { return parentId === 'system:housing' ? '주거' : parentId === 'system:living' ? '생활비' : parentId === 'system:saving' ? '저축' : '투자'; }
function failureReason(result: Exclude<AccountMapWriteResult, { status: 'saved' }>) { return result.status === 'conflict' ? 'conflict' : result.status === 'invalid' ? 'invalid' : result.status === 'rejected' ? 'rejected' : 'unavailable'; }
function transferSaveFailure(result: Exclude<AccountMapWriteResult, { status: 'saved' | 'conflict' }>): AccountMapTransferSaveResult {
  if (result.status !== 'rejected') return { status: 'failed' };
  switch (result.reason) {
    case 'duplicate-transfer':
      return { status: 'validation', message: '같은 두 계좌 사이에는 활성 흐름을 하나만 둘 수 있어요.' };
    case 'cycle':
      return { status: 'validation', message: '계좌 흐름이 순환해요. 한 방향으로 흐르도록 출발·도착을 바꿔 주세요.' };
    case 'multiple-sweeps':
      return { status: 'validation', message: '한 계좌에서 남은 금액 전부 흐름은 하나만 둘 수 있어요.' };
    case 'self-transfer':
      return { status: 'validation', message: '같은 계좌로 보낼 수 없어요.' };
    case 'endpoint-archived':
      return { status: 'validation', message: '보관된 계좌는 흐름의 출발·도착으로 사용할 수 없어요.' };
    case 'endpoint-not-found':
      return { status: 'validation', message: '선택한 계좌를 찾을 수 없어요. 다시 선택해 주세요.' };
    case 'invalid-amount':
      return { status: 'validation', message: '정해진 금액은 0원보다 큰 정수로 입력해 주세요.' };
    default:
      return { status: 'failed' };
  }
}
function createId() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function recoveryFallbackField(intent: AccountMapEditIntent): string { return intent.kind === 'add-link' ? 'locationId' : intent.kind === 'link' ? 'monthlyAmountWon' : intent.kind === 'purpose' ? 'name' : 'shortName'; }
function manualLinkTargets(ids: Array<string | null>, kind: 'link' | 'restorable-link'): ManualRecoveryTarget[] {
  return [...new Set(ids.filter((id): id is string => id !== null))].map((id) => ({ kind, id }));
}
function buildFlowLocationRelated(
  locationId: string,
  applied: AccountMapAppliedV3,
  locations: readonly FinancialLocation[],
): AccountMapModalRelatedItem[] {
  const purposeItems = applied.links.filter((link) => link.locationId === locationId).map((link) => ({
    label: purposeLabel(link.purposeId, applied), amountWon: link.monthlyAmountWon, status: link.status,
    ...(link.status === 'suspended' ? { suspendedReason: link.suspendedReason } : {}),
    linkId: link.id, purposeId: link.purposeId, locationId: link.locationId, remainder: link.remainder,
  }));
  const transferItems = applied.transfers.filter((transfer) => transfer.sourceLocationId === locationId || transfer.targetLocationId === locationId).map((transfer) => ({
    label: `${locations.find(({ id }) => id === transfer.sourceLocationId)?.shortName ?? '계좌'} → ${locations.find(({ id }) => id === transfer.targetLocationId)?.shortName ?? '계좌'} · ${transfer.allocation.kind === 'sweep' ? '남은 금액 전부' : '고정 금액'}`,
    amountWon: transfer.allocation.kind === 'fixed' ? transfer.allocation.monthlyAmountWon : 0,
    status: transfer.status,
    ...(transfer.status === 'suspended' ? { suspendedReason: transfer.suspendedReason } : {}),
    transferId: transfer.id,
    relationKind: 'transfer' as const,
  }));
  return [...purposeItems, ...transferItems];
}

function buildLocationRestoreRelated(
  locationId: string,
  purposeState: AccountMapApplied | AccountMapAppliedV3 | AccountMapDraft | AccountMapDraftV2,
  locations: readonly FinancialLocation[],
  main: MainData,
): AccountMapModalRelatedItem[] {
  const direct = purposeState.links.filter((link) => link.locationId === locationId).map((link) => ({
    label: purposeLabel(link.purposeId, purposeState),
    amountWon: link.monthlyAmountWon,
    status: link.status,
    ...(link.status === 'suspended' ? { suspendedReason: link.suspendedReason } : {}),
    linkId: link.id,
    purposeId: link.purposeId,
    purposeTargetWon: reconcilePurpose(link.purposeId, purposeState, locations, main).targetWon,
    locationId: link.locationId,
    remainder: link.remainder,
  }));
  const purposeIds = new Set(direct.filter(({ suspendedReason }) => suspendedReason === 'location-archived').map(({ purposeId }) => purposeId));
  const replacements = purposeState.links.filter((link) => purposeIds.has(link.purposeId)
    && link.locationId !== locationId && link.status === 'active').map((link) => ({
      label: locations.find(({ id }) => id === link.locationId)?.shortName ?? '다른 계좌',
      amountWon: link.monthlyAmountWon,
      status: link.status,
      linkId: link.id,
      purposeId: link.purposeId,
      purposeTargetWon: reconcilePurpose(link.purposeId, purposeState, locations, main).targetWon,
      locationId: link.locationId,
      remainder: link.remainder,
      replacementCandidate: true as const,
    }));
  const transfers = 'transfers' in purposeState ? purposeState.transfers
    .filter((transfer) => transfer.sourceLocationId === locationId || transfer.targetLocationId === locationId)
    .map((transfer) => ({
      label: `${locations.find(({ id }) => id === transfer.sourceLocationId)?.shortName ?? '계좌'} → ${locations.find(({ id }) => id === transfer.targetLocationId)?.shortName ?? '계좌'} · ${transfer.allocation.kind === 'sweep' ? '남은 금액 전부' : '고정 금액'}`,
      amountWon: transfer.allocation.kind === 'fixed' ? transfer.allocation.monthlyAmountWon : 0,
      status: transfer.status,
      ...(transfer.status === 'suspended' ? { suspendedReason: transfer.suspendedReason } : {}),
      relationKind: 'transfer' as const,
      transferId: transfer.id,
    })) : [];
  return [...direct, ...replacements, ...transfers];
}

function purposeLabel(purposeId: PurposeId, state: AccountMapApplied | AccountMapAppliedV3 | AccountMapDraft | AccountMapDraftV2): string {
  if (purposeId.startsWith('custom:')) return state.customPurposes.find(({ id }) => id === purposeId)?.name ?? '세부 목적';
  return purposeId === 'system:income' ? '수입'
    : purposeId === 'system:housing' ? '주거'
      : purposeId === 'system:living' ? '생활비'
        : purposeId === 'system:saving' ? '저축'
          : '투자';
}
