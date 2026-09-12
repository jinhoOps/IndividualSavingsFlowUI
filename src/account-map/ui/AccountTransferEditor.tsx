import { useContext, useEffect, useId, useRef, useState, type JSX } from "react";
import {
  AccountDraftContext,
  useAccountRecovery,
  useInitialRecovery,
} from "../../auth/AccountDraftContext";
import { ArrowRight } from "lucide-react";
import { Button } from "../../components/common/Button";
import { FormattedMoneyInput } from "../../components/common/FormattedMoneyInput";
import type { AccountTransferAllocation } from "../domain/model";
import type { FinancialLocation } from "../../workspace/domain/financialLocation";

export interface AccountTransferEditorValue {
  sourceLocationId: string;
  targetLocationId: string;
  allocation: AccountTransferAllocation;
  status: "active" | "suspended";
}

export interface AccountTransferEditorProps {
  locations: readonly FinancialLocation[];
  onSave(value: AccountTransferEditorValue): boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  initialValue?: Partial<AccountTransferEditorValue>;
  /** Return false while a parent-owned discard confirmation is pending. */
  onCancel?(): boolean | void;
  errorDescriptionId?: string;
  recoveryScope?: string;
  onDirtyChange?(dirty: boolean): void;
}

/** A local transfer form. It emits a complete UI-valid value but never saves it. */
export function AccountTransferEditor({
  locations,
  onSave,
  disabled = false,
  initialValue,
  onCancel,
  errorDescriptionId,
  recoveryScope,
  onDirtyChange,
}: AccountTransferEditorProps): JSX.Element {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [localError, setLocalError] = useState(false);
  const radioName = useId();
  disabled = disabled || pending;
  const activeLocations = locations.filter(
    ({ archivedAt }) => archivedAt === undefined,
  );
  const activeLocationIds = new Set(activeLocations.map(({ id }) => id));
  const recoveryKey = recoveryScope === undefined
    ? ""
    : `account-map-transfer:${recoveryScope}`;
  const recovered = useInitialRecovery(recoveryKey, parseTransferRecovery);
  const session = useContext(AccountDraftContext);
  const initialSourceLocationId = initialValue?.sourceLocationId ?? "";
  const initialTargetLocationId = initialValue?.targetLocationId ?? "";
  const initialAllocationKind = initialValue?.allocation?.kind ?? "fixed";
  const initialMonthlyAmountWon = initialValue?.allocation?.kind === "fixed"
    ? initialValue.allocation.monthlyAmountWon
    : 0;
  const initialStatus = initialValue?.status ?? "active";
  const amountHintId = useId();
  const [sourceLocationId, setSourceLocationId] = useState(
    recovered !== null && activeLocationIds.has(recovered.sourceLocationId)
      ? recovered.sourceLocationId
      : initialSourceLocationId,
  );
  const [targetLocationId, setTargetLocationId] = useState(
    recovered !== null && activeLocationIds.has(recovered.targetLocationId)
      ? recovered.targetLocationId
      : initialTargetLocationId,
  );
  const [allocationKind, setAllocationKind] = useState<
    AccountTransferAllocation["kind"]
  >(recovered?.allocationKind ?? initialAllocationKind);
  const [monthlyAmountWon, setMonthlyAmountWon] = useState(
    recovered?.monthlyAmountWon ?? initialMonthlyAmountWon,
  );
  const [status, setStatus] = useState<"active" | "suspended">(
    recovered?.status ?? initialStatus,
  );
  const sameEndpoint =
    sourceLocationId !== "" && sourceLocationId === targetLocationId;
  const fixedAmountInvalid =
    allocationKind === "fixed" &&
    (!Number.isSafeInteger(monthlyAmountWon) || monthlyAmountWon <= 0);
  const canSave =
    !disabled &&
    sourceLocationId !== "" &&
    targetLocationId !== "" &&
    !sameEndpoint &&
    !fixedAmountInvalid;
  const allocation: AccountTransferAllocation =
    allocationKind === "sweep"
      ? { kind: "sweep" }
      : { kind: "fixed", monthlyAmountWon };
  const dirty = sourceLocationId !== initialSourceLocationId
    || targetLocationId !== initialTargetLocationId
    || allocationKind !== initialAllocationKind
    || monthlyAmountWon !== initialMonthlyAmountWon
    || status !== initialStatus;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useAccountRecovery(recoveryKey, {
    sourceLocationId,
    targetLocationId,
    allocationKind,
    monthlyAmountWon,
    status,
  }, dirty, recoveryScope !== undefined);

  function cancel(): void {
    if (onCancel?.() !== false) session?.recordRecoveryDraft(recoveryKey, null);
  }

  async function save(): Promise<void> {
    if (!canSave || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setFailed(false);
    setLocalError(false);
    try {
      const saved = await onSave({ sourceLocationId, targetLocationId, allocation, status });
      if (saved === true) session?.recordRecoveryDraft(recoveryKey, null);
      else if (saved === false) setFailed(true);
    } catch { setFailed(true); setLocalError(true); }
    finally { pendingRef.current = false; setPending(false); }
  }

  return (
    <section className="account-transfer-editor" aria-label="계좌 흐름 편집">
      <p className="account-map-hint">어디서 어디로, 매달 얼마를 보낼지 정해 주세요. 실제 이체는 실행되지 않습니다.</p>
      <div className="account-transfer-editor__route"><label>
        보내는 계좌
        <select
          value={sourceLocationId}
          aria-describedby={errorDescriptionId}
          disabled={disabled}
          onChange={(event) => setSourceLocationId(event.target.value)}
        >
          <option value="">선택해 주세요</option>
          {activeLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.shortName}
            </option>
          ))}
        </select>
      </label>
      <ArrowRight size={20} aria-hidden="true" /><label>
        받는 계좌
        <select
          value={targetLocationId}
          aria-describedby={errorDescriptionId}
          disabled={disabled}
          onChange={(event) => setTargetLocationId(event.target.value)}
        >
          <option value="">선택해 주세요</option>
          {activeLocations.map((location) => (
            <option key={location.id} value={location.id}>
              {location.shortName}
            </option>
          ))}
        </select>
      </label>
      </div><fieldset>
        <legend>금액 규칙</legend>
        <label>
          <input
            type="radio"
            name={radioName}
            checked={allocationKind === "fixed"}
            disabled={disabled}
            onChange={() => setAllocationKind("fixed")}
          />
          정해진 금액
        </label>
        <label>
          <input
            type="radio"
            name={radioName}
            checked={allocationKind === "sweep"}
            disabled={disabled}
            onChange={() => setAllocationKind("sweep")}
          />
          남은 금액 전부
        </label>
      </fieldset>
      {allocationKind === "fixed" ? (
        <label>
          월 이체 금액
          <FormattedMoneyInput
            adjustments
            valueWon={monthlyAmountWon}
            onValueWonChange={setMonthlyAmountWon}
            zeroDisplay="zero"
            disabled={disabled}
            aria-label="월 이체 금액"
            aria-describedby={[amountHintId, errorDescriptionId].filter(Boolean).join(" ")}
            aria-invalid={fixedAmountInvalid ? "true" : undefined}
          />
          <span id={amountHintId} className="account-transfer-editor__hint">1원 이상의 정해진 금액을 입력해 주세요.</span>
        </label>
      ) : null}
      <label>
        연결 상태
        <select
          value={status}
          disabled={disabled}
          onChange={(event) => setStatus(event.target.value as typeof status)}
        >
          <option value="active">연결됨</option>
          <option value="suspended">중지</option>
        </select>
      </label>
      <div className="account-transfer-editor__summary" role="status" aria-live="polite"><strong>{activeLocations.find(({id}) => id === sourceLocationId)?.shortName ?? '보내는 계좌'} → {activeLocations.find(({id}) => id === targetLocationId)?.shortName ?? '받는 계좌'}</strong><p>{allocationKind === 'fixed' ? `매달 ${new Intl.NumberFormat('ko-KR').format(monthlyAmountWon)}원` : '목적 배정과 고정 이체 후 남은 금액 전부'}</p><p>연결 상태: {status === "active" ? "연결됨" : "중지"}</p></div>
      {localError ? <p className="account-map-error" role="alert">저장하지 못했어요. 입력과 안내를 확인한 뒤 다시 시도해 주세요.</p> : null}
      {sameEndpoint ? (
        <p className="account-map-modal__error" role="alert">
          같은 계좌로 보낼 수 없어요.
        </p>
      ) : null}
      <div className="account-transfer-editor__actions">
        {onCancel === undefined ? null : (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            onClick={cancel}
          >
            취소
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={!canSave || (!dirty && initialValue?.targetLocationId !== undefined && !failed)}
          onClick={() => { void save(); }}
        >
          저장
        </Button>
      </div>
    </section>
  );
}

interface TransferRecovery {
  sourceLocationId: string;
  targetLocationId: string;
  allocationKind: AccountTransferAllocation["kind"];
  monthlyAmountWon: number;
  status: "active" | "suspended";
}

function parseTransferRecovery(value: unknown): TransferRecovery | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.sourceLocationId !== "string"
    || typeof candidate.targetLocationId !== "string"
    || (candidate.allocationKind !== "fixed" && candidate.allocationKind !== "sweep")
    || !Number.isSafeInteger(candidate.monthlyAmountWon)
    || (candidate.monthlyAmountWon as number) < 0
    || (candidate.status !== "active" && candidate.status !== "suspended")) return null;
  return {
    sourceLocationId: candidate.sourceLocationId,
    targetLocationId: candidate.targetLocationId,
    allocationKind: candidate.allocationKind,
    monthlyAmountWon: candidate.monthlyAmountWon as number,
    status: candidate.status,
  };
}
