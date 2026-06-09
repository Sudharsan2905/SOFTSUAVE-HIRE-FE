import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LinkStatusScreen } from "./index";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));

describe("LinkStatusScreen", () => {
  it("renders expired status title", () => {
    render(<LinkStatusScreen status="expired" />);
    expect(screen.getByText("Interview Link Expired")).toBeInTheDocument();
  });

  it("renders not_started status title", () => {
    render(<LinkStatusScreen status="not_started" />);
    expect(screen.getByText("Interview Not Started")).toBeInTheDocument();
  });

  it("renders invalid status title", () => {
    render(<LinkStatusScreen status="invalid" />);
    expect(screen.getByText("Invalid Link")).toBeInTheDocument();
  });

  it("uses custom message when provided", () => {
    render(<LinkStatusScreen status="expired" message="Your session has ended." />);
    expect(screen.getByText("Your session has ended.")).toBeInTheDocument();
  });

  it("shows fallback description when no message provided", () => {
    render(<LinkStatusScreen status="expired" />);
    expect(
      screen.getByText("This interview session is no longer available.")
    ).toBeInTheDocument();
  });

  it("shows start time for not_started status", () => {
    render(<LinkStatusScreen status="not_started" startTime="2024-12-01T10:00:00Z" />);
    expect(screen.getByText(/starts:/i)).toBeInTheDocument();
  });

  it("does not show start time for other statuses", () => {
    render(<LinkStatusScreen status="expired" startTime="2024-12-01T10:00:00Z" />);
    expect(screen.queryByText(/starts:/i)).not.toBeInTheDocument();
  });

  it("renders brand logo", () => {
    render(<LinkStatusScreen status="invalid" />);
    expect(screen.getByAltText("SoftSuave Hire")).toBeInTheDocument();
  });
});
