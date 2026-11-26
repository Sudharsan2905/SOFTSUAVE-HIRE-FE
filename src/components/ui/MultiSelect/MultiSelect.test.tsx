import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MultiSelect } from "./index";

const OPTIONS = [
  { value: "a", label: "Python" },
  { value: "b", label: "SQL" },
  { value: "c", label: "React" },
];

function setup(props: Partial<React.ComponentProps<typeof MultiSelect>> = {}) {
  const onChange = vi.fn();
  render(
    <MultiSelect
      label="Assessments"
      options={OPTIONS}
      value={[]}
      onChange={onChange}
      placeholder="Select assessments"
      {...props}
    />
  );
  return {
    onChange,
    // the <label> names the trigger button
    trigger: screen.getByLabelText("Assessments"),
  };
}

describe("MultiSelect", () => {
  it("shows the placeholder when nothing is selected", () => {
    setup();
    expect(screen.getByText("Select assessments")).toBeInTheDocument();
  });

  it("shows the label of a single selection", () => {
    setup({ value: ["b"] });
    expect(screen.getByText("SQL")).toBeInTheDocument();
  });

  it("shows a count when several are selected", () => {
    setup({ value: ["a", "b"] });
    expect(screen.getByText("2 selected")).toBeInTheDocument();
  });

  it("opens a listbox of options and adds the clicked one", () => {
    const { onChange, trigger } = setup({ value: ["a"] });
    fireEvent.click(trigger);

    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    fireEvent.click(screen.getByRole("option", { name: "SQL" }));

    expect(onChange).toHaveBeenCalledWith(["a", "b"]);
  });

  it("removes an already selected option when clicked again", () => {
    const { onChange, trigger } = setup({ value: ["a", "b"] });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Python" }));

    expect(onChange).toHaveBeenCalledWith(["b"]);
  });

  it("marks selected options with aria-selected", () => {
    const { trigger } = setup({ value: ["c"] });
    fireEvent.click(trigger);

    expect(screen.getByRole("option", { name: "React" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "SQL" })).toHaveAttribute("aria-selected", "false");
  });

  it("selects all and clears", () => {
    const { onChange, trigger } = setup({ value: ["a"] });
    fireEvent.click(trigger);

    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b", "c"]);

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it("disables Clear when nothing is selected", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);

    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  describe("maxSelected", () => {
    it("blocks further options once the limit is reached", () => {
      const { onChange, trigger } = setup({ value: ["a", "b"], maxSelected: 2 });
      fireEvent.click(trigger);

      const blocked = screen.getByRole("option", { name: "React" });
      expect(blocked).toBeDisabled();
      fireEvent.click(blocked);
      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByText("2 / 2 selected")).toBeInTheDocument();
    });

    it("still lets a selected option be removed at the limit", () => {
      const { onChange, trigger } = setup({ value: ["a", "b"], maxSelected: 2 });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("option", { name: "Python" }));

      expect(onChange).toHaveBeenCalledWith(["b"]);
    });

    it("select all stops at the limit", () => {
      const { onChange, trigger } = setup({ maxSelected: 2 });
      fireEvent.click(trigger);
      fireEvent.click(screen.getByRole("button", { name: "Select all" }));

      expect(onChange).toHaveBeenCalledWith(["a", "b"]);
    });
  });

  it("closes on Escape and on an outside click", () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();

    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", () => {
    const { trigger } = setup({ disabled: true });

    expect(trigger).toBeDisabled();
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows an empty message when there are no options", () => {
    const { trigger } = setup({ options: [] });
    fireEvent.click(trigger);

    expect(screen.getByText("No options")).toBeInTheDocument();
  });
});
