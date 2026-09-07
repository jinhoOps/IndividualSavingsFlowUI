import { useEffect, useMemo, useRef, useState, type JSX } from 'react';
import { Button } from '../../components/common/Button';
import { FormattedMoneyInput } from '../../components/common/FormattedMoneyInput';
import { useAnimeScope } from '../../components/motion/useAnimeScope';
import type { MainData } from '../../main/domain/model';
import type { FinancialLocation } from '../../workspace/domain/financialLocation';
import type { WorkspaceDocument } from '../../workspace/domain/model';
import type { RecoveryState } from '../application/reducer';
import type { AccountMapReviewProjection } from '../application/setupProjection';
import type { AccountFlowCalculation } from '../domain/accountFlowCalculator';
import type { AccountTransferSuggestion } from '../domain/accountFlowSuggestion';
import { projectAccountMapDraftForView } from '../domain/accountMapVersioning';
import type {
  AccountMapDraftV2,
  AccountMapSetupStep,
  OutflowPurposeId,
  PurposeId,
  StoredAccountMapDraft,
} from '../domain/model';
import { customPurposeTargetCapacity } from '../domain/reconciliation';
import { animateSetupStep, setSetupStepFinalState } from './motion';
import { AccountMapBasisStep, type MainPlanEditTarget } from './setup/AccountMapBasisStep';
import { AccountMapLocationsStep } from './setup/AccountMapLocationsStep';
import { AccountMapReviewStep } from './setup/AccountMapReviewStep';
import { AccountMapTransfersStep, type AccountMapTransferSaveResult } from './setup/AccountMapTransfersStep';
import type { AccountTransferEditorValue } from './AccountTransferEditor';

export type AccountMapDraftSaveResult =
  | { status: 'saved' }
  | { status: 'recovery' }
  | { status: 'field-error'; field: 'name' | 'amount'; message: string }
  | { status: 'failed'; message: string };

export interface AccountMapSetupProps {
  workspace: WorkspaceDocument;
  main: MainData;
  draft: StoredAccountMapDraft | null;
  step: AccountMapSetupStep;
  calculation: AccountFlowCalculation;
  suggestions: readonly AccountTransferSuggestion[];
  review: AccountMapReviewProjection;
  canApply: boolean;
  mainChanged: boolean;
  saveFailed: boolean;
  recoveryPending: boolean;
  recovery: RecoveryState;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
  /** A request only; the journey host owns Main editing and persistence. */
  onRequestMainEdit(target: MainPlanEditTarget): void;
  onCommitConnection(input: {
    purposeId: PurposeId;
    locationId: string;
    newLocation?: FinancialLocation;
    monthlyAmountWon?: number;
    restoreLocation?: boolean;
  }): Promise<boolean>;
  onSaveDraft(draft: AccountMapDraftV2): Promise<AccountMapDraftSaveResult>;
  onAddTransfer(value: AccountTransferEditorValue & { id: string }): Promise<AccountMapTransferSaveResult>;
  onEditTransfer(id: string, value: AccountTransferEditorValue): Promise<AccountMapTransferSaveResult>;
  onRemoveTransfer(id: string): Promise<AccountMapTransferSaveResult>;
  onApply(): void;
  onExit(): void;
  onCancelSetup(): void;
}

const STEPS: readonly AccountMapSetupStep[] = ['basis', 'locations', 'transfers', 'review'];

/**
 * The setup shell owns only the current-step transition and footer navigation.
 * Every mutation is emitted to an Account Map command owned by the host.
 */
export function AccountMapSetup(props: AccountMapSetupProps): JSX.Element {
  const [customOpen, setCustomOpen] = useState(false);
  const renderedStepRef = useRef<AccountMapSetupStep>(props.step);
  const draft = useMemo(() => props.draft === null
    ? emptyGuidedDraft(props.main.updatedAt)
    : projectAccountMapDraftForView(props.draft), [props.draft, props.main.updatedAt]);
  const currentStep = props.step;
  const currentIndex = STEPS.indexOf(currentStep);
  const previousStep = currentIndex > 0 ? STEPS[currentIndex - 1] : undefined;
  const nextStep = currentIndex < STEPS.length - 1 ? STEPS[currentIndex + 1] : undefined;
  const mutationsDisabled = props.recovery.status !== 'none' || props.recoveryPending;
  const stepRootRef = useAnimeScope<HTMLElement>(({ root, reducedMotion }) => {
    const changedStep = renderedStepRef.current !== currentStep;
    renderedStepRef.current = currentStep;
    if (!changedStep) {
      setSetupStepFinalState(root);
      return;
    }
    const animation = animateSetupStep(root, 'forward', reducedMotion);
    return () => {
      animation.cancel();
      setSetupStepFinalState(root);
    };
  }, [currentStep]);

  async function persistStep(step: AccountMapSetupStep): Promise<void> {
    if (mutationsDisabled) return;
    await props.onSaveDraft({ ...draft, step, updatedAt: Date.now() });
  }

  function goBack(): void {
    if (previousStep === undefined || mutationsDisabled) return;
    if (stepRootRef.current !== null) setSetupStepFinalState(stepRootRef.current);
    void persistStep(previousStep);
  }

  function renderStep(): JSX.Element {
    if (currentStep === 'basis') {
      return <AccountMapBasisStep
        main={props.main}
        disabled={mutationsDisabled}
        onContinue={() => { if (nextStep !== undefined) void persistStep(nextStep); }}
        onRequestMainEdit={props.onRequestMainEdit}
      />;
    }
    if (currentStep === 'locations') {
      return <AccountMapLocationsStep
        key={draft.updatedAt}
        main={props.main}
        locations={props.workspace.locations}
        draft={draft}
        disabled={mutationsDisabled}
        onCommitConnection={props.onCommitConnection}
        onAddCustomPurpose={() => setCustomOpen(true)}
      />;
    }
    if (currentStep === 'transfers') {
      return <AccountMapTransfersStep
        locations={props.workspace.locations}
        draft={draft}
        calculation={props.calculation}
        suggestions={props.suggestions}
        disabled={mutationsDisabled}
        onAddTransfer={props.onAddTransfer}
        onEditTransfer={props.onEditTransfer}
        onRemoveTransfer={props.onRemoveTransfer}
      />;
    }
    return <AccountMapReviewStep
      locations={props.workspace.locations}
      review={props.review}
      canApply={props.canApply}
    />;
  }

  return (
    <section ref={stepRootRef} className="account-map-setup" aria-labelledby="account-map-setup-title">
      <div className="account-map-setup__progress" aria-label={`설정 ${currentIndex + 1} / ${STEPS.length}`}>
        <span style={{ width: `${((currentIndex + 1) / STEPS.length) * 100}%` }} />
      </div>
      {props.mainChanged ? <p className="account-map-alert" role="status"><strong>Main의 월 금액이 바뀌었어요</strong><span>최신 기준으로 흐름을 다시 확인해 주세요.</span></p> : null}
      <div data-account-map-setup-step>{renderStep()}</div>
      {props.saveFailed ? <p className="account-map-error" role="alert">저장하지 못했어요. 입력은 그대로 두었습니다.</p> : null}
      {props.recovery.status === 'none' ? null : <RecoveryControls recovery={props.recovery} pending={props.recoveryPending} onReapply={props.onReapply} onKeepLatest={() => { props.onKeepLatest(); setCustomOpen(false); }} />}
      <footer className="account-map-setup__footer">
        <div>
          <Button variant="quiet" type="button" disabled={mutationsDisabled} onClick={props.onExit}>나가기</Button>
          {props.draft === null ? null : <Button variant="secondary" type="button" disabled={mutationsDisabled} onClick={props.onCancelSetup}>설정 취소</Button>}
        </div>
        <div>
          {previousStep === undefined ? null : <Button variant="secondary" type="button" disabled={mutationsDisabled} onClick={goBack}>이전</Button>}
          {nextStep === undefined ? <Button variant="primary" type="button" disabled={mutationsDisabled || !props.canApply} onClick={props.onApply}>지도 만들기</Button> : currentStep === 'basis' ? null : <Button variant="primary" type="button" disabled={mutationsDisabled} onClick={() => void persistStep(nextStep)}>다음</Button>}
        </div>
      </footer>
      {!customOpen ? null : <CustomPurposeDialog
        main={props.main}
        draft={draft}
        disabled={mutationsDisabled}
        onCancel={() => {
          if (props.recovery.status !== 'none') props.onKeepLatest();
          setCustomOpen(false);
        }}
        onSave={props.onSaveDraft}
      />}
    </section>
  );
}

function emptyGuidedDraft(sourceMainUpdatedAt: number): AccountMapDraftV2 {
  return {
    schemaVersion: 2,
    sourceMainUpdatedAt,
    customPurposes: [],
    links: [],
    transfers: [],
    step: 'basis',
    updatedAt: Date.now(),
  };
}

export function RecoveryControls({ recovery, pending = false, onReapply, onKeepLatest }: {
  recovery: Exclude<RecoveryState, { status: 'none' }>;
  pending?: boolean;
  onReapply(): Promise<boolean>;
  onKeepLatest(): void;
}): JSX.Element {
  const manual = recovery.status === 'manual';
  const targetMissing = (recovery.status === 'collision' || manual) && recovery.reason === 'target-missing';
  return <div className="account-map-error" role={manual || recovery.status === 'collision' ? 'alert' : 'status'}>
    <p>{targetMissing
      ? '편집 대상이 최신 상태에 없습니다. 최신 값을 유지한 뒤 현재 흐름을 확인해 주세요.'
      : manual
      ? '여러 변경을 최신 상태에 자동으로 다시 적용하지 않습니다. 입력을 검토한 뒤 다시 저장해 주세요.'
        : '다른 곳에서 변경된 최신 상태를 불러왔어요. 입력은 그대로 두었습니다.'}</p>
    <div className="account-map-setup__actions">
      <Button variant="primary" type="button" disabled={pending} onClick={() => void onReapply()}>{manual ? '최신 상태에서 다시 검토' : '최신 상태에서 다시 적용'}</Button>
      <Button variant="secondary" type="button" disabled={pending} onClick={onKeepLatest}>최신 값 유지</Button>
    </div>
  </div>;
}

export function CustomPurposeDialog({ main, draft, disabled, onCancel, onSave, recoveryContent }: {
  main: MainData;
  draft: AccountMapDraftV2;
  disabled: boolean;
  onCancel(): void;
  onSave(draft: AccountMapDraftV2): Promise<AccountMapDraftSaveResult>;
  recoveryContent?: React.ReactNode;
}): JSX.Element {
  const panelRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCancelRef = useRef(onCancel);
  const pendingRef = useRef(false);
  onCancelRef.current = onCancel;
  const [parentId, setParentId] = useState<OutflowPurposeId>('system:living');
  const [name, setName] = useState('');
  const [amountWon, setAmountWon] = useState(0);
  const [pending, setPending] = useState(false);
  pendingRef.current = pending;
  const [feedback, setFeedback] = useState<Exclude<AccountMapDraftSaveResult, { status: 'saved' | 'recovery' }> | null>(null);
  const capacity = customPurposeTargetCapacity(parentId, draft.customPurposes, main);
  const valid = name.trim() !== '' && amountWon > 0 && amountWon <= capacity;

  useEffect(() => {
    if (returnFocusRef.current === null) returnFocusRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.querySelector<HTMLElement>('select, input, button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!pendingRef.current) onCancelRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = [...(panelRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)') ?? [])];
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, []);

  useEffect(() => {
    if (pending) panelRef.current?.focus();
  }, [pending]);

  async function submit(): Promise<void> {
    if (!valid || pending || disabled) return;
    const now = Date.now();
    setPending(true);
    setFeedback(null);
    try {
      const result = await onSave({
        ...draft,
        customPurposes: [...draft.customPurposes, {
          id: `custom:${createId()}`,
          parentId,
          name: name.trim(),
          targetMonthlyWon: amountWon,
          createdAt: now,
          updatedAt: now,
        }],
        updatedAt: now,
      });
      if (result.status === 'saved') onCancel();
      else if (result.status !== 'recovery') setFeedback(result);
    } catch {
      setFeedback({ status: 'failed', message: '저장하지 못했어요. 입력은 그대로 두었습니다.' });
    } finally {
      setPending(false);
    }
  }

  return <div className="account-map-sheet-backdrop" onPointerDown={(event) => {
    if (event.target === event.currentTarget && !pending) onCancel();
  }}>
    <section ref={panelRef} className="account-map-sheet account-map-sheet--compact" role="dialog" aria-modal="true" aria-label="세부 목적 추가" aria-busy={pending || undefined} tabIndex={pending ? -1 : undefined}>
      <header><h2>세부 목적 추가</h2></header>
      <div className="account-map-sheet__body">
        <label>큰 목적<select value={parentId} disabled={disabled || pending} onChange={(event) => { setParentId(event.target.value as OutflowPurposeId); setFeedback(null); }}><option value="system:housing">주거</option><option value="system:living">생활비</option><option value="system:saving">저축</option><option value="system:investing">투자</option></select></label>
        <label>목적 이름<input value={name} maxLength={24} disabled={disabled || pending} onChange={(event) => { setName(event.target.value); setFeedback(null); }} /></label>
        <label>월 금액<FormattedMoneyInput valueWon={amountWon} onValueWonChange={(value) => { setAmountWon(value); setFeedback(null); }} zeroDisplay="zero" disabled={disabled || pending} aria-label="월 금액" /></label>
        <p className="account-map-hint">추가 가능 {formatWon(capacity)}</p>
        {amountWon > capacity ? <p className="account-map-error" role="alert">큰 목적의 월 금액을 넘을 수 없습니다.</p> : null}
        {feedback === null ? null : <p className="account-map-error" role="alert">{feedback.message}</p>}
        {recoveryContent}
      </div>
      <footer><Button variant="secondary" type="button" disabled={pending} onClick={onCancel}>취소</Button><Button variant="primary" type="button" disabled={!valid || disabled || pending} onClick={() => void submit()}>추가</Button></footer>
    </section>
  </div>;
}

function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatWon(value: number): string {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`;
}
