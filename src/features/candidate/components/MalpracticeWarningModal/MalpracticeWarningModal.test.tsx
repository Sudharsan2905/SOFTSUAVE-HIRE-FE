import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { MalpracticeWarningModal } from "./index";
import { renderWithProviders } from "@/test/utils";

describe("MalpracticeWarningModal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderVisible(message = "Please stay focused") {
    return renderWithProviders(<MalpracticeWarningModal />, {
      preloadedState: {
        proctoring: {
          isWarningVisible: true,
          warningMessage: message,
          malpracticeCount: 1,
          totalMalpracticeLimit: 3,
          isTerminated: false,
          terminationReason: null,
          lastViolationType: null,
        },
      },
    });
  }

  it("renders nothing when warning is not visible", () => {
    const { container } = renderWithProviders(<MalpracticeWarningModal />, {
      preloadedState: {
        proctoring: {
          isWarningVisible: false,
          warningMessage: "",
          malpracticeCount: 0,
          totalMalpracticeLimit: 3,
          isTerminated: false,
          terminationReason: null,
          lastViolationType: null,
        },
      },
    });
    expect(container.firstChild).toBeNull();
  });

  it("renders warning title when visible", () => {
    renderVisible();
    expect(screen.getByText("Warning")).toBeInTheDocument();
  });

  it("renders warning message", () => {
    renderVisible("Please stay focused");
    expect(screen.getByText("Please stay focused")).toBeInTheDocument();
  });

  it("renders violation count", () => {
    renderVisible();
    expect(screen.getByText("1 / 3 violations")).toBeInTheDocument();
  });

  it("renders dismiss button", () => {
    renderVisible();
    expect(screen.getByRole("button", { name: /dismiss/i })).toBeInTheDocument();
  });

  it("dismisses when button is clicked", () => {
    const { store } = renderVisible();
    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(store.getState().proctoring.isWarningVisible).toBe(false);
  });

  it("renders as alert role", () => {
    renderVisible();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
