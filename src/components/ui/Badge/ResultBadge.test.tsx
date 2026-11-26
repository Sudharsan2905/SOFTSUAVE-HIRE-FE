import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultBadge } from "./index";

describe("ResultBadge", () => {
  it("shows Passed for a passed result", () => {
    render(<ResultBadge result="passed" />);
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("shows Failed for a failed result", () => {
    render(<ResultBadge result="failed" />);
    expect(screen.getByText("Failed")).toBeInTheDocument();
  });

  it.each([null, undefined, ""])("shows a dash when there is no result (%s)", (value) => {
    render(<ResultBadge result={value} />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Passed")).not.toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
  });
});
