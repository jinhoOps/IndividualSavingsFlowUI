import { useId, type InputHTMLAttributes, type JSX } from "react";
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
  const needsInstitution = value.kind !== "cash";
  const selectedQuickInstitution = INSTITUTIONS.find(
    ([id]) => value.institution?.id === id,
  );
  const usesCustomInstitution =
    needsInstitution && selectedQuickInstitution === undefined;
  const missingInstitution =
    needsInstitution && (value.institution?.name.trim() ?? "") === "";
  const missingName = value.shortName.trim() === "";
  const institutionError =
    showValidation && missingInstitution
      ? "은행·증권 계좌는 기관을 선택하거나 입력해 주세요."
      : undefined;
  const nameError =
    showValidation && missingName ? "표시 이름을 입력해 주세요." : undefined;

  function update(next: Partial<FinancialLocationFieldsValue>): void {
    onChange({ ...value, ...next });
  }

  return (
    <div className="financial-location-fields" data-mode={mode}>
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
              onClick={() =>
                onChange(
                  kind === value.kind
                    ? value
                    : { kind, shortName: value.shortName },
                )
              }
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
          {value.kind === "bank" ? (
            <div className="account-map-institutions">
              {INSTITUTIONS.map(([id, name]) => (
                <button
                  key={id}
                  type="button"
                  className={
                    selectedQuickInstitution?.[0] === id ? "is-selected" : ""
                  }
                  aria-pressed={selectedQuickInstitution?.[0] === id}
                  disabled={disabled}
                  onClick={() => update({ institution: { id, name } })}
                >
                  {name}
                </button>
              ))}
              <button
                type="button"
                className={usesCustomInstitution ? "is-selected" : ""}
                aria-pressed={usesCustomInstitution}
                disabled={disabled}
                onClick={() =>
                  update({
                    institution: {
                      name:
                        selectedQuickInstitution === undefined
                          ? (value.institution?.name ?? "")
                          : "",
                    },
                  })
                }
              >
                직접 입력
              </button>
            </div>
          ) : null}
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
          placeholder="예: 급여통장"
          aria-invalid={nameError === undefined ? undefined : "true"}
          aria-describedby={nameError === undefined ? undefined : nameErrorId}
          onChange={(event) => update({ shortName: event.target.value })}
        />
      </label>
      {nameError === undefined ? null : (
        <p className="account-map-modal__error" id={nameErrorId} role="alert">
          {nameError}
        </p>
      )}
    </div>
  );
}
