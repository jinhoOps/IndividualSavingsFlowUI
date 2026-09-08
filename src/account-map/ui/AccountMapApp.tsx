import { useContext, useEffect, useId, useMemo, useReducer, useRef, useState, type JSX, type KeyboardEvent } from 'react';
import { AccountDraftContext } from '../../auth/AccountDraftContext';
import { AppContentFrame } from '../../components/common/AppContentFrame';
import { AppShell } from '../../components/common/AppShell';
import { Button } from '../../components/common/Button';
import { appPath } from '../../journey/routes';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import { bootstrapAccountMap } from '../application/bootstrap';
import { accountMapReducer, type ManualRecoveryAction, type ManualRecoveryTarget, type RecoveryState } from '../application/reducer';
import { projectAccountMapSetup } from '../application/setupProjection';
import { rebaseAccountMapIntent, type AccountMapEditIntent } from '../domain/editIntent';
import type { AccountMapApplied, AccountMapAppliedV3, AccountMapDraft, AccountMapDraftV2, AccountMapSetupStep, OutflowPurposeId, PurposeId } from '../domain/model';
import { SYSTEM_PURPOSE_IDS } from '../domain/model';
import type { AccountTransferEditorValue } from './AccountTransferEditor';
import type { AccountMapTransferSaveResult } from './setup/AccountMapTransfersStep';
import type { MainPlanEditTarget } from './setup/AccountMapBasisStep';
import { projectAccountMapAppliedForView, projectAccountMapDraftForView } from '../domain/accountMapVersioning';
import { customPurposeTargetCapacity, recalculateRemainder, reconcilePurpose } from '../domain/reconciliation';
import { BrowserAccountMapRepository, type AccountMapRepository, type AccountMapWriteResult } from '../infrastructure/accountMapRepository';
import { BrowserAccountMapMainSourceRepository, type AccountMapMainSourceRepository } from '../infrastructure/mainSourceRepository';
import { AccountMapManagementMenu } from './AccountMapManagementMenu';
import { AccountMapCanvas } from './AccountMapCanvas';
import { AccountTransferEditor } from './AccountTransferEditor';
import { AccountMapModal, type AccountMapModalRelatedItem, type AccountMapNodeEditInput } from './AccountMapModal';
import { AccountMapSetup, CustomPurposeDialog, RecoveryControls, type AccountMapDraftSaveResult } from './AccountMapSetup';
import './account-map.css';

export interface AccountMapRepositories { accountMap: AccountMapRepository; main: AccountMapMainSourceRepository }
export interface AccountMapAppProps {
  repositories?: AccountMapRepositories;
  onRequestMainEdit?(target: MainPlanEditTarget): void;
  /** Journey host invalidates this after a successful Main-owned save. */
  refreshSignal?: number;
}
export function AccountMapApp({ repositories, onRequestMainEdit, refreshSignal }: AccountMapAppProps = {}): JSX.Element {
  const accountSession = useContext(AccountDraftContext);
  const resolved = useMemo<AccountMapRepositories>(() => repositories ?? { accountMap: new BrowserAccountMapRepository(), main: new BrowserAccountMapMainSourceRepository() }, [repositories]);
  const [state, dispatch] = useReducer(accountMapReducer, undefined, () => bootstrapAccountMap(resolved.main.load(), resolved.accountMap.load()));
  const pendingModalWorkspaceRef = useRef<WorkspaceDocument | null>(null);
  const pendingModalRecoveryRef = useRef(false);
  const restoreFocusElementRef = useRef<HTMLElement | null>(null);
  const flowLocationTriggerRef = useRef<HTMLElement | null>(null);
  const flowLocationFallbackRef = useRef<HTMLElement | null>(null);
  const [restorePurposeId, setRestorePurposeId] = useState<`custom:${string}` | null>(null);
  const [restoreLocationId, setRestoreLocationId] = useState<string | null>(null);
  const [flowLocationEditorId, setFlowLocationEditorId] = useState<string | null>(null);
  const [purposeEditorId, setPurposeEditorId] = useState<PurposeId | null>(null);
  const [addingPurpose, setAddingPurpose] = useState(false);
  const [purposeError, setPurposeError] = useState<string | null>(null);
  const [flowTransferEditor, setFlowTransferEditor] = useState<{ mode: 'add'; sourceLocationId: string } | { mode: 'edit'; transferId: string } | null>(null);
  const handledRefreshSignal = useRef<number | undefined>(refreshSignal);
  const setupProjection = useMemo(() => state.mode !== 'setup'
    ? null
    : projectAccountMapSetup(state.main, state.workspace.locations, state.draft), [state]);

  function keepLatest(): void {
    if (accountSession?.status === 'conflict'
      && accountSession.pending?.operation === 'save_account_map') {
      accountSession.discardPending();
    }
    dispatch({ type: 'latest-kept' });
  }

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
    onKeepLatest={keepLatest}
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
      <Button type="button" variant="primary" disabled={state.save.status === 'pending'} onClick={() => void confirmCurrentMain()}>현재 Main 기준으로 확인</Button>
      <Button type="button" variant="secondary" onClick={() => onRequestMainEdit?.('income')}>Main 금액 수정</Button>
      {state.save.status === 'failed' ? <p role="alert">현재 Main 기준으로 확인하지 못했습니다. Main 금액과 목적별 고정 배정을 확인한 뒤 다시 시도해 주세요.</p> : null}
    </div>
  ) : null;
  if (state.mode === 'main-required') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="월 자금 계획이 먼저 필요해요"><p>Main의 다섯 월 금액을 만든 뒤 계좌 연결 지도를 시작할 수 있습니다.</p><a className="ui-button ui-button--primary" href={appPath('main')}>월 자금 계획 만들기</a></MessagePage></AppShell>;
  if (state.mode === 'invalid') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="저장된 데이터가 올바르지 않아요"><p>현재 데이터는 변경하지 않았습니다. 자금 흐름에서 백업으로 복구할 수 있어요.</p><a className="ui-button ui-button--primary" href={appPath('main')}>자금 흐름에서 복구하기</a></MessagePage></AppShell>;
  if (state.mode === 'unavailable') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="저장소를 불러오지 못했어요"><p>브라우저 저장소 사용 가능 여부를 확인한 뒤 다시 시도해 주세요.</p><a className="ui-button ui-button--primary" href={appPath('account-map')}>다시 불러오기</a></MessagePage></AppShell>;
  if (state.mode === 'migrating') return <AppShell currentApp="account-map" managementMenu={management}><MessagePage title="계좌 연결을 준비하고 있어요"><p role="status">기존 데이터를 안전하게 옮기는 중입니다.</p></MessagePage></AppShell>;
  if (state.mode === 'map') {
    const flowApplied = projectAccountMapAppliedForView(state.workspace.accountMap.applied ?? state.applied);
    const editingLocation = flowLocationEditorId === null ? undefined : state.workspace.locations.find(({ id }) => id === flowLocationEditorId);
    const editingTransfer = flowTransferEditor?.mode === 'edit'
      ? flowApplied.transfers.find(({ id }) => id === flowTransferEditor.transferId) ?? {}
      : {};
    const managedPurposeIds: PurposeId[] = [...SYSTEM_PURPOSE_IDS, ...flowApplied.customPurposes.filter(({ archivedAt }) => archivedAt === undefined).map(({ id }) => id)];
    const editingPurpose = purposeEditorId === null ? null : {
      id: purposeEditorId, label: purposeLabel(purposeEditorId, flowApplied),
      target: reconcilePurpose(purposeEditorId, flowApplied, state.workspace.locations, state.main).targetWon,
      custom: flowApplied.customPurposes.find(({ id }) => id === purposeEditorId),
    };
    const purposeRelated = editingPurpose === null ? [] : flowApplied.links.filter(({ purposeId }) => purposeId === editingPurpose.id).map((link) => ({
      label: state.workspace.locations.find(({ id }) => id === link.locationId)?.shortName ?? '계좌',
      amountWon: link.monthlyAmountWon, status: link.status,
      ...(link.status === 'suspended' ? { suspendedReason: link.suspendedReason } : {}),
      linkId: link.id, purposeId: link.purposeId, locationId: link.locationId, remainder: link.remainder,
    }));
    const hasMapModal = restoringPurpose !== undefined || restoringLocation !== undefined || editingLocation !== undefined || flowTransferEditor !== null || editingPurpose !== null || addingPurpose;
    return <AppShell currentApp="account-map" managementMenu={management}><AppContentFrame className="account-map-page account-map-page--map"><header className="account-map-map-header"><div><p className="account-map-eyebrow">계좌 연결</p><h1>계좌별 월 계획 흐름</h1><p>계좌를 선택해 매달 들어오고 나가는 금액을 확인하고 연결을 관리해 보세요.</p></div></header>{mapMainConfirmationNotice}{!hasMapModal && state.recovery.status !== 'none' ? <section aria-label="지도 복구"><RecoveryControls recovery={state.recovery} pending={state.save.status === 'pending'} onReapply={reapplyIntent} onKeepLatest={keepLatest} /></section> : null}<AccountMapCanvas applied={flowApplied} main={state.main} locations={state.workspace.locations} interaction={state.interaction} hasExternalModal={hasMapModal} onTransient={(nodeId) => dispatch({ type: 'node-hovered', nodeId })} onBlur={(nodeId) => dispatch({ type: 'node-blurred', nodeId })} onInvoke={(nodeId) => dispatch({ type: 'node-invoked', nodeId })} onBackground={() => dispatch({ type: 'map-background-invoked' })} onEscape={() => dispatch({ type: 'escape-invoked' })} onEditLocation={(locationId, trigger) => { flowLocationTriggerRef.current = trigger; flowLocationFallbackRef.current = document.querySelector<HTMLElement>('.journey-launcher__management-trigger'); setFlowLocationEditorId(locationId); }} onAddTransfer={(sourceLocationId) => setFlowTransferEditor({ mode: 'add', sourceLocationId })} onEditTransfer={(transferId) => setFlowTransferEditor({ mode: 'edit', transferId })} />{editingLocation === undefined ? null : <AccountMapModal initialMode="edit" locationOnly locations={state.workspace.locations} node={{ id: `location:${editingLocation.id}`, kind: 'location', label: editingLocation.shortName, amountWon: 0, connectionCount: 0, status: 'resolved' }} related={buildFlowLocationRelated(editingLocation.id, flowApplied, state.workspace.locations)} sourceElement={flowLocationTriggerRef.current} fallbackElement={flowLocationFallbackRef.current} reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches} recovery={state.recovery} recoveryPending={state.save.status === 'pending'} saveFailed={state.save.status === 'failed'} onReapply={reapplyIntent} onKeepLatest={keepLatest} onClose={() => { const pending = pendingModalWorkspaceRef.current; pendingModalWorkspaceRef.current = null; if (pending !== null) dispatch({ type: 'save-succeeded', workspace: pending }); setFlowLocationEditorId(null); }} onSaveEdit={async (input) => { const result = await saveFlowLocationEdit(editingLocation.id, input); if (result.status !== 'saved') return false; pendingModalWorkspaceRef.current = result.workspace; return true; }} onArchiveLocation={archiveFlowLocation} />}{flowTransferEditor === null ? null : <FlowTransferDialog
      key={flowTransferEditor.mode === 'add' ? `add:${flowTransferEditor.sourceLocationId}` : `edit:${flowTransferEditor.transferId}`}
      recoveryScope={flowTransferEditor.mode === 'add' ? `map:add:${flowTransferEditor.sourceLocationId}` : `map:edit:${flowTransferEditor.transferId}`}
      locations={state.workspace.locations}
      initialValue={flowTransferEditor.mode === 'add' ? { sourceLocationId: flowTransferEditor.sourceLocationId } : editingTransfer}
      recovery={state.recovery}
      onReviewLatest={reapplyIntent}
      onKeepLatest={() => { keepLatest(); setFlowTransferEditor(null); }}
      onClose={() => { if (state.recovery.status !== 'none') keepLatest(); setFlowTransferEditor(null); }}
      onSave={(value) => saveFlowTransfer(flowTransferEditor, value)}
      onRemove={flowTransferEditor.mode === 'edit' ? () => removeTransfer(flowTransferEditor.transferId) : undefined}
    />}
    <section className="account-map-purpose-management" aria-label="목적·계좌 배정 관리">
      <h2>목적·계좌 배정 관리</h2>
      <p>목적별 월 배정을 조정하거나 새 계좌·보관처를 연결합니다. Main 금액은 바뀌지 않습니다.</p>
      <div className="account-map-actions">{managedPurposeIds.map((id) => <Button key={id} type="button" variant="secondary" disabled={state.recovery.status !== 'none' || state.save.status === 'pending'} onClick={(event) => { restoreFocusElementRef.current = event.currentTarget; setPurposeError(null); setPurposeEditorId(id); }}>{purposeLabel(id, flowApplied)} 배정 관리</Button>)}
      <Button type="button" variant="secondary" disabled={state.recovery.status !== 'none' || state.save.status === 'pending'} onClick={() => setAddingPurpose(true)}>세부 목적 추가</Button></div>
    </section>
    <section className="account-map-purpose-management" aria-label="전체 계좌 흐름 관리">
      <h2>전체 계좌 흐름 관리</h2>
      <div className="account-map-actions">{flowApplied.transfers.map((transfer) => {
        const label = `${state.workspace.locations.find(({ id }) => id === transfer.sourceLocationId)?.shortName ?? '계좌'} → ${state.workspace.locations.find(({ id }) => id === transfer.targetLocationId)?.shortName ?? '계좌'}`;
        return <Button key={transfer.id} type="button" variant="secondary" aria-label={`${label} 흐름 관리`} disabled={state.recovery.status !== 'none' || state.save.status === 'pending'} onClick={() => setFlowTransferEditor({ mode: 'edit', transferId: transfer.id })}>{label} · {transfer.status === 'active' ? '연결됨' : '중지'}</Button>;
      })}</div>
    </section>
    {editingPurpose === null ? null : <AccountMapModal
      key={editingPurpose.id} initialMode="edit"
      node={{ id: editingPurpose.id, kind: 'purpose', label: editingPurpose.label, amountWon: editingPurpose.target, status: 'resolved' }}
      related={purposeRelated} locations={state.workspace.locations}
      sourceElement={null} fallbackElement={restoreFocusElementRef.current} reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches}
      recovery={state.recovery} recoveryPending={state.save.status === 'pending'} saveFailed={state.save.status === 'failed'} saveErrorMessage={purposeError ?? undefined}
      onReapply={reapplyIntent} onKeepLatest={keepLatest} onClose={closePurposeEditor}
      onSaveEdit={(input) => savePurposeEdit(editingPurpose.id, input)}
      onConnectLocation={(locationId, monthlyAmountWon) => commitConnection({ purposeId: editingPurpose.id, locationId, monthlyAmountWon, restoreLocation: state.workspace.locations.find(({ id }) => id === locationId)?.archivedAt !== undefined })}
      onCreateAndConnectLocation={(newLocation, monthlyAmountWon) => commitConnection({ purposeId: editingPurpose.id, locationId: newLocation.id, newLocation, monthlyAmountWon })}
      purposeParentLabel={editingPurpose.custom === undefined ? undefined : purposeParentLabel(editingPurpose.custom.parentId)}
      purposeTargetCapacityWon={editingPurpose.custom === undefined ? undefined : customPurposeTargetCapacity(editingPurpose.custom.parentId, flowApplied.customPurposes, state.main, editingPurpose.custom.id)}
      onArchivePurpose={async (purposeId) => {
        if (state.recovery.status !== 'none' || state.save.status === 'pending') return false;
        dispatch({ type: 'save-requested' });
        const result = await resolved.accountMap.save(state.workspace.revision, { type: 'archive-custom-purpose', purposeId });
        if (result.status === 'saved') { pendingModalWorkspaceRef.current = result.workspace; return true; }
        if (result.status === 'conflict') captureManualConflict('edit-node', [{ kind: 'node', id: purposeId }]);
        else dispatch({ type: 'save-failed', reason: failureReason(result) });
        return false;
      }}
    />}
    {addingPurpose ? <CustomPurposeDialog main={state.main} draft={{ schemaVersion: 2, sourceMainUpdatedAt: flowApplied.sourceMainUpdatedAt, customPurposes: flowApplied.customPurposes, links: flowApplied.links, transfers: flowApplied.transfers, step: 'locations', updatedAt: flowApplied.updatedAt }}
      disabled={state.recovery.status !== 'none' || state.save.status === 'pending'}
      recoveryContent={state.recovery.status === 'none' ? undefined : <RecoveryControls recovery={state.recovery} onReapply={reapplyIntent} onKeepLatest={() => { accountSession?.recordRecoveryDraft('account-map-custom-purpose', null); keepLatest(); closePurposeEditor(); }} />}
      onCancel={() => { if (state.recovery.status !== 'none') keepLatest(); closePurposeEditor(); }}
      onSave={async (draft) => {
        const saved = await savePurposeMap({ ...state.applied, customPurposes: draft.customPurposes, updatedAt: draft.updatedAt }, []);
        return saved ? { status: 'saved' } : { status: 'failed', message: '저장하지 못했습니다. 최신 상태와 목적 금액을 확인해 주세요.' };
      }} /> : null}
    {locationRestoreModal}{restoringPurpose === undefined ? null : <AccountMapModal initialMode="restore-purpose" node={{ id: restoringPurpose.id, kind: 'purpose', label: restoringPurpose.name, amountWon: restoringPurpose.targetMonthlyWon, connectionCount: state.applied.links.filter(({ purposeId, status }) => purposeId === restoringPurpose.id && status === 'active').length, status: 'suspended' }} related={state.applied.links.filter(({ purposeId }) => purposeId === restoringPurpose.id).map((link) => ({ label: state.workspace.locations.find(({ id }) => id === link.locationId)?.shortName ?? '연결', amountWon: link.monthlyAmountWon, status: link.status, linkId: link.id, purposeId: link.purposeId, locationId: link.locationId, remainder: link.remainder }))} sourceElement={null} fallbackElement={restoreFocusElementRef.current} reducedMotion={typeof window.matchMedia !== 'function' || window.matchMedia('(prefers-reduced-motion: reduce)').matches} recovery={state.recovery} recoveryPending={state.save.status === 'pending'} saveFailed={state.save.status === 'failed'} purposeParentLabel={purposeParentLabel(restoringPurpose.parentId)} purposeTargetCapacityWon={customPurposeTargetCapacity(restoringPurpose.parentId, state.applied.customPurposes, state.main, restoringPurpose.id)} onReapply={reapplyIntent} onKeepLatest={keepLatest} onClose={() => { closePurposeEditor(); setRestorePurposeId(null); }} onRestorePurpose={async (purposeId, targetMonthlyWon) => { if (state.recovery.status !== 'none') return false; const result = await resolved.accountMap.save(state.workspace.revision, { type: 'restore-custom-purpose', purposeId, targetMonthlyWon }); if (result.status !== 'saved') { if (result.status === 'conflict') captureIntentConflict({ kind: 'purpose', id: purposeId, edit: { base: { name: restoringPurpose.name, targetMonthlyWon: restoringPurpose.targetMonthlyWon, archivedAt: restoringPurpose.archivedAt }, next: { name: restoringPurpose.name, targetMonthlyWon, archivedAt: undefined } } }); else dispatch({ type: 'save-failed', reason: failureReason(result) }); return false; } pendingModalWorkspaceRef.current = result.workspace; return true; }} />}</AppContentFrame></AppShell>;
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
    if ((state.mode !== 'setup' && state.mode !== 'map') || state.recovery.status !== 'none' || state.save.status === 'pending') return false;
    const surface = state.mode === 'setup' ? 'draft' as const : 'applied' as const;
    dispatch({ type: 'save-requested' });
    const intent: AccountMapEditIntent = {
      kind: 'add-link',
      surface,
      purposeId: input.purposeId,
      locationId: input.locationId,
      base: null,
      ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
    };
    const command = input.restoreLocation === true
      ? {
          type: 'restore-and-connect-location' as const,
          surface,
          purposeId: input.purposeId,
          locationId: input.locationId,
          ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
        }
      : input.newLocation === undefined
      ? {
          type: 'connect-location' as const,
          surface,
          purposeId: input.purposeId,
          locationId: input.locationId,
          ...(input.monthlyAmountWon === undefined ? {} : { monthlyAmountWon: input.monthlyAmountWon }),
        }
      : {
          type: 'create-and-connect-location' as const,
          surface,
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
    if (state.mode === 'map') {
      pendingModalWorkspaceRef.current = result.workspace;
      return true;
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
    if ((state.mode !== 'setup' && state.mode !== 'map') || state.recovery.status !== 'none' || state.save.status === 'pending') return { status: 'recovery' };
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, {
      type: 'remove-transfer',
      surface: state.mode === 'map' ? 'applied' : 'draft',
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
  ): Promise<AccountMapTransferSaveResult> {
    if (state.mode !== 'map' || state.recovery.status !== 'none' || state.save.status === 'pending') return { status: 'recovery' };
    dispatch({ type: 'save-requested' });
    const command = editor.mode === 'add'
      ? { type: 'add-transfer' as const, surface: 'applied' as const, transfer: { ...value, id: createId() } }
      : { type: 'edit-transfer' as const, surface: 'applied' as const, transferId: editor.transferId, fields: value };
    const result = await resolved.accountMap.save(state.workspace.revision, command);
    if (result.status === 'saved') {
      dispatch({ type: 'transfer-save-succeeded', workspace: result.workspace });
      return { status: 'saved' };
    }
    if (result.status === 'conflict') {
      if (editor.mode === 'edit') captureTransferManualConflict('edit-transfer', editor.transferId, 'compound-edit');
      else captureManualConflict('edit-transfer', []);
      return { status: 'recovery' };
    }
    dispatch({ type: 'save-failed', reason: failureReason(result) });
    return transferSaveFailure(result);
  }

  async function savePurposeEdit(purposeId: PurposeId, input: AccountMapNodeEditInput): Promise<boolean> {
    if (state.mode !== 'map' || state.recovery.status !== 'none' || state.save.status === 'pending') return false;
    const applied = structuredClone(state.applied);
    const now = Date.now();
    const edits = new Map(input.links.map((link) => [link.id, link]));
    applied.links = applied.links.flatMap((link) => {
      const edit = edits.get(link.id);
      if (edit === undefined) return [link];
      if (edit.status === 'removed') return [];
      const { suspendedReason: _suspendedReason, ...baseLink } = link.status === 'suspended'
        ? link
        : { ...link, suspendedReason: undefined };
      const base = { ...baseLink, monthlyAmountWon: edit.monthlyAmountWon, updatedAt: now };
      return [edit.status === 'active'
        ? { ...base, status: 'active' as const, remainder: edit.remainder }
        : { ...base, status: 'suspended' as const, remainder: false as const, suspendedReason: 'user' as const }];
    });
    applied.customPurposes = applied.customPurposes.map((purpose) => purpose.id !== purposeId ? purpose : {
      ...purpose, name: input.label ?? purpose.name, targetMonthlyWon: input.targetMonthlyWon ?? purpose.targetMonthlyWon, updatedAt: now,
    });
    const remainder = applied.links.find((link) => link.purposeId === purposeId && link.status === 'active' && link.remainder);
    if (remainder !== undefined) {
      const result = recalculateRemainder(purposeId, remainder.id, reconcilePurpose(purposeId, applied, state.workspace.locations, state.main).targetWon, applied.links);
      if (!result.ok) { setPurposeError('목적의 고정 배정이 Main 기준을 넘습니다. 고정 금액을 줄인 뒤 다시 저장해 주세요.'); return false; }
      applied.links = result.links;
    }
    applied.updatedAt = now;
    return savePurposeMap(applied, [{ kind: 'node', id: purposeId }, ...manualLinkTargets(input.links.map(({ id }) => id), 'link')]);
  }

  async function savePurposeMap(applied: AccountMapApplied, targets: ManualRecoveryTarget[]): Promise<boolean> {
    if (state.mode !== 'map' || state.recovery.status !== 'none' || state.save.status === 'pending') return false;
    setPurposeError(null);
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'edit-map-node', applied });
    if (result.status === 'saved') { pendingModalWorkspaceRef.current = result.workspace; return true; }
    if (result.status === 'conflict') captureManualConflict('edit-node', targets);
    else {
      dispatch({ type: 'save-failed', reason: failureReason(result) });
      setPurposeError(result.status === 'rejected'
        ? '목적의 고정 배정·세부 목적 합계가 기준 금액을 넘지 않는지, 수입 연결과 나머지 배정 계좌가 남아 있는지 확인해 주세요.'
        : '저장소에 접근하지 못했습니다. 입력을 유지했습니다. 다시 저장해 주세요.');
    }
    return false;
  }

  function closePurposeEditor(): void {
    const pending = pendingModalWorkspaceRef.current;
    pendingModalWorkspaceRef.current = null;
    const recovered = pendingModalRecoveryRef.current;
    pendingModalRecoveryRef.current = false;
    if (pending !== null) dispatch({ type: recovered ? 'reapply-succeeded' : 'save-succeeded', workspace: pending });
    setPurposeEditorId(null);
    setAddingPurpose(false);
    setPurposeError(null);
  }

  async function confirmCurrentMain(): Promise<void> {
    if (state.mode !== 'map' || !state.mainConfirmationRequired || state.recovery.status !== 'none') return;
    dispatch({ type: 'save-requested' });
    const result = await resolved.accountMap.save(state.workspace.revision, { type: 'confirm-current-main' });
    if (result.status === 'saved') {
      dispatch({ type: 'main-confirmation-succeeded', workspace: result.workspace });
      return;
    }
    dispatch({ type: 'main-confirmation-failed', reason: failureReason(result) });
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


  return <AppShell currentApp="account-map" managementMenu={management}><AppContentFrame className="account-map-page"><AccountMapSetup workspace={state.workspace} main={state.main} draft={state.draft} step={state.step} calculation={setupProjection!.calculation} suggestions={setupProjection!.suggestions} review={setupProjection!.review} canApply={setupProjection!.canApply} mainChanged={state.mainChanged} saveFailed={state.save.status === 'failed'} recoveryPending={state.save.status === 'pending'} recovery={state.recovery} onReapply={reapplyIntent} onKeepLatest={keepLatest} onRequestMainEdit={(target) => { onRequestMainEdit?.(target); }} onCommitConnection={commitConnection} onSaveDraft={saveDraft} onAddTransfer={addTransfer} onEditTransfer={editTransfer} onRemoveTransfer={removeTransfer} onApply={() => void applyMap()} onExit={() => { if (state.recovery.status !== 'none') return; dispatch({ type: 'setup-exited' }); window.location.assign(appPath('main')); }} onCancelSetup={() => { if (state.recovery.status !== 'none') return; void resolved.accountMap.reset(state.workspace.revision).then((result) => { if (result.status === 'saved') dispatch({ type: 'setup-cancelled', workspace: result.workspace }); else if (result.status === 'conflict') captureManualConflict('cancel-setup', []); else dispatch({ type: 'save-failed', reason: failureReason(result) }); }); }} />{locationRestoreModal}</AppContentFrame></AppShell>;


  async function reapplyIntent(): Promise<boolean> {
    if ((state.mode !== 'setup' && state.mode !== 'map') || state.recovery.status === 'none') return false;
    if (state.recovery.status === 'manual') {
      dispatch({ type: 'review-latest' });
      return false;
    }
    const { latest, intent } = state.recovery;
    if (latest.main.applied === null) {
      keepLatest();
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
      if (state.mode === 'map' && (state.interaction.modalNodeId !== null || restorePurposeId !== null || purposeEditorId !== null)) {
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
  recoveryScope,
  recovery,
  onReviewLatest,
  onKeepLatest,
  onClose,
  onSave,
  onRemove,
}: {
  locations: readonly FinancialLocation[];
  initialValue: Partial<AccountTransferEditorValue>;
  recoveryScope: string;
  recovery: RecoveryState;
  onReviewLatest(): Promise<boolean>;
  onKeepLatest(): void;
  onClose(): void;
  onSave(value: AccountTransferEditorValue): Promise<AccountMapTransferSaveResult>;
  onRemove?(): Promise<AccountMapTransferSaveResult>;
}): JSX.Element {
  const session = useContext(AccountDraftContext);
  const recoveryKey = `account-map-transfer:${recoveryScope}`;
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackId = useId();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const dialogRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  function discardAndClose(): void {
    session?.recordRecoveryDraft(recoveryKey, null);
    onClose();
  }
  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.querySelector<HTMLElement>('button, select, input, [tabindex]:not([tabindex="-1"])')?.focus();
    return () => returnFocusRef.current?.focus();
  }, []);
  useEffect(() => {
    if (recovery.status !== 'none') dialogRef.current?.querySelector<HTMLElement>('.account-map-error button')?.focus();
  }, [recovery.status]);
  useEffect(() => {
    if (feedback !== null && !pending) dialogRef.current?.querySelector<HTMLElement>('select')?.focus();
  }, [feedback, pending]);
  useEffect(() => {
    if (pending) dialogRef.current?.focus();
  }, [pending]);
  async function submit(action: () => Promise<AccountMapTransferSaveResult>): Promise<boolean> {
    if (pendingRef.current || recovery.status !== 'none') return false;
    pendingRef.current = true;
    setPending(true);
    setFeedback(null);
    try {
      const result = await action();
      if (result.status === 'saved') discardAndClose();
      else if (result.status === 'validation') {
        setFeedback(result.message);
      } else if (result.status === 'failed') setFeedback('저장하지 못했습니다. 입력을 유지했습니다. 다시 시도해 주세요.');
      return result.status === 'saved';
    } catch {
      setFeedback('저장소에 접근하지 못했습니다. 입력을 유지했습니다. 다시 시도해 주세요.');
      return false;
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }
  const trapFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); if (!pendingRef.current) discardAndClose(); return; }
    if (event.key !== 'Tab') return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
    if (focusable.length === 0) { event.preventDefault(); dialogRef.current?.focus(); return; }
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  return <div className="account-map-modal-backdrop"><section ref={dialogRef} tabIndex={-1} className="account-map-modal account-flow-editor-modal" role="dialog" aria-modal="true" aria-label="계좌 흐름 편집" aria-busy={pending || undefined} onKeyDown={trapFocus}>
    <header><div><p>월 계획 흐름</p><h2>계좌 흐름 편집</h2></div><button type="button" className="account-map-modal__close" aria-label="닫기" disabled={pending} onClick={discardAndClose}>×</button></header>
    <div className="account-map-modal__body">
      <AccountTransferEditor recoveryScope={recoveryScope} locations={locations} initialValue={initialValue} disabled={pending || recovery.status !== 'none'} errorDescriptionId={feedback === null ? undefined : feedbackId} onCancel={discardAndClose} onSave={(value) => submit(() => onSave(value))} />
      {onRemove === undefined ? null : <Button type="button" variant="secondary" disabled={pending || recovery.status !== 'none'} onClick={() => void submit(onRemove)}>흐름 삭제</Button>}
      {feedback === null ? null : <p id={feedbackId} role="alert" className="account-map-modal__error">{feedback}</p>}
      {recovery.status === 'none' ? null : <RecoveryControls recovery={recovery} pending={pending} onReapply={onReviewLatest} onKeepLatest={() => { session?.recordRecoveryDraft(recoveryKey, null); onKeepLatest(); }} />}
    </div>
  </section></div>;
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
