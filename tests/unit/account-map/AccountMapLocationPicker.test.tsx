import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDraftContext } from "../../../src/auth/AccountDraftContext";
import { AccountMapLocationPicker } from "../../../src/account-map/ui/AccountMapLocationPicker";
import type { AccountWorkspaceSession } from "../../../src/workspace/infrastructure/accountWorkspaceSession";

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

  it("restores v4 location fields and keeps recovery until the async command succeeds", async () => {
    const recordRecoveryDraft = vi.fn();
    const session = {
      readRecoveryDraft: (key: string) => key === "account-map-picker:system:living" ? {
        mode: "create",
        selectedLocationId: null,
        locationFields: {
          kind: "brokerage",
          institution: { name: "미래증권" },
          shortName: "투자계좌",
        },
        amountWon: 250_000,
      } : null,
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;
    const onCreate = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);

    render(
      <AccountDraftContext.Provider value={session}>
        <AccountMapLocationPicker
          locations={[]}
          linkedLocationIds={new Set()}
          amountRequired
          recoveryScope="system:living"
          onSelect={vi.fn()}
          onCreate={onCreate}
        />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByRole("button", { name: "증권" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("textbox", { name: "기관 이름" })).toHaveValue("미래증권");
    expect(screen.getByRole("textbox", { name: "표시 이름" })).toHaveValue("투자계좌");
    expect(screen.getByRole("textbox", { name: "이 계좌에 둘 월 금액" })).toHaveValue("250,000");

    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(recordRecoveryDraft).not.toHaveBeenCalledWith("account-map-picker:system:living", null);

    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    await waitFor(() => expect(recordRecoveryDraft).toHaveBeenCalledWith("account-map-picker:system:living", null));
  });

  it("ignores a recovered selected location that is no longer selectable", () => {
    const session = {
      readRecoveryDraft: () => ({
        mode: "choose",
        selectedLocationId: "archived",
        locationFields: { kind: "bank", shortName: "" },
        amountWon: 0,
      }),
      recordRecoveryDraft: vi.fn(),
    } as unknown as AccountWorkspaceSession;

    render(
      <AccountDraftContext.Provider value={session}>
        <AccountMapLocationPicker
          locations={[{
            id: "archived", shortName: "해지계좌", kind: "bank",
            institution: { name: "은행" }, roles: ["spending"], archivedAt: 2,
            createdAt: 1, updatedAt: 2,
          }]}
          linkedLocationIds={new Set()}
          recoveryScope="system:living"
          onSelect={vi.fn()}
          onCreate={vi.fn()}
        />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByRole("button", { name: "완료" })).toBeDisabled();
  });
});
