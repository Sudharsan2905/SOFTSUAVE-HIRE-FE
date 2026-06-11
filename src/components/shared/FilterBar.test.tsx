import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { FilterBar } from "./FilterBar";
import { renderWithProviders } from "@/test/utils";

vi.mock("@/components/datetime/DateRangePicker", () => ({
  DateRangePicker: () => <div data-testid="date-range-picker" />,
}));

const defaultProps = {
  search: "",
  onSearchChange: vi.fn(),
  sortBy: "name",
  sortOrder: "asc" as const,
  onSortOrderToggle: vi.fn(),
};

describe("FilterBar", () => {
  it("renders search input", () => {
    renderWithProviders(<FilterBar {...defaultProps} />);
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it("calls onSearchChange when search input changes", () => {
    const onSearchChange = vi.fn();
    renderWithProviders(<FilterBar {...defaultProps} onSearchChange={onSearchChange} />);
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "test" } });
    expect(onSearchChange).toHaveBeenCalledWith("test");
  });

  it("renders refresh button when onRefresh is provided", () => {
    const onRefresh = vi.fn();
    renderWithProviders(<FilterBar {...defaultProps} onRefresh={onRefresh} />);
    expect(screen.getByLabelText(/refresh/i)).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const onRefresh = vi.fn();
    renderWithProviders(<FilterBar {...defaultProps} onRefresh={onRefresh} />);
    screen.getByLabelText(/refresh/i).click();
    expect(onRefresh).toHaveBeenCalled();
  });

  it("renders sort order toggle button", () => {
    renderWithProviders(<FilterBar {...defaultProps} />);
    expect(screen.getByRole("button", { name: /asc|desc/i })).toBeInTheDocument();
  });

  it("calls onSortOrderToggle when sort button clicked", () => {
    const onSortOrderToggle = vi.fn();
    renderWithProviders(<FilterBar {...defaultProps} onSortOrderToggle={onSortOrderToggle} />);
    screen.getByRole("button", { name: /asc|desc/i }).click();
    expect(onSortOrderToggle).toHaveBeenCalled();
  });

  it("renders export button when onExport is provided", () => {
    const onExport = vi.fn();
    renderWithProviders(<FilterBar {...defaultProps} onExport={onExport} />);
    expect(screen.getByRole("button", { name: /export/i })).toBeInTheDocument();
  });

  it("renders grid/list view toggle when viewMode and onViewModeChange provided", () => {
    renderWithProviders(<FilterBar {...defaultProps} viewMode="grid" onViewModeChange={vi.fn()} />);
    expect(screen.getByLabelText(/grid view/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/list view/i)).toBeInTheDocument();
  });

  it("renders more buttons when sortByOptions and onSortByChange provided", () => {
    const { container } = renderWithProviders(
      <FilterBar
        {...defaultProps}
        sortByOptions={[
          { value: "name", label: "Name" },
          { value: "date", label: "Date" },
        ]}
        onSortByChange={vi.fn()}
      />
    );
    // The Select button for sortBy should add at least one extra button
    expect(container.querySelectorAll("button").length).toBeGreaterThan(1);
  });

  it("renders complexity filter when showComplexity=true", () => {
    const { container: c1 } = renderWithProviders(<FilterBar {...defaultProps} />);
    const baseButtons = c1.querySelectorAll("button").length;
    const { container: c2 } = renderWithProviders(
      <FilterBar {...defaultProps} showComplexity onComplexityChange={vi.fn()} complexity="" />
    );
    // Complexity adds a Select button
    expect(c2.querySelectorAll("button").length).toBeGreaterThan(baseButtons);
  });

  it("renders status filter when statusOptions and onStatusChange provided", () => {
    const { container: c1 } = renderWithProviders(<FilterBar {...defaultProps} />);
    const baseButtons = c1.querySelectorAll("button").length;
    const { container: c2 } = renderWithProviders(
      <FilterBar
        {...defaultProps}
        statusOptions={[{ value: "active", label: "Active" }]}
        onStatusChange={vi.fn()}
        status=""
      />
    );
    expect(c2.querySelectorAll("button").length).toBeGreaterThan(baseButtons);
  });

  it("renders children", () => {
    renderWithProviders(
      <FilterBar {...defaultProps}>
        <button data-testid="custom-btn">Custom</button>
      </FilterBar>
    );
    expect(screen.getByTestId("custom-btn")).toBeInTheDocument();
  });

  it("renders date range picker when dateRange and onDateRangeChange provided", () => {
    renderWithProviders(
      <FilterBar {...defaultProps} dateRange={{ from: "", to: "" }} onDateRangeChange={vi.fn()} />
    );
    expect(screen.getByTestId("date-range-picker")).toBeInTheDocument();
  });
});
