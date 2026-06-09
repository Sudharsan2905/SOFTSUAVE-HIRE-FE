import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConnectionLostOverlay } from "./index";

describe("ConnectionLostOverlay", () => {
  it("renders nothing when connected", () => {
    const { container } = render(<ConnectionLostOverlay status="connected" />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Interview Paused when on_hold", () => {
    render(<ConnectionLostOverlay status="on_hold" />);
    expect(screen.getByText("Interview Paused")).toBeInTheDocument();
  });

  it("renders Connection Lost when offline", () => {
    render(<ConnectionLostOverlay status="offline" />);
    expect(screen.getByText("Connection Lost")).toBeInTheDocument();
  });

  it("renders Reconnecting when reconnecting status", () => {
    render(<ConnectionLostOverlay status="reconnecting" />);
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();
  });

  it("shows hold body text when on_hold", () => {
    render(<ConnectionLostOverlay status="on_hold" />);
    expect(screen.getByText(/placed on hold/i)).toBeInTheDocument();
  });

  it("shows offline body text when offline", () => {
    render(<ConnectionLostOverlay status="offline" />);
    expect(screen.getByText(/internet connection was lost/i)).toBeInTheDocument();
  });

  it("shows answers-saved hint when not on_hold", () => {
    render(<ConnectionLostOverlay status="offline" />);
    expect(screen.getByText(/answers and progress are saved/i)).toBeInTheDocument();
  });

  it("does not show reconnecting hint when on_hold", () => {
    render(<ConnectionLostOverlay status="on_hold" />);
    expect(screen.queryByText(/answers and progress are saved/i)).not.toBeInTheDocument();
  });

  it("renders as alert role", () => {
    render(<ConnectionLostOverlay status="offline" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
