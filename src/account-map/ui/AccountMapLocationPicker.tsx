import { useEffect, useMemo, useState, type JSX } from "react";
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
  onSelect(locationId: string, amount?: number): void;
  onCreate(location: FinancialLocation, amount?: number): void;
  amountRequired?: boolean;
  disabled?: boolean;
  cancelDisabled?: boolean;
  onCancel?(): void;
  onDirtyChange?(dirty: boolean): void;
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
}: LocationPickerProps): JSX.Element {
  const [mode, setMode] = useState<"choose" | "create">("choose");
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(
    null,
  );
  const [locationFields, setLocationFields] =
    useState<FinancialLocationFieldsValue>({ kind: "bank", shortName: "" });
  const [amountWon, setAmountWon] = useState(0);
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

  function submitExisting(locationId: string): void {
    if (disabled || !amountValid) return;
    onSelect(locationId, amount);
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
                onClick={() => submitExisting(duplicate.location.id)}
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
            onClick={onCancel}
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
                submitExisting(selectedLocationId);
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
              if (preview !== null) onCreate(preview, amount);
            }}
          >
            완료
          </Button>
        )}
      </div>
    </div>
  );
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
