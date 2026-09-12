import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import {
  FinancialLocationFields,
  type FinancialLocationFieldsValue,
} from "../../../src/account-map/ui/FinancialLocationFields";

afterEach(cleanup);

function ControlledFields({
  initialValue,
  mode = "create",
}: {
  initialValue: FinancialLocationFieldsValue;
  mode?: "create" | "edit";
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <FinancialLocationFields
      value={value}
      onChange={setValue}
      mode={mode}
      showValidation
    />
  );
}

describe("FinancialLocationFields", () => {
  it("uses the same kind, institution, and display-name controls in create and edit modes", () => {
    const { rerender } = render(
      <ControlledFields
        initialValue={{ kind: "bank", shortName: "급여통장" }}
      />,
    );
    expect(screen.getByRole("button", { name: "은행" })).toBeVisible();
    expect(screen.getByRole("button", { name: "증권" })).toBeVisible();
    expect(screen.getByRole("button", { name: "현금" })).toBeVisible();
    expect(screen.getByRole("option", { name: "KB국민은행" })).toBeVisible();
    expect(screen.getByRole("option", { name: "직접 입력" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "표시 이름" })).toHaveValue(
      "급여통장",
    );

    rerender(
      <ControlledFields
        initialValue={{ kind: "bank", shortName: "급여통장" }}
        mode="edit"
      />,
    );
    expect(screen.getByRole("button", { name: "은행" })).toBeVisible();
    expect(screen.getByRole("button", { name: "증권" })).toBeVisible();
    expect(screen.getByRole("button", { name: "현금" })).toBeVisible();
    expect(screen.getByRole("option", { name: "KB국민은행" })).toBeVisible();
    expect(screen.getByRole("option", { name: "직접 입력" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "표시 이름" })).toHaveValue(
      "급여통장",
    );
  });

  it("lets an older bank record without an institution render and be repaired accessibly", () => {
    render(
      <ControlledFields
        initialValue={{ kind: "bank", shortName: "생활통장" }}
        mode="edit"
      />,
    );
    const institutionInput = screen.getByRole("combobox", { name: "은행 선택" });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    fireEvent.blur(institutionInput);
    expect(institutionInput).toHaveAccessibleDescription(
      "은행·증권 계좌는 기관을 선택하거나 입력해 주세요.",
    );

    fireEvent.change(institutionInput, { target: { value: "hana" } });
    expect(institutionInput).toHaveValue("hana");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("supports custom brokerage institutions and clears them when switching to cash", () => {
    render(
      <ControlledFields initialValue={{ kind: "bank", shortName: "ISA" }} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "증권" }));
    fireEvent.change(screen.getByRole("textbox", { name: "기관 이름" }), {
      target: { value: "미래증권" },
    });
    expect(screen.getByRole("textbox", { name: "기관 이름" })).toHaveValue(
      "미래증권",
    );

    fireEvent.click(screen.getByRole("button", { name: "현금" }));
    expect(
      screen.queryByRole("textbox", { name: "기관 이름" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
