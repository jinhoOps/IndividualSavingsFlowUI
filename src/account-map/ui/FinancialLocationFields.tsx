import { useId, useState, type InputHTMLAttributes, type JSX } from "react";
import type {
  FinancialLocationKind,
  InstitutionRef,
} from "../../workspace/domain/financialLocation";
import { INSTITUTIONS } from "../domain/institutions";

export interface FinancialLocationFieldsValue {
  kind: FinancialLocationKind;
  institution?: InstitutionRef;
  shortName: string;
}

export interface FinancialLocationFieldsProps {
  value: FinancialLocationFieldsValue;
  onChange(value: FinancialLocationFieldsValue): void;
  mode?: "create" | "edit";
  disabled?: boolean;
  showValidation?: boolean;
  shortNameInputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    "onChange" | "value"
  > & { "data-recovery-field"?: string };
}

const LOCATION_KINDS = [
  ["bank", "은행"],
  ["brokerage", "증권"],
  ["cash", "현금"],
] as const satisfies ReadonlyArray<readonly [FinancialLocationKind, string]>;

export function isFinancialLocationFieldsComplete(
  value: FinancialLocationFieldsValue,
): boolean {
  return (
    value.shortName.trim() !== "" &&
    (value.kind === "cash" || (value.institution?.name.trim() ?? "") !== "")
  );
}

/**
 * Presentation-only account fields shared by account creation and repairable
 * location edits. The consumer decides when a complete value may be saved;
 * the Account Map command remains the persisted-domain validator.
 */
export function FinancialLocationFields({
  value,
  onChange,
  mode = "create",
  disabled = false,
  showValidation = false,
  shortNameInputProps,
}: FinancialLocationFieldsProps): JSX.Element {
  const institutionErrorId = useId();
  const nameErrorId = useId();
  const [customInstitution, setCustomInstitution] = useState(value.institution !== undefined && value.institution.id === undefined);
  const [touched, setTouched] = useState(false);
  const nameHintId = useId();
  const needsInstitution = value.kind !== "cash";
  const selectedQuickInstitution = INSTITUTIONS.find(
    ([id]) => value.institution?.id === id,
  );
  const usesCustomInstitution =
    needsInstitution && (value.kind === "brokerage" || customInstitution || (value.institution !== undefined && selectedQuickInstitution === undefined));
  const missingInstitution =
    needsInstitution && (value.institution?.name.trim() ?? "") === "";
  const missingName = value.shortName.trim() === "";
  const institutionError =
    showValidation && touched && missingInstitution
      ? "은행·증권 계좌는 기관을 선택하거나 입력해 주세요."
      : undefined;
  const nameError =
    showValidation && touched && missingName ? "표시 이름을 입력해 주세요." : undefined;
  const shortNameDescribedBy = mergeDescribedBy(
    shortNameInputProps?.["aria-describedby"],
    nameHintId,
    nameError === undefined ? undefined : nameErrorId,
  );

  function update(next: Partial<FinancialLocationFieldsValue>): void {
    onChange({ ...value, ...next });
  }

  return (
    <div className="financial-location-fields" data-mode={mode} onBlur={() => setTouched(true)}>
      <fieldset>
        <legend>위치 종류</legend>
        <div className="account-map-institutions">
          {LOCATION_KINDS.map(([kind, label]) => (
            <button
              key={kind}
              type="button"
              className={value.kind === kind ? "is-selected" : ""}
              aria-pressed={value.kind === kind}
              disabled={disabled}
              onClick={() => { setCustomInstitution(false);
                onChange(
                  kind === value.kind
                    ? value
                    : { kind, shortName: value.shortName },
                );
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      {needsInstitution ? (
        <fieldset
          aria-describedby={
            institutionError === undefined ? undefined : institutionErrorId
          }
        >
          <legend>기관</legend>
          {value.kind === "bank" ? <select aria-label="은행 선택" aria-describedby={institutionError === undefined ? undefined : institutionErrorId} disabled={disabled} value={selectedQuickInstitution?.[0] ?? (usesCustomInstitution ? 'custom' : '')} onChange={(event) => {
            const institution = INSTITUTIONS.find(([id]) => id === event.target.value);
            setCustomInstitution(event.target.value === 'custom');
            update({ institution: institution === undefined ? undefined : { id: institution[0], name: institution[1] } });
          }}><option value="" disabled>은행을 선택해 주세요</option>{INSTITUTIONS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}<option value="custom">직접 입력</option></select> : null}
          {usesCustomInstitution ? (
            <label>
              기관 이름
              <input
                value={value.institution?.name ?? ""}
                disabled={disabled}
                aria-invalid={
                  institutionError === undefined ? undefined : "true"
                }
                aria-describedby={
                  institutionError === undefined
                    ? undefined
                    : institutionErrorId
                }
                onChange={(event) =>
                  update({ institution: { name: event.target.value } })
                }
              />
            </label>
          ) : null}
          {institutionError === undefined ? null : (
            <p
              className="account-map-modal__error"
              id={institutionErrorId}
              role="alert"
            >
              {institutionError}
            </p>
          )}
        </fieldset>
      ) : null}
      <label>
        표시 이름
        <input
          {...shortNameInputProps}
          value={value.shortName}
          disabled={disabled}
          maxLength={8}
          placeholder="예: 급여통장, 생활비"
          aria-invalid={nameError === undefined ? undefined : "true"}
          aria-describedby={shortNameDescribedBy}
          onChange={(event) => { setTouched(true); update({ shortName: event.target.value }); }}
        />
      </label>
      <p id={nameHintId} className="account-map-hint">지도에서 알아볼 이름 · 한글·영문·숫자 8자까지</p>
      {nameError === undefined ? null : (
        <p className="account-map-modal__error" id={nameErrorId} role="alert">
          {nameError}
        </p>
      )}
    </div>
  );
}

function mergeDescribedBy(
  ...values: Array<string | undefined>
): string | undefined {
  const ids = [...new Set(values.flatMap((value) => value?.split(/\s+/u) ?? []))]
    .filter((id) => id !== "");
  return ids.length === 0 ? undefined : ids.join(" ");
}
