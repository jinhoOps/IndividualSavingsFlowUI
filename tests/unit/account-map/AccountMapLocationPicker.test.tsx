import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountMapLocationPicker } from "../../../src/account-map/ui/AccountMapLocationPicker";

afterEach(cleanup);

describe("AccountMapLocationPicker", () => {
  it("keeps shared action variants while disabled completion leaves cancellation available", () => {
    const onCancel = vi.fn();
    render(
      <AccountMapLocationPicker
        locations={[
          {
            id: "location:checking",
            shortName: "급여통장",
            institution: { name: "하나은행" },
            kind: "bank",
            roles: ["income"],
            createdAt: 1,
            updatedAt: 1,
          },
        ]}
        linkedLocationIds={new Set()}
        onSelect={vi.fn()}
        onCreate={vi.fn()}
        disabled
        onCancel={onCancel}
      />,
    );

    const cancel = screen.getByRole("button", { name: "취소" });
    const complete = screen.getByRole("button", { name: "완료" });
    expect(cancel).toHaveClass("ui-button", "ui-button--secondary");
    expect(complete).toHaveClass("ui-button", "ui-button--primary");
    expect(cancel).toBeEnabled();
    expect(complete).toBeDisabled();

    fireEvent.click(cancel);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("uses the shared location fields to require an institution before a new bank location can be completed", () => {
    const onCreate = vi.fn();
    render(
      <AccountMapLocationPicker
        locations={[]}
        linkedLocationIds={new Set()}
        onSelect={vi.fn()}
        onCreate={onCreate}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "새 계좌·보관처 추가" }),
    );
    fireEvent.change(screen.getByRole("textbox", { name: "표시 이름" }), {
      target: { value: "급여통장" },
    });
    expect(screen.getByRole("button", { name: "완료" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "기관을 선택하거나 입력해 주세요",
    );

    fireEvent.click(screen.getByRole("button", { name: "하나은행" }));
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        shortName: "급여통장",
        kind: "bank",
        institution: { id: "hana", name: "하나은행" },
      }),
      undefined,
    );
  });
});
