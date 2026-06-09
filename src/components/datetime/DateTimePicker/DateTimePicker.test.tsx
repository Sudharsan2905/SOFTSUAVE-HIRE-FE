import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DateTimePicker } from "./index";

vi.mock("@/assets/icons", () => ({
  IconCalendar: () => <svg data-testid="icon-calendar" />,
  IconChevronDown: () => <svg data-testid="icon-chevron-down" />,
  IconChevronLeft: () => <svg data-testid="icon-chevron-left" />,
  IconChevronRight: () => <svg data-testid="icon-chevron-right" />,
}));

function getDialog() {
  return screen.getByRole("dialog", { name: /date and time picker/i });
}

describe("DateTimePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders placeholder when no value", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} placeholder="Pick one" />);
    expect(screen.getByText("Pick one")).toBeInTheDocument();
  });

  it("renders default placeholder", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select date & time")).toBeInTheDocument();
  });

  it("renders formatted trigger label when value is set", () => {
    render(<DateTimePicker value="2026-06-20T14:30" onChange={vi.fn()} />);
    expect(screen.getByText(/Jun 20, 2026/)).toBeInTheDocument();
    expect(screen.getByText(/2:30 PM/)).toBeInTheDocument();
  });

  it("renders label and error", () => {
    render(
      <DateTimePicker value="" onChange={vi.fn()} label="Start" error="Required" id="dt1" />
    );
    expect(screen.getByText("Start")).toBeInTheDocument();
    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("does not open the popup when disabled", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the calendar popup on trigger click", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(getDialog()).toBeInTheDocument();
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("toggles the popup closed on second trigger click", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /select date/i });
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("selecting a day fires onChange and advances to the time step", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button"));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: /June 20th, 2026/i }));
    // default time when no value: 12:00 AM => to24h(12,"AM") = 0 => "00:00"
    expect(onChange).toHaveBeenCalledWith("2026-06-20T00:00");
    expect(screen.getByText("Select Time")).toBeInTheDocument();
  });

  it("navigates to previous month", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    expect(screen.getByText("May 2026")).toBeInTheDocument();
  });

  it("navigates to next month", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    expect(screen.getByText("July 2026")).toBeInTheDocument();
  });

  it("shows time columns and allows picking hour, minute and AM/PM", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="2026-06-20T14:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Jun 20/i }));
    const dialog = getDialog();
    // advance to time step by clicking the selected day
    fireEvent.click(within(dialog).getByRole("button", { name: /June 20th, 2026/i }));
    expect(screen.getByText("Select Time")).toBeInTheDocument();

    onChange.mockClear();
    // The three time columns: hours (1-12), minutes (0-59), am/pm.
    const cols = dialog.querySelectorAll('[class*="timeScroll"]');
    const hoursCol = within(cols[0] as HTMLElement);
    const minutesCol = within(cols[1] as HTMLElement);
    const ampmCol = within(cols[2] as HTMLElement);

    // pick hour 09
    fireEvent.click(hoursCol.getByRole("button", { name: "09" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-06-20T21:30"); // 9 PM (ampm stays PM)

    // pick minute 15
    fireEvent.click(minutesCol.getByRole("button", { name: "15" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-06-20T21:15");

    // switch to AM
    fireEvent.click(ampmCol.getByRole("button", { name: "AM" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-06-20T09:15");
  });

  it("Back button returns from time step to calendar", () => {
    render(<DateTimePicker value="2026-06-20T14:30" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Jun 20/i }));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: /June 20th, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByText("June 2026")).toBeInTheDocument();
  });

  it("Clear button emits empty value and closes popup", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="2026-06-20T14:30" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Jun 20/i }));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: /June 20th, 2026/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith("");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <DateTimePicker value="" onChange={vi.fn()} />
        <button>outside</button>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /select date/i }));
    expect(screen.queryByRole("dialog")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("disables days before the min date", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} min="2026-06-10T09:00" />);
    fireEvent.click(screen.getByRole("button"));
    const dialog = getDialog();
    const day5 = within(dialog).getByRole("button", { name: /June 5th, 2026/i });
    expect(day5).toBeDisabled();
    const day12 = within(dialog).getByRole("button", { name: /June 12th, 2026/i });
    expect(day12).not.toBeDisabled();
  });

  it("clicking a disabled day does not fire onChange", () => {
    const onChange = vi.fn();
    render(<DateTimePicker value="" onChange={onChange} min="2026-06-10T09:00" />);
    fireEvent.click(screen.getByRole("button"));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: /June 5th, 2026/i }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disables hours before min on the min day", () => {
    // value is on the min day; min hour is 14 (2 PM)
    render(<DateTimePicker value="2026-06-10T15:00" onChange={vi.fn()} min="2026-06-10T14:00" />);
    fireEvent.click(screen.getByRole("button", { name: /Jun 10/i }));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: /June 10th, 2026/i }));
    const hoursCol = within(dialog.querySelectorAll('[class*="timeScroll"]')[0] as HTMLElement);
    // PM is current ampm; hour 01 PM = 13 < 14 => disabled
    expect(hoursCol.getByRole("button", { name: "01" })).toBeDisabled();
    // hour 03 PM = 15 >= 14 => enabled
    expect(hoursCol.getByRole("button", { name: "03" })).not.toBeDisabled();
  });

  it("disables AM when min hour is in the afternoon on the min day", () => {
    render(<DateTimePicker value="2026-06-10T15:00" onChange={vi.fn()} min="2026-06-10T14:00" />);
    fireEvent.click(screen.getByRole("button", { name: /Jun 10/i }));
    const dialog = getDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: /June 10th, 2026/i }));
    expect(screen.getByRole("button", { name: "AM" })).toBeDisabled();
  });

  it("marks today with a today class when not selected", () => {
    render(<DateTimePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    const dialog = getDialog();
    const todayBtn = within(dialog).getByRole("button", { name: /June 15th, 2026/i });
    expect(todayBtn.className).toMatch(/calDayToday/);
  });
});
