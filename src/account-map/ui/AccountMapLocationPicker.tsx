import { useContext, useEffect, useMemo, useState, type JSX } from "react";
import {
  AccountDraftContext,
  useAccountRecovery,
  useInitialRecovery,
} from "../../auth/AccountDraftContext";
import { Button } from "../../components/common/Button";
import { FormattedMoneyInput } from "../../components/common/FormattedMoneyInput";
import type { FinancialLocation } from "../../workspace/domain/financialLocation";
import { findLocationDuplicate, INSTITUTIONS } from "../domain/institutions";
import {
  FinancialLocationFields,
  isFinancialLocationFieldsComplete,
  type FinancialLocationFieldsValue,
} from "./FinancialLocationFields";

export interface LocationPickerProps {
  locations: FinancialLocation[];
  linkedLocationIds: Set<string>;
  onSelect(locationId: string, amount?: number): boolean | void | Promise<boolean | void>;
  onCreate(location: FinancialLocation, amount?: number): boolean | void | Promise<boolean | void>;
  amountRequired?: boolean;
  disabled?: boolean;
  cancelDisabled?: boolean;
  onCancel?(): void;
  onDirtyChange?(dirty: boolean): void;
  recoveryScope?: string;
}

export function AccountMapLocationPicker({
  locations,
  linkedLocationIds,
  onSelect,
  onCreate,
  amountRequired = false,
  disabled = false,
  cancelDisabled = false,
  onCancel,
  onDirtyChange,
  recoveryScope,
}: LocationPickerProps): JSX.Element {
  const recoveryKey = recoveryScope === undefined
    ? ""
    : `account-map-picker:${recoveryScope}`;
  const recovered = useInitialRecovery(recoveryKey, parsePickerRecovery);
  const session = useContext(AccountDraftContext);
  const recoveredSelectedLocationId = recovered?.selectedLocationId ?? null;
  const recoveredSelection = recoveredSelectedLocationId !== null
    && locations.some((location) => location.id === recoveredSelectedLocationId
      && location.archivedAt === undefined
      && !linkedLocationIds.has(location.id))
    ? recoveredSelectedLocationId
    : null;
  const [mode, setMode] = useState<"choose" | "create">(
    recovered?.mode ?? "choose",
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    recoveredSelection,
  );
  const [locationFields, setLocationFields] =
    useState<FinancialLocationFieldsValue>(
      recovered?.locationFields ?? { kind: "bank", shortName: "" },
    );
  const [amountWon, setAmountWon] = useState(recovered?.amountWon ?? 0);
  const available = locations.filter(
    (location) =>
      location.archivedAt === undefined && !linkedLocationIds.has(location.id),
  );
  const preview = useMemo(
    () => createLocationPreview(mode, locationFields),
    [locationFields, mode],
  );
  const duplicate =
    preview === null
      ? { kind: "none" as const }
      : findLocationDuplicate(locations, preview);
  const amount = amountRequired ? amountWon : undefined;
  const amountValid =
    !amountRequired || (Number.isSafeInteger(amountWon) && amountWon > 0);
  const dirty =
    selectedLocationId !== null || mode === "create" || amountWon !== 0;
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useAccountRecovery(
    recoveryKey,
    { mode, selectedLocationId, locationFields, amountWon },
    dirty,
    recoveryScope !== undefined,
  );

  async function submitExisting(locationId: string): Promise<void> {
    if (disabled || !amountValid) return;
    const saved = await onSelect(locationId, amount);
    if (saved === true) session?.recordRecoveryDraft(recoveryKey, null);
  }

  async function submitNew(location: FinancialLocation): Promise<void> {
    const saved = await onCreate(location, amount);
    if (saved === true) session?.recordRecoveryDraft(recoveryKey, null);
  }

  function cancel(): void {
    session?.recordRecoveryDraft(recoveryKey, null);
    onCancel?.();
  }

  return (
    <div className="account-map-location-picker">
      {mode === "choose" ? (
        <>
          {available.length === 0 ? (
            <p className="account-map-empty-copy">
              바로 고를 수 있는 기존 항목이 없습니다.
            </p>
          ) : (
            <div className="account-map-location-list">
              {available.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  className={
                    selectedLocationId === location.id ? "is-selected" : ""
                  }
                  disabled={disabled}
                  onClick={() => setSelectedLocationId(location.id)}
                >
                  <strong>{location.shortName}</strong>
                  <span>{location.institution?.name ?? "기관 없음"}</span>
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            className="account-map-new-location"
            disabled={disabled}
            onClick={() => {
              setMode("create");
              setSelectedLocationId(null);
            }}
          >
            <span aria-hidden="true">＋</span>
            <strong>새 계좌·보관처 추가</strong>
          </button>
        </>
      ) : (
        <>
          <FinancialLocationFields
            value={locationFields}
            onChange={setLocationFields}
            disabled={disabled}
            showValidation
          />
          {duplicate.kind === "none" ? null : (
            <div className="account-map-duplicate">
              <p>
                {duplicate.kind === "archived"
                  ? "보관된 같은 항목이 있어요."
                  : "이미 같은 항목이 있어요."}
              </p>
              <Button
                variant="secondary"
                type="button"
                disabled={disabled || !amountValid}
                onClick={() => void submitExisting(duplicate.location.id)}
              >
                {duplicate.kind === "archived"
                  ? "기존 항목 복원해서 연결"
                  : "기존 항목 연결"}
              </Button>
            </div>
          )}
        </>
      )}
      {amountRequired ? (
        <div className="account-map-location-picker__amount">
          <label htmlFor="account-map-location-amount">
            이 계좌에 둘 월 금액
          </label>
          <FormattedMoneyInput
            id="account-map-location-amount"
            valueWon={amountWon}
            onValueWonChange={setAmountWon}
            zeroDisplay="zero"
            disabled={disabled}
            aria-describedby="account-map-location-amount-help"
          />
          <span id="account-map-location-amount-help" className="sr-only">
            원 단위로 입력해 주세요.
          </span>
        </div>
      ) : null}
      <div className="account-map-location-picker__actions">
        {onCancel === undefined ? null : (
          <Button
            variant="secondary"
            type="button"
            disabled={cancelDisabled}
            onClick={cancel}
          >
            취소
          </Button>
        )}
        {mode === "choose" ? (
          <Button
            variant="primary"
            type="button"
            disabled={disabled || selectedLocationId === null || !amountValid}
            onClick={() => {
              if (selectedLocationId !== null)
                void submitExisting(selectedLocationId);
            }}
          >
            완료
          </Button>
        ) : (
          <Button
            variant="primary"
            type="button"
            disabled={
              disabled ||
              preview === null ||
              duplicate.kind !== "none" ||
              !amountValid
            }
            onClick={() => {
              if (preview !== null) void submitNew(preview);
            }}
          >
            완료
          </Button>
        )}
      </div>
    </div>
  );
}

interface PickerRecovery {
  mode: "choose" | "create";
  selectedLocationId: string | null;
  locationFields: FinancialLocationFieldsValue;
  amountWon: number;
}

function parsePickerRecovery(value: unknown): PickerRecovery | null {
  if (!isRecord(value)
    || (value.mode !== "choose" && value.mode !== "create")
    || (value.selectedLocationId !== null && typeof value.selectedLocationId !== "string")
    || !isLocationFields(value.locationFields)
    || !Number.isSafeInteger(value.amountWon)
    || (value.amountWon as number) < 0) return null;
  return {
    mode: value.mode,
    selectedLocationId: value.selectedLocationId,
    locationFields: value.locationFields,
    amountWon: value.amountWon as number,
  };
}

function isLocationFields(value: unknown): value is FinancialLocationFieldsValue {
  if (!isRecord(value)
    || (value.kind !== "bank" && value.kind !== "brokerage" && value.kind !== "cash")
    || typeof value.shortName !== "string") return false;
  if (value.institution === undefined) return true;
  return isRecord(value.institution)
    && typeof value.institution.name === "string"
    && (value.institution.id === undefined || typeof value.institution.id === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createLocationPreview(
  mode: "choose" | "create",
  fields: FinancialLocationFieldsValue,
): FinancialLocation | null {
  if (mode !== "create" || !isFinancialLocationFieldsComplete(fields))
    return null;
  const now = Date.now();
  const id = createId();
  const knownInstitution = INSTITUTIONS.find(
    ([institutionId]) => institutionId === fields.institution?.id,
  );
  const institution =
    fields.kind === "cash"
      ? undefined
      : knownInstitution === undefined
        ? {
            ...(fields.kind === "bank" ? { id: `custom:${id}` } : {}),
            name: fields.institution!.name.trim(),
          }
        : { id: knownInstitution[0], name: knownInstitution[1] };
  return {
    id: `location:${id}`,
    shortName: fields.shortName.trim(),
    ...(institution === undefined ? {} : { institution }),
    kind: fields.kind,
    roles: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}
