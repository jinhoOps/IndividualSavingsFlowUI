import { useContext, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref, type RefObject } from 'react';
import { Trash2 } from 'lucide-react';
import { AccountDraftContext, useAccountRecovery, useInitialRecovery } from '../../auth/AccountDraftContext';
import { AccountProductBoundary } from '../../auth/AccountManagementContext';
import { Button } from '../../components/common/Button';
import { MoneyAdjustments } from '../../components/common/MoneyAdjustments';
import { ResponsiveDialog, useResponsiveDialogClose } from '../../components/common/ResponsiveDialog';
import { ResponsiveDialogActionRow, ResponsiveDialogLayout } from '../../components/common/ResponsiveDialogLayout';
import { SegmentedControl } from '../../components/common/SegmentedControl';
import { adjustWon, formatWonInput, normalizeMoneyEdit, parseWonInput } from '../../core/domain/moneyInput';
import { normalizePortfolioName, recommendClassification } from '../domain/classification';
import type { Classification, ClassificationOrigin } from '../domain/model';
import { formatAllocationPercent } from './format';

const QUICK_TARGET_NAMES = ['S&P 500', '나스닥', '코스피', '미국 국채', '금 현물'] as const;
export interface PortfolioItemSheetValue {
  name: string;
  amountWon: number;
  classification: Classification;
  classificationOrigin: ClassificationOrigin;
}

export interface PortfolioItemSheetProps {
  mode: 'add' | 'edit';
  initialValue: PortfolioItemSheetValue;
  existingNames: string[];
  investmentWon: number;
  returnFocusRef: RefObject<HTMLElement | null>;
  inline?: boolean;
  inlineStage?: boolean;
  navigationRef?: Ref<PortfolioItemSheetNavigation>;
  onComplete(value: PortfolioItemSheetValue): string | void;
  onRemove?(): void;
  onClose(): void;
}

export interface PortfolioItemSheetNavigation {
  requestClose(): void;
}

export function PortfolioItemSheet({
  mode,
  initialValue,
  existingNames,
  investmentWon,
  returnFocusRef,
  inline = false,
  inlineStage = false,
  navigationRef,
  onComplete,
  onRemove,
  onClose,
}: PortfolioItemSheetProps) {
  const recoveryKey = mode === 'add' ? 'portfolio-item:add' : `portfolio-item:edit:${initialValue.name}`;
  const recovered = useInitialRecovery(recoveryKey, parseItemRecovery);
  const session = useContext(AccountDraftContext);
  const [name, setName] = useState(recovered?.name ?? initialValue.name);
  const [amount, setAmount] = useState(() => recovered?.amount ?? formatWonInput(initialValue.amountWon));
  const [classification, setClassification] = useState(recovered?.classification ?? initialValue.classification);
  const [classificationOrigin, setClassificationOrigin] = useState(recovered?.classificationOrigin ?? initialValue.classificationOrigin);
  const [nameTouched, setNameTouched] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const amountInputRef = useRef<HTMLInputElement>(null);
  const discardReturnFocusRef = useRef<HTMLElement | null>(null);
  const pendingCloseRef = useRef<((approved: boolean) => void) | null>(null);
  const inlineCloseRequestedRef = useRef(false);
  const pendingCaretRef = useRef<number | null>(null);
  const amountWon = parseWonInput(amount);
  const normalizedName = normalizePortfolioName(name);
  const duplicateName = normalizedName.length > 0
    && existingNames.some((candidate) => normalizePortfolioName(candidate) === normalizedName);
  const nameError = normalizedName.length === 0
    ? '투자 대상 이름을 입력해 주세요.'
    : duplicateName ? '같은 이름의 투자 대상이 이미 있습니다.' : null;
  const amountError = !Number.isInteger(amountWon) || amountWon < 1_000
    ? '투자 대상 금액은 1,000원 이상이어야 합니다.'
    : amountWon > investmentWon ? '월 투자금을 초과할 수 없습니다.' : commitError;
  const dirty = name !== initialValue.name
    || amount !== formatWonInput(initialValue.amountWon)
    || classification !== initialValue.classification
    || classificationOrigin !== initialValue.classificationOrigin;
  const title = mode === 'add' ? '투자 대상 추가' : '투자 대상 수정';
  useAccountRecovery(recoveryKey, { name, amount, classification, classificationOrigin }, dirty);

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null || amountInputRef.current === null) return;
    amountInputRef.current.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  });

  useLayoutEffect(() => {
    if (!inline) nameInputRef.current?.focus();
  }, [inline]);

  useEffect(() => {
    if (inline) nameInputRef.current?.focus();
  }, [inline]);

  useEffect(() => () => {
    pendingCloseRef.current?.(false);
    pendingCloseRef.current = null;
  }, []);

  function requestSurfaceClose(): boolean | Promise<boolean> {
    if (dirty) {
      discardReturnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : nameInputRef.current;
      setConfirmDiscard(true);
      return new Promise((resolve) => { pendingCloseRef.current = resolve; });
    }
    session?.recordRecoveryDraft(recoveryKey, null);
    return true;
  }

  function requestInlineClose(): void {
    const approved = requestSurfaceClose();
    if (typeof approved === 'object') {
      inlineCloseRequestedRef.current = true;
      void approved.then((allowed) => {
        if (allowed && inlineCloseRequestedRef.current) {
          inlineCloseRequestedRef.current = false;
          onClose();
        }
      });
    } else if (approved) onClose();
  }

  useImperativeHandle(navigationRef, () => ({ requestClose: requestInlineClose }));

  function cancelDiscard(): void {
    setConfirmDiscard(false);
    inlineCloseRequestedRef.current = false;
    const resolve = pendingCloseRef.current;
    pendingCloseRef.current = null;
    resolve?.(false);
  }

  function discardChanges(): void {
    session?.recordRecoveryDraft(recoveryKey, null);
    setConfirmDiscard(false);
    const resolve = pendingCloseRef.current;
    pendingCloseRef.current = null;
    if (resolve) {
      if (inlineCloseRequestedRef.current) {
        inlineCloseRequestedRef.current = false;
        onClose();
      }
      resolve(true);
    }
    else onClose();
  }

  function updateName(nextName: string): void {
    setNameTouched(true);
    setName(nextName);
    if (classificationOrigin === 'automatic') {
      setClassification(recommendClassification(nextName));
    }
  }

  function quickFillName(nextName: string): void {
    updateName(nextName);
    amountInputRef.current?.focus();
  }

  const removeItem = () => {
    session?.recordRecoveryDraft(recoveryKey, null);
    onRemove?.();
  };

  const fields = (
    <div className="portfolio-item-sheet__fields">
          <div className="portfolio-item-sheet__identity">
            <label>
              <span>투자 대상 이름</span>
              <input
                ref={nameInputRef}
                data-dialog-initial-focus
                aria-label="투자 대상 이름"
                aria-invalid={nameTouched && nameError ? 'true' : undefined}
                aria-describedby={nameTouched && nameError ? 'portfolio-item-name-error' : undefined}
                value={name}
                onChange={(event) => updateName(event.target.value)}
              />
              {nameTouched && nameError ? <span className="portfolio-editor__field-error" id="portfolio-item-name-error">{nameError}</span> : null}
            </label>
            <div className="portfolio-item-sheet__classification">
              <SegmentedControl
                label="투자 대상 분류"
                value={classification}
                options={[{ value: 'growth', label: '성장' }, { value: 'stable', label: '안정' }]}
                onChange={(value) => {
                  setClassification(value);
                  setClassificationOrigin('user');
                }}
              />
              <div className="portfolio-item-sheet__classification-origin">
                <span>{classificationOrigin === 'automatic' ? '자동 추천' : '사용자 지정'}</span>
                {classificationOrigin === 'user' ? (
                  <Button
                    type="button"
                    variant="quiet"
                    onClick={() => {
                      setClassification(recommendClassification(name));
                      setClassificationOrigin('automatic');
                    }}
                  >자동 추천 사용</Button>
                ) : null}
              </div>
            </div>
          </div>
          {mode === 'add' ? (
            <div className="portfolio-item-sheet__quick-targets" role="group" aria-label="대표 투자 대상">
              {QUICK_TARGET_NAMES.map((quickName) => (
                <button
                  key={quickName}
                  type="button"
                  className="portfolio-item-sheet__quick-target"
                  onClick={() => quickFillName(quickName)}
                >{quickName}</button>
              ))}
            </div>
          ) : null}
          <label className="portfolio-item-sheet__amount">
            <span>금액</span>
            <span className="portfolio-item-sheet__amount-control"><input
              ref={amountInputRef}
              inputMode="numeric"
              aria-label="금액"
              aria-invalid={amountTouched && amountError ? 'true' : undefined}
              aria-describedby={amountTouched && amountError ? 'portfolio-item-amount-error' : amountError ? undefined : 'portfolio-item-calculated-percentage'}
              value={amount}
              onChange={(event) => {
                const normalized = normalizeMoneyEdit(
                  event.target.value,
                  event.target.selectionStart ?? event.target.value.length,
                  { zeroDisplay: 'zero' },
                );
                pendingCaretRef.current = normalized.caret;
                setAmountTouched(true);
                setCommitError(null);
                setAmount(normalized.displayValue);
              }}
            />
            <span aria-hidden="true">원</span></span>
            {amountTouched && amountError ? (
              <span className="portfolio-editor__field-error" id="portfolio-item-amount-error">{amountError}</span>
            ) : amountError === null ? (
              <span className="portfolio-item-sheet__calculated" id="portfolio-item-calculated-percentage">
                계산 비율 {formatAllocationPercent(investmentWon > 0 ? amountWon / investmentWon * 100 : 0)}
              </span>
              ) : null}
          </label>
          <MoneyAdjustments
            className="portfolio-item-sheet__quick-adjustments"
            label="빠른 조정"
            onAdjust={(deltaWon) => {
              setAmountTouched(true);
              setCommitError(null);
              setAmount(formatWonInput(adjustWon(amountWon, deltaWon)));
            }}
          />
    </div>
  );

  const complete = () => {
    const error = onComplete({ name: name.trim(), amountWon, classification, classificationOrigin });
    if (error) {
      setCommitError(error);
      setAmountTouched(true);
      amountInputRef.current?.focus();
      return;
    }
    session?.recordRecoveryDraft(recoveryKey, null);
  };

  const actions = (inlineActions: boolean) => (
    <PortfolioItemActions
      inline={inlineActions}
      disabled={nameError !== null || amountError !== null}
      requestInlineClose={requestInlineClose}
      onComplete={complete}
    />
  );

  return (
    <>
      {inline ? (
        <section className="portfolio-item-form" aria-labelledby={inlineStage ? undefined : 'portfolio-item-sheet-title'}
          aria-label={inlineStage ? title : undefined}
          onKeyDown={(event) => {
            if (event.key !== 'Escape') return;
            event.preventDefault();
            event.stopPropagation();
            requestInlineClose();
          }}>
          {inlineStage ? null : <header className="portfolio-item-sheet__header">
            <h2 id="portfolio-item-sheet-title">{title}</h2>
            {mode === 'edit' && onRemove ? <button type="button" className="portfolio-item-sheet__remove" aria-label="투자 대상 삭제" onClick={removeItem}>
              <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
            </button> : null}
          </header>}
          {inlineStage && mode === 'edit' && onRemove ? <button type="button" className="portfolio-item-sheet__remove" aria-label="투자 대상 삭제" onClick={removeItem}>
            <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
          </button> : null}
          {fields}
          {actions(true)}
        </section>
      ) : (
        <ResponsiveDialog
          open
          labelledBy="portfolio-item-sheet-title"
          returnFocusRef={returnFocusRef}
          className="portfolio-item-sheet"
          onRequestClose={requestSurfaceClose}
          onClosed={onClose}
        >
          <AccountProductBoundary><ResponsiveDialogLayout
            title={title}
            titleId="portfolio-item-sheet-title"
            layout="edit"
            onClose={onClose}
            closeInitialFocus={false}
            context={mode === 'edit' && onRemove ? <button type="button" className="portfolio-item-sheet__remove" aria-label="투자 대상 삭제" onClick={removeItem}>
              <Trash2 aria-hidden="true" size={20} strokeWidth={2} />
            </button> : undefined}
            footer={actions(false)}
          >
            {fields}
          </ResponsiveDialogLayout></AccountProductBoundary>
        </ResponsiveDialog>
      )}
      {confirmDiscard ? (
        <ResponsiveDialog
          open
          labelledBy="portfolio-item-discard-title"
          returnFocusRef={discardReturnFocusRef}
          size="compact"
          onRequestClose={() => true}
          onClosed={cancelDiscard}
        >
          <AccountProductBoundary><ResponsiveDialogLayout
            title="입력 내용을 버릴까요?"
            titleId="portfolio-item-discard-title"
            layout="confirm"
            onClose={cancelDiscard}
            closeInitialFocus={false}
            footer={<PortfolioItemDiscardActions onContinue={cancelDiscard} onDiscard={discardChanges} />}
          >
            <p>완료하지 않은 변경 내용이 사라집니다.</p>
          </ResponsiveDialogLayout></AccountProductBoundary>
        </ResponsiveDialog>
      ) : null}
    </>
  );
}

function PortfolioItemActions({
  inline,
  disabled,
  requestInlineClose,
  onComplete,
}: {
  inline: boolean;
  disabled: boolean;
  requestInlineClose(): void;
  onComplete(): void;
}) {
  const requestDialogClose = useResponsiveDialogClose();
  return (
    <div className="portfolio-item-sheet__actions">
      <p>배분 초안에 반영돼요</p>
      <ResponsiveDialogActionRow>
        <Button type="button" variant="secondary" onClick={() => {
          if (inline) requestInlineClose();
          else requestDialogClose?.('button');
        }}>취소</Button>
        <Button type="button" variant="primary" disabled={disabled} onClick={onComplete}>완료</Button>
      </ResponsiveDialogActionRow>
    </div>
  );
}

function PortfolioItemDiscardActions({ onContinue, onDiscard }: { onContinue(): void; onDiscard(): void }) {
  const requestDialogClose = useResponsiveDialogClose();
  return (
    <ResponsiveDialogActionRow>
      <Button type="button" variant="secondary" data-dialog-initial-focus onClick={() => {
        onContinue();
        requestDialogClose?.('button');
      }}>계속 입력</Button>
      <Button type="button" variant="primary" onClick={onDiscard}>버리기</Button>
    </ResponsiveDialogActionRow>
  );
}

function parseItemRecovery(value: unknown): {
  name: string;
  amount: string;
  classification: Classification;
  classificationOrigin: ClassificationOrigin;
} | null {
  if (typeof value !== 'object' || value === null) return null;
  const draft = value as Record<string, unknown>;
  if (typeof draft.name !== 'string' || typeof draft.amount !== 'string') return null;
  if ((draft.classification !== 'growth' && draft.classification !== 'stable')
    || (draft.classificationOrigin !== 'automatic' && draft.classificationOrigin !== 'user')) return null;
  return {
    name: draft.name,
    amount: draft.amount,
    classification: draft.classification,
    classificationOrigin: draft.classificationOrigin,
  };
}
