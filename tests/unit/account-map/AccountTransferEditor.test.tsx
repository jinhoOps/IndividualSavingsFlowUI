import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountDraftContext } from "../../../src/auth/AccountDraftContext";
import { AccountTransferEditor } from "../../../src/account-map/ui/AccountTransferEditor";
import type { FinancialLocation } from "../../../src/workspace/domain/financialLocation";
import type { AccountWorkspaceSession } from "../../../src/workspace/infrastructure/accountWorkspaceSession";

afterEach(cleanup);

const locations: FinancialLocation[] = [
  {
    id: "salary",
    shortName: "급여통장",
    kind: "bank",
    institution: { name: "국민" },
    roles: ["income"],
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "brokerage",
    shortName: "증권계좌",
    kind: "brokerage",
    institution: { name: "미래" },
    roles: ["investing"],
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: "closed",
    shortName: "해지계좌",
    kind: "bank",
    institution: { name: "하나" },
    roles: ["saving"],
    archivedAt: 2,
    createdAt: 1,
    updatedAt: 2,
  },
];

describe("AccountTransferEditor", () => {
  it("excludes archived locations, blocks equal endpoints, and emits a valid sweep only on save", () => {
    const onSave = vi.fn();
    render(<AccountTransferEditor locations={locations} onSave={onSave} />);

    expect(
      screen.queryByRole("option", { name: "해지계좌" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "보내는 계좌" }), {
      target: { value: "salary" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "받는 계좌" }), {
      target: { value: "salary" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "같은 계좌로 보낼 수 없어요.",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "받는 계좌" }), {
      target: { value: "brokerage" },
    });
    fireEvent.click(screen.getByRole("radio", { name: "남은 금액 전부" }));
    expect(
      screen.queryByRole("textbox", { name: "월 이체 금액" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("연결 상태: 연결됨");

    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith({
      sourceLocationId: "salary",
      targetLocationId: "brokerage",
      allocation: { kind: "sweep" },
      status: "active",
    });
  });

  it("shows the shared formatted input for a fixed transfer and requires a positive amount", () => {
    render(<AccountTransferEditor locations={locations} onSave={vi.fn()} />);
    fireEvent.change(screen.getByRole("combobox", { name: "보내는 계좌" }), {
      target: { value: "salary" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "받는 계좌" }), {
      target: { value: "brokerage" },
    });

    expect(screen.getByRole("textbox", { name: "월 이체 금액" })).toBeVisible();
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "월 이체 금액" }), {
      target: { value: "500000", selectionStart: 6 },
    });
    expect(screen.getByRole("textbox", { name: "월 이체 금액" })).toHaveValue(
      "500,000",
    );
    expect(screen.getByRole("button", { name: "저장" })).toBeEnabled();
  });

  it("restores a scoped transfer draft without saving and clears it on explicit cancel", async () => {
    const recordRecoveryDraft = vi.fn();
    const session = {
      readRecoveryDraft: (key: string) => key === "account-map-transfer:map:add:salary" ? {
        sourceLocationId: "salary",
        targetLocationId: "brokerage",
        allocationKind: "sweep",
        monthlyAmountWon: 0,
        status: "suspended",
      } : null,
      recordRecoveryDraft,
    } as unknown as AccountWorkspaceSession;
    const onSave = vi.fn();

    render(
      <AccountDraftContext.Provider value={session}>
        <AccountTransferEditor
          locations={locations}
          recoveryScope="map:add:salary"
          onSave={onSave}
          onCancel={vi.fn()}
        />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByRole("combobox", { name: "보내는 계좌" })).toHaveValue("salary");
    expect(screen.getByRole("combobox", { name: "받는 계좌" })).toHaveValue("brokerage");
    expect(screen.getByRole("radio", { name: "남은 금액 전부" })).toBeChecked();
    expect(screen.getByRole("combobox", { name: "연결 상태" })).toHaveValue("suspended");
    expect(onSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    await waitFor(() => expect(recordRecoveryDraft).toHaveBeenCalledWith("account-map-transfer:map:add:salary", null));
  });

  it("drops recovered transfer endpoints that are not active current locations", () => {
    const session = {
      readRecoveryDraft: () => ({
        sourceLocationId: "closed",
        targetLocationId: "missing",
        allocationKind: "fixed",
        monthlyAmountWon: 100_000,
        status: "active",
      }),
      recordRecoveryDraft: vi.fn(),
    } as unknown as AccountWorkspaceSession;

    render(
      <AccountDraftContext.Provider value={session}>
        <AccountTransferEditor locations={locations} recoveryScope="setup:add" onSave={vi.fn()} />
      </AccountDraftContext.Provider>,
    );

    expect(screen.getByRole("combobox", { name: "보내는 계좌" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "받는 계좌" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "저장" })).toBeDisabled();
  });
});
