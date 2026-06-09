import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { AssessmentCard } from "./index";
import { renderWithProviders } from "@/test/utils";
import type { Assessment } from "@/types";

function makeAssessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: "a1",
    name: "JavaScript Test",
    description: "A JS assessment",
    accessibility: "public",
    rounds: [
      { id: "r1", round_number: 1, question_count: 10, max_duration_minutes: 30 },
    ],
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
    submission_count: 5,
    share_link: "abc123",
    monitoring_config: null,
    workspace_id: "ws-1",
    ...overrides,
  } as Assessment;
}

const defaultProps = {
  assessment: makeAssessment(),
  workspaceId: "ws-1",
  viewMode: "grid" as const,
  onEdit: vi.fn(),
  onClone: vi.fn(),
  onDelete: vi.fn(),
};

describe("AssessmentCard", () => {
  it("renders assessment name", () => {
    renderWithProviders(<AssessmentCard {...defaultProps} />);
    expect(screen.getByLabelText(/javascript test/i)).toBeInTheDocument();
  });

  it("renders Normal badge for public accessibility", () => {
    renderWithProviders(<AssessmentCard {...defaultProps} />);
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("renders Monitoring badge for monitoring accessibility", () => {
    renderWithProviders(
      <AssessmentCard
        {...defaultProps}
        assessment={makeAssessment({ accessibility: "monitoring" })}
      />
    );
    expect(screen.getByText("Monitoring")).toBeInTheDocument();
  });

  it("renders round count badge", () => {
    renderWithProviders(<AssessmentCard {...defaultProps} />);
    expect(screen.getByText("1 round")).toBeInTheDocument();
  });

  it("renders plural rounds for multiple rounds", () => {
    renderWithProviders(
      <AssessmentCard
        {...defaultProps}
        assessment={makeAssessment({
          rounds: [
            { round_number: 1, question_count: 5, max_duration_minutes: 20, question_ids: [] },
            { round_number: 2, question_count: 5, max_duration_minutes: 20, question_ids: [] },
          ],
        })}
      />
    );
    expect(screen.getByText("2 rounds")).toBeInTheDocument();
  });

  it("opens action menu on dots button click", () => {
    renderWithProviders(<AssessmentCard {...defaultProps} />);
    const dotsBtn = screen.getByLabelText("Assessment actions");
    fireEvent.click(dotsBtn);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Edit")).toBeInTheDocument();
  });

  it("calls onEdit when Edit is clicked", () => {
    const onEdit = vi.fn();
    renderWithProviders(<AssessmentCard {...defaultProps} onEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText("Assessment actions"));
    fireEvent.click(screen.getByText("Edit"));
    expect(onEdit).toHaveBeenCalledWith(defaultProps.assessment);
  });

  it("calls onDelete when Delete is clicked", () => {
    const onDelete = vi.fn();
    renderWithProviders(<AssessmentCard {...defaultProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText("Assessment actions"));
    fireEvent.click(screen.getByText("Delete"));
    expect(onDelete).toHaveBeenCalled();
  });

  it("calls onClone when Clone is clicked", () => {
    const onClone = vi.fn();
    renderWithProviders(<AssessmentCard {...defaultProps} onClone={onClone} />);
    fireEvent.click(screen.getByLabelText("Assessment actions"));
    fireEvent.click(screen.getByText("Clone"));
    expect(onClone).toHaveBeenCalled();
  });
});
