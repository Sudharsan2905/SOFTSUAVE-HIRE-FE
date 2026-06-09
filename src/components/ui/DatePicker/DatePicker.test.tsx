import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { DatePicker } from "./index";

vi.mock("@/assets/icons", () => ({
  IconChevronLeft: () => <svg data-testid="icon-chevron-left" />,
  IconChevronRight: () => <svg data-testid="icon-chevron-right" />,
}));

function getCalendar() {
  return screen.getByRole("region", { name: /date picker calendar/i });
}

describe("DatePicker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders placeholder when no value", () => {
    render(<DatePicker value="" onChange={vi.fn()} placeholder="Choose date" />);
    expect(screen.getByText("Choose date")).toBeInTheDocument();
  });

  it("renders default placeholder", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    expect(screen.getByText("Select date")).toBeInTheDocument();
  });

  it("renders formatted display value", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    expect(screen.getByText("08 Mar 2020")).toBeInTheDocument();
  });

  it("renders label and required asterisk", () => {
    render(<DatePicker value="" onChange={vi.fn()} label="Birthday" showRequired />);
    expect(screen.getByText("Birthday")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("renders error message", () => {
    render(<DatePicker value="" onChange={vi.fn()} error="This is wrong" />);
    expect(screen.getByText("This is wrong")).toBeInTheDocument();
  });

  it("renders hint when no error", () => {
    render(<DatePicker value="" onChange={vi.fn()} hint="DOB" />);
    expect(screen.getByText("DOB")).toBeInTheDocument();
  });

  it("does not open when disabled", () => {
    render(<DatePicker value="" onChange={vi.fn()} disabled />);
    const trigger = screen.getByRole("button");
    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: /date picker calendar/i })).not.toBeInTheDocument();
  });

  it("opens the calendar popup on trigger click", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    expect(getCalendar()).toBeInTheDocument();
    expect(screen.getByText("2020")).toBeInTheDocument();
  });

  it("toggles closed on second click", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    const trigger = screen.getByRole("button", { name: /08 Mar 2020/i });
    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: /date picker calendar/i })).toBeInTheDocument();
    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: /date picker calendar/i })).not.toBeInTheDocument();
  });

  it("selecting a day fires onChange and closes the popup", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2020-03-08" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    const cal = getCalendar();
    fireEvent.click(within(cal).getByRole("button", { name: /15 March 2020/i }));
    expect(onChange).toHaveBeenCalledWith("2020-03-15");
    expect(screen.queryByRole("region", { name: /date picker calendar/i })).not.toBeInTheDocument();
  });

  it("navigates to the previous month", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
    const select = screen.getByRole("combobox", { name: /select month/i }) as HTMLSelectElement;
    expect(select.value).toBe("1"); // February
  });

  it("navigates to the next month when allowed", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    fireEvent.click(screen.getByRole("button", { name: /next month/i }));
    const select = screen.getByRole("combobox", { name: /select month/i }) as HTMLSelectElement;
    expect(select.value).toBe("3"); // April
  });

  it("disables the next-month button when on the current month", () => {
    render(<DatePicker value="2026-06-10" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /10 Jun 2026/i }));
    expect(screen.getByRole("button", { name: /next month/i })).toBeDisabled();
  });

  it("disables future days in the current month", () => {
    render(<DatePicker value="2026-06-10" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /10 Jun 2026/i }));
    const cal = getCalendar();
    expect(within(cal).getByRole("button", { name: /20 June 2026/i })).toBeDisabled();
    expect(within(cal).getByRole("button", { name: /10 June 2026/i })).not.toBeDisabled();
  });

  it("selecting a month from the dropdown updates the view", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    const select = screen.getByRole("combobox", { name: /select month/i });
    fireEvent.change(select, { target: { value: "0" } }); // January
    expect((select as HTMLSelectElement).value).toBe("0");
  });

  it("allows editing the year via the year input", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit year/i }));
    const yearInput = screen.getByRole("spinbutton");
    fireEvent.change(yearInput, { target: { value: "2015" } });
    fireEvent.submit(yearInput.closest("form")!);
    expect(screen.getByText("2015")).toBeInTheDocument();
  });

  it("ignores an out-of-range year", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit year/i }));
    const yearInput = screen.getByRole("spinbutton");
    fireEvent.change(yearInput, { target: { value: "1800" } });
    fireEvent.submit(yearInput.closest("form")!);
    // unchanged
    expect(screen.getByText("2020")).toBeInTheDocument();
  });

  it("Today button selects today and fires onChange", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2020-03-08" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    fireEvent.click(screen.getByRole("button", { name: /today/i }));
    expect(onChange).toHaveBeenCalledWith("2026-06-15");
  });

  it("Clear button appears only when value is set and clears it", () => {
    const onChange = vi.fn();
    render(<DatePicker value="2020-03-08" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("does not show Clear button when no value", () => {
    render(<DatePicker value="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button"));
    const cal = getCalendar();
    expect(within(cal).queryByRole("button", { name: /clear/i })).not.toBeInTheDocument();
  });

  it("closes on outside click", () => {
    render(
      <div>
        <DatePicker value="2020-03-08" onChange={vi.fn()} />
        <span>outside</span>
      </div>
    );
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    expect(getCalendar()).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("region", { name: /date picker calendar/i })).not.toBeInTheDocument();
  });

  it("ignores invalid value strings (shows placeholder)", () => {
    render(<DatePicker value="not-a-date" onChange={vi.fn()} placeholder="Pick it" />);
    expect(screen.getByText("Pick it")).toBeInTheDocument();
  });

  it("marks the selected day with aria-pressed", () => {
    render(<DatePicker value="2020-03-08" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /08 Mar 2020/i }));
    const cal = getCalendar();
    expect(within(cal).getByRole("button", { name: /^8 March 2020$/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
