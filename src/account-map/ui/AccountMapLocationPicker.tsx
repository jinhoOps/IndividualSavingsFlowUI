import { useContext, useEffect, useMemo, useRef, useState, type JSX } from "react";
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
  draftCache?: Map<string, PickerRecovery>;
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
  draftCache,
}: LocationPickerProps): JSX.Element {
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  disabled = disabled || pending;
  const recoveryKey = recoveryScope === undefined
    ? ""
    : `account-map-picker:${recoveryScope}`;
  const recovered = useInitialRecovery(recoveryKey, parsePickerRecovery) ?? draftCache?.get(recoveryKey) ?? null;
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

  useEffect(() => { draftCache?.set(recoveryKey, { mode, selectedLocationId, locationFields, amountWon }); }, [draftCache, recoveryKey, mode, selectedLocationId, locationFields, amountWon]);

  async function submit(action: () => ReturnType<LocationPickerProps['onSelect']>): Promise<void> {
    if (disabled || pendingRef.current || !amountValid) return;
    pendingRef.current = true;
    setPending(true);
    setSaveError(null);
    try {
      const saved = await action();
      if (saved === true) { session?.recordRecoveryDraft(recoveryKey, null); draftCache?.delete(recoveryKey); }
      else if (saved === false) setSaveError('연결하지 못했어요. 입력을 유지했습니다. 금액과 최신 상태를 확인해 주세요.');
    } catch { setSaveError('연결하지 못했어요. 입력을 유지했습니다. 금액과 최신 상태를 확인해 주세요.'); }
    finally { pendingRef.current = false; setPending(false); }
  }
  async function submitExisting(locationId: string): Promise<void> { await submit(() => onSelect(locationId, amount)); }
  async function submitNew(location: FinancialLocation): Promise<void> { await submit(() => onCreate(location, amount)); }

  function cancel(): void {
    draftCache?.delete(recoveryKey);
    session?.recordRecoveryDraft(recoveryKey, null);
    onCancel?.();
  }

  return (
    <div className="account-map-location-picker" aria-busy={pending || undefined}>
      {mode === 'create' ? <button type="button" className="account-map-text-action" disabled={disabled} onClick={() => { setMode('choose'); setSelectedLocationId(null); }}>기존 계좌에서 고르기</button> : null}
      {mode === "choose" ? (
        <>
          {available.length === 0 ? (
            <p className="account-map-empty-copy">
              처음 연결할 계좌를 추가해 주세요. 한 번 추가하면 다른 목적에서도 고를 수 있어요.
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
                  aria-pressed={selectedLocationId === location.id}
                  onClick={() => setSelectedLocationId(location.id)}
                >
                  <strong>{location.shortName}</strong>
                  <span>{location.institution?.name ?? (location.kind === "cash" ? "현금·보관처" : "기관 미입력")}</span>
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
            adjustments
            zeroDisplay="zero"
            disabled={disabled}
            aria-describedby="account-map-location-amount-help"
          />
          <span id="account-map-location-amount-help" className="sr-only">
            원 단위로 입력해 주세요.
          </span>
        </div>
      ) : null}
      {saveError === null ? null : <p className="account-map-error" role="alert">{saveError}</p>}
      <div className="account-map-location-picker__actions">
        {onCancel === undefined ? null : (
          <Button
            variant="secondary"
            type="button"
            disabled={cancelDisabled || pending}
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
            {pending ? "연결 중…" : "이 계좌 연결"}
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
            {pending ? "연결 중…" : "이 계좌 연결"}
          </Button>
        )}
      </div>
    </div>
  );
}

export interface PickerRecovery {
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
