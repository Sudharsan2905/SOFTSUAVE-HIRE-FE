import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Toggle } from "./index";

describe("Toggle", () => {
  it("renders with label", () => {
    render(<Toggle checked={false} onChange={vi.fn()} label="Enable feature" />);
    expect(screen.getByText("Enable feature")).toBeInTheDocument();
  });

  it("renders checked state", () => {
    render(<Toggle checked={true} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).toBeChecked();
  });

  it("renders unchecked state", () => {
    render(<Toggle checked={false} onChange={vi.fn()} />);
    expect(screen.getByRole("switch")).not.toBeChecked();
  });

  it("calls onChange when toggled", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does not call onChange when disabled", () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled />);
    expect(screen.getByRole("switch")).toBeDisabled();
  });

  it("renders without label", () => {
    const { container } = render(<Toggle checked={false} onChange={vi.fn()} />);
    expect(container.querySelector("span")).toBeNull();
  });

  it("renders sm size", () => {
    const { container } = render(<Toggle checked={false} onChange={vi.fn()} size="sm" />);
    expect(container.querySelector("label")).toBeInTheDocument();
  });
});
