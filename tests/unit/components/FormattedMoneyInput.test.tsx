import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormattedMoneyInput } from "../../../src/components/common/FormattedMoneyInput";

afterEach(cleanup);

function ControlledMoneyInput({
  initialValueWon = 1_000,
  ...props
}: Omit<
  React.ComponentProps<typeof FormattedMoneyInput>,
  "valueWon" | "onValueWonChange"
> & { initialValueWon?: number }) {
  const [valueWon, setValueWon] = useState(initialValueWon);
  return (
    <FormattedMoneyInput
      valueWon={valueWon}
      onValueWonChange={setValueWon}
      aria-label="월 금액"
      {...props}
    />
  );
}

describe("FormattedMoneyInput", () => {
  it("formats pasted digits and keeps a digit-relative caret through insertion and deletion", () => {
    render(<ControlledMoneyInput />);
    const input = screen.getByRole("textbox", { name: "월 금액" });

    fireEvent.change(input, { target: { value: "12000", selectionStart: 2 } });
    expect(input).toHaveValue("12,000");
    expect(input).toHaveProperty("selectionStart", 2);

    fireEvent.change(input, { target: { value: "1,000", selectionStart: 1 } });
    expect(input).toHaveValue("1,000");
    expect(input).toHaveProperty("selectionStart", 1);

    fireEvent.change(input, {
      target: { value: "1,234,000원", selectionStart: 9 },
    });
    expect(input).toHaveValue("1,234,000");
  });

  it("represents an empty edit as zero while preserving the configured zero display", () => {
    const onValueWonChange = vi.fn();
    render(
      <FormattedMoneyInput
        valueWon={0}
        zeroDisplay="zero"
        onValueWonChange={onValueWonChange}
        aria-label="월 금액"
      />,
    );
    const input = screen.getByRole("textbox", { name: "월 금액" });
    expect(input).toHaveValue("0");

    fireEvent.change(input, { target: { value: "", selectionStart: 0 } });
    expect(input).toHaveValue("");
    expect(onValueWonChange).toHaveBeenLastCalledWith(0);
  });

  it("waits for Korean IME composition to finish before normalizing the controlled value", () => {
    const onValueWonChange = vi.fn();
    render(
      <FormattedMoneyInput
        valueWon={0}
        onValueWonChange={onValueWonChange}
        aria-label="월 금액"
      />,
    );
    const input = screen.getByRole("textbox", { name: "월 금액" });

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: "1000", selectionStart: 4 } });
    expect(onValueWonChange).not.toHaveBeenCalled();
    expect(input).toHaveValue("1000");

    fireEvent.compositionEnd(input, {
      data: "1000",
      target: { value: "1000", selectionStart: 4 },
    });
    expect(onValueWonChange).toHaveBeenLastCalledWith(1_000);
    expect(input).toHaveValue("1,000");
  });

  it("forwards ordinary input semantics and disables its adjustment controls together", () => {
    render(
      <ControlledMoneyInput
        aria-describedby="amount-help"
        placeholder="금액 입력"
        disabled
        adjustments
      />,
    );

    expect(screen.getByRole("textbox", { name: "월 금액" })).toHaveAttribute(
      "aria-describedby",
      "amount-help",
    );
    expect(screen.getByRole("textbox", { name: "월 금액" })).toHaveAttribute(
      "placeholder",
      "금액 입력",
    );
    for (const name of ["-50만", "-10만", "+10만", "+50만"]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
  });
});
