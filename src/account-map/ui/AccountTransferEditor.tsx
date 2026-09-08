import { useId, useState, type JSX } from "react";
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
  onSave(value: AccountTransferEditorValue): void;
  disabled?: boolean;
  initialValue?: Partial<AccountTransferEditorValue>;
  onCancel?(): void;
  errorDescriptionId?: string;
}

/** A local transfer form. It emits a complete UI-valid value but never saves it. */
export function AccountTransferEditor({
  locations,
  onSave,
  disabled = false,
  initialValue,
  onCancel,
  errorDescriptionId,
}: AccountTransferEditorProps): JSX.Element {
  const amountHintId = useId();
  const [sourceLocationId, setSourceLocationId] = useState(
    initialValue?.sourceLocationId ?? "",
  );
  const [targetLocationId, setTargetLocationId] = useState(
    initialValue?.targetLocationId ?? "",
  );
  const [allocationKind, setAllocationKind] = useState<
    AccountTransferAllocation["kind"]
  >(initialValue?.allocation?.kind ?? "fixed");
  const [monthlyAmountWon, setMonthlyAmountWon] = useState(
    initialValue?.allocation?.kind === "fixed"
      ? initialValue.allocation.monthlyAmountWon
      : 0,
  );
  const [status, setStatus] = useState<"active" | "suspended">(
    initialValue?.status ?? "active",
  );
  const activeLocations = locations.filter(
    ({ archivedAt }) => archivedAt === undefined,
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

  return (
    <section className="account-transfer-editor" aria-label="계좌 흐름 편집">
      <label>
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
      <label>
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
      <fieldset>
        <legend>금액 규칙</legend>
        <label>
          <input
            type="radio"
            name="account-transfer-allocation"
            checked={allocationKind === "fixed"}
            disabled={disabled}
            onChange={() => setAllocationKind("fixed")}
          />
          정해진 금액
        </label>
        <label>
          <input
            type="radio"
            name="account-transfer-allocation"
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
      <p role="status" aria-live="polite">
        연결 상태: {status === "active" ? "연결됨" : "중지"}
      </p>
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
            onClick={onCancel}
          >
            취소
          </Button>
        )}
        <Button
          type="button"
          variant="primary"
          disabled={!canSave}
          onClick={() =>
            onSave({ sourceLocationId, targetLocationId, allocation, status })
          }
        >
          저장
        </Button>
      </div>
    </section>
  );
}
