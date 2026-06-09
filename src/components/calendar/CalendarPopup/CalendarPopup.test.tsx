import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, fireEvent, act } from "@testing-library/react";
import { createRef } from "react";
import { CalendarPopup } from "./index";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/assets/icons", () => ({
  IconChevronLeft: () => <svg data-testid="icon-chevron-left" />,
  IconChevronRight: () => <svg data-testid="icon-chevron-right" />,
  IconClose: () => <svg data-testid="icon-close" />,
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("react-hot-toast", () => ({
  default: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

describe("CalendarPopup", () => {
  let anchorRef: React.RefObject<HTMLButtonElement>;
  const onClose = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
    anchorRef = createRef<HTMLButtonElement>();
    onClose.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function renderPopup(preloadedState = {}) {
    return renderWithProviders(<CalendarPopup anchorRef={anchorRef} onClose={onClose} />, {
      preloadedState,
    });
  }

  it("renders the monthly calendar with current month", () => {
    renderPopup();
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("renders weekday headers", () => {
    renderPopup();
    ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].forEach((d) => {
      expect(screen.getAllByText(d).length).toBeGreaterThan(0);
    });
  });

  it("navigates to next and previous months", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("disables past dates", () => {
    renderPopup();
    const past = screen.getByRole("button", { name: /Sunday, June 14, 2026/i });
    expect(past).toBeDisabled();
  });

  it("allows clicking a future date and opens the scheduler", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    expect(screen.getByText("Schedule Interview", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Saturday, June 20, 2026")).toBeInTheDocument();
  });

  it("shows workspace badge in the scheduler when active workspace exists", () => {
    renderPopup({
      workspace: {
        activeWorkspace: { id: "w1", name: "Acme Corp" } as never,
        workspaces: [],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("Back button returns to the calendar from the scheduler", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /back to calendar/i }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("Cancel button resets the scheduler back to the calendar", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("Close button calls onClose from the scheduler", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /^close$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows an error toast when submitting without a candidate name", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /schedule interview/i }));
    expect(toastError).toHaveBeenCalledWith("Please enter a candidate name");
  });

  it("selects a time slot", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    const slot = screen.getByRole("button", { name: "10:00 AM" });
    fireEvent.click(slot);
    expect(slot.className).toMatch(/timeSlotActive/);
  });

  it("schedules an interview successfully and calls onClose", async () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));

    fireEvent.change(screen.getByPlaceholderText("Enter candidate full name"), {
      target: { value: "Jane Doe" },
    });

    fireEvent.click(screen.getByRole("button", { name: /schedule interview/i }));

    // advance the simulated 600ms save delay
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("Jane Doe"));
    expect(onClose).toHaveBeenCalled();
  });

  it("Today button resets the calendar to the current month", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /today/i }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("updates notes and email fields", () => {
    renderPopup();
    fireEvent.click(screen.getByRole("button", { name: /Saturday, June 20, 2026/i }));
    const email = screen.getByPlaceholderText("candidate@email.com");
    fireEvent.change(email, { target: { value: "a@b.com" } });
    expect(email).toHaveValue("a@b.com");
    const notes = screen.getByPlaceholderText(/Add interview notes/i);
    fireEvent.change(notes, { target: { value: "Bring laptop" } });
    expect(notes).toHaveValue("Bring laptop");
  });
});
