import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { render } from "@testing-library/react";
import { CreateAssessmentWizard } from "./WizardContainer";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    ASSESSMENTS: {
      ROOT: (wsId: string) => `/workspaces/${wsId}/assessments`,
      BY_ID: (wsId: string, id: string) => `/workspaces/${wsId}/assessments/${id}`,
    },
  },
}));

vi.mock("@/features/assessments/constants", () => ({
  ASSESSMENT_SUCCESS: {
    CREATED: "Assessment created successfully.",
    UPDATED: "Assessment updated successfully.",
  },
  ASSESSMENT_ERRORS: {
    CREATE_FAILED: "Failed to create assessment. Please try again.",
    UPDATE_FAILED: "Failed to update assessment. Please try again.",
  },
  DEFAULT_MONITORING_CONFIG: {},
  DEFAULT_ROUND: {
    round_number: 1,
    question_count: 2,
    max_duration_minutes: 30,
    question_ids: [] as string[],
  },
}));

// Modal — always rendered open (component passes isOpen always)
vi.mock("@/components/ui/Modal", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Modal: ({ children, title, footer, onClose }: any) => (
    <div data-testid="modal">
      <h2 data-testid="modal-title">{title}</h2>
      <button data-testid="modal-close" onClick={onClose}>
        Close
      </button>
      <div data-testid="modal-content">{children}</div>
      {footer && <div data-testid="modal-footer">{footer}</div>}
    </div>
  ),
}));

// Step1BasicInfo — controlled mock that simulates the real onNext contract.
// Calling onNext passes a draft with rounds that have `question_count` matching
// what was specified so the finish-button disabled logic can be tested.
vi.mock("./Step1BasicInfo", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Step1BasicInfo: ({ onNext, disableNext, draft }: any) => (
    <div data-testid="step1">
      <span data-testid="step1-draft-name">{draft?.name ?? ""}</span>
      {/* single-round next */}
      <button
        data-testid="step1-next"
        disabled={disableNext}
        onClick={() =>
          onNext({
            name: "Test Assessment",
            description: "",
            rounds: [
              {
                round_number: 1,
                question_count: 2,
                max_duration_minutes: 30,
                question_ids: [],
              },
            ],
            monitoring_config: {},
            accessibility: "normal",
          })
        }
      >
        Next: Select Questions
      </button>
      {/* multi-round next for tests that need it */}
      <button
        data-testid="step1-next-multi"
        onClick={() =>
          onNext({
            name: "Multi Round",
            description: "",
            rounds: [
              {
                round_number: 1,
                question_count: 2,
                max_duration_minutes: 30,
                question_ids: [],
              },
              {
                round_number: 2,
                question_count: 3,
                max_duration_minutes: 30,
                question_ids: [],
              },
            ],
            monitoring_config: {},
            accessibility: "normal",
          })
        }
      >
        Next Multi
      </button>
    </div>
  ),
}));

// Step2Questions — simulates question selection callbacks
vi.mock("./Step2Questions", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Step2Questions: ({ onUpdateQuestions, currentRound }: any) => (
    <div data-testid="step2" data-round={currentRound}>
      <button data-testid="select-questions" onClick={() => onUpdateQuestions(["q1", "q2"])}>
        Select 2 Questions
      </button>
      {/* Selects enough for the multi-round test (round 2 needs 3 questions) */}
      <button
        data-testid="select-questions-3"
        onClick={() => onUpdateQuestions(["q1", "q2", "q3"])}
      >
        Select 3 Questions
      </button>
    </div>
  ),
}));

vi.mock("@/components/ui/Select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: ({ label, value, onChange, options }: any) => (
    <div>
      {label && <label>{label}</label>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {options?.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock("@/components/ui/Button", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: ({ children, onClick, disabled, isLoading, variant }: any) => (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      data-loading={isLoading}
      data-variant={variant}
    >
      {children}
    </button>
  ),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPut = api.put as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const defaultProps = {
  workspaceId: "ws-1",
  onClose: vi.fn(),
  onSuccess: vi.fn(),
};

function renderWizard(props: Partial<typeof defaultProps> & Record<string, unknown> = {}) {
  return render(<CreateAssessmentWizard {...defaultProps} {...props} />);
}

// Advances from step 1 to step 2 using the single-round "Next" button
async function advanceToStep2(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("step1-next"));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockPost.mockReset();
  mockPut.mockReset();
  vi.mocked(toast.success).mockReset?.();
  vi.mocked(toast.error).mockReset?.();
  defaultProps.onClose = vi.fn();
  defaultProps.onSuccess = vi.fn();
  mockPost.mockResolvedValue({ data: {} });
  mockPut.mockResolvedValue({ data: {} });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CreateAssessmentWizard", () => {
  // ── 1. Default render ────────────────────────────────────────────────────

  it("renders step 1 by default with 'Create Assessment' title", () => {
    renderWizard();
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Create Assessment");
    expect(screen.getByTestId("step1")).toBeInTheDocument();
    expect(screen.queryByTestId("step2")).not.toBeInTheDocument();
  });

  // ── 2. Step indicator labels ─────────────────────────────────────────────

  it("shows step indicator labels 'Basic Info' and 'Select Questions'", () => {
    renderWizard();
    expect(screen.getByText("Basic Info")).toBeInTheDocument();
    expect(screen.getByText("Select Questions")).toBeInTheDocument();
  });

  // ── 3. Advancing to step 2 ───────────────────────────────────────────────

  it("advances to step 2 when Step1 calls onNext", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    expect(screen.getByTestId("step2")).toBeInTheDocument();
    expect(screen.queryByTestId("step1")).not.toBeInTheDocument();
  });

  // ── 4. Step 2 title format ───────────────────────────────────────────────

  it("step 2 title includes round number 'Select Questions — Round 1 of 1'", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Select Questions — Round 1 of 1");
  });

  // ── 5. Back from step 2 ──────────────────────────────────────────────────

  it("'Back' from step 2 returns to step 1", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    expect(screen.getByTestId("step2")).toBeInTheDocument();
    // Back button is in the footer
    await user.click(screen.getByRole("button", { name: /back/i }));
    expect(screen.getByTestId("step1")).toBeInTheDocument();
    expect(screen.queryByTestId("step2")).not.toBeInTheDocument();
  });

  // ── 6. api.post called on finish (create mode) ───────────────────────────

  it("calls api.post on finish in create mode", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    // Select enough questions so the button is enabled (question_count = 2)
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /finish & create/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledTimes(1));
    expect(mockPost).toHaveBeenCalledWith(
      "/workspaces/ws-1/assessments",
      expect.objectContaining({ name: "Test Assessment" })
    );
  });

  // ── 7. onSuccess called after successful create ──────────────────────────

  it("calls onSuccess after successful create", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /finish & create/i }));
    await waitFor(() => expect(defaultProps.onSuccess).toHaveBeenCalledTimes(1));
  });

  // ── 8. Success toast shown on create ────────────────────────────────────

  it("shows success toast on create", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /finish & create/i }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Assessment created successfully.")
    );
  });

  // ── 9. Error toast when api.post fails ───────────────────────────────────

  it("shows error toast when api.post fails", async () => {
    mockPost.mockRejectedValue(new Error("network error"));
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /finish & create/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to create assessment. Please try again.")
    );
  });

  // ── 10. api.put called in edit mode ─────────────────────────────────────

  it("uses api.put in edit mode", async () => {
    const user = userEvent.setup();
    renderWizard({ editMode: true, assessmentId: "a-42" });
    await advanceToStep2(user);
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(mockPut).toHaveBeenCalledTimes(1));
    expect(mockPut).toHaveBeenCalledWith("/workspaces/ws-1/assessments/a-42", expect.any(Object));
    expect(mockPost).not.toHaveBeenCalled();
  });

  // ── 11. 'Save Changes' label in edit mode ───────────────────────────────

  it("shows 'Save Changes' label in edit mode", async () => {
    const user = userEvent.setup();
    renderWizard({ editMode: true, assessmentId: "a-42" });
    await advanceToStep2(user);
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finish & create/i })).not.toBeInTheDocument();
  });

  // ── 12. 'Edit Assessment' title in edit mode ─────────────────────────────

  it("shows 'Edit Assessment' title in edit mode on step 1", () => {
    renderWizard({ editMode: true, assessmentId: "a-42" });
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Edit Assessment");
  });

  // ── 13. onClose is passed to Modal ──────────────────────────────────────

  it("calls onClose when Modal's close is triggered", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByTestId("modal-close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── 14. Workspace selector visible when >1 workspaces ───────────────────

  it("shows workspace selector when availableWorkspaces has more than 1 entry", () => {
    renderWizard({
      availableWorkspaces: [
        { id: "ws-1", name: "Engineering" },
        { id: "ws-2", name: "Design" },
      ],
    });
    expect(screen.getByLabelText("Target Workspace")).toBeInTheDocument();
  });

  // ── 15. No workspace selector with single workspace ──────────────────────

  it("does not show workspace selector with single workspace", () => {
    renderWizard({
      availableWorkspaces: [{ id: "ws-1", name: "Engineering" }],
    });
    expect(screen.queryByLabelText("Target Workspace")).not.toBeInTheDocument();
  });

  // ── 16. No workspace selector with no workspaces ────────────────────────

  it("does not show workspace selector when availableWorkspaces is undefined", () => {
    renderWizard({ availableWorkspaces: undefined });
    expect(screen.queryByLabelText("Target Workspace")).not.toBeInTheDocument();
  });

  // ── 17. 'Next Round' button appears with multiple rounds ─────────────────

  it("'Next Round' button appears when there are multiple rounds", async () => {
    const user = userEvent.setup();
    renderWizard();
    // Use the multi-round next trigger
    await user.click(screen.getByTestId("step1-next-multi"));
    // Round 1 needs 2 questions — select them to enable Next Round
    await user.click(screen.getByTestId("select-questions"));
    expect(screen.getByRole("button", { name: /next round/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /finish & create/i })).not.toBeInTheDocument();
  });

  // ── 18. 'Next Round' navigates to round 2, title updates ─────────────────

  it("clicking 'Next Round' advances to round 2 and updates the title", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByTestId("step1-next-multi"));
    await user.click(screen.getByTestId("select-questions")); // satisfy round 1 count
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Select Questions — Round 1 of 2");
    await user.click(screen.getByRole("button", { name: /next round/i }));
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Select Questions — Round 2 of 2");
    expect(screen.getByTestId("step2")).toHaveAttribute("data-round", "1");
  });

  // ── 19. 'Back' from round 2 goes to round 1, not step 1 ─────────────────

  it("'Back' from round 2 returns to round 1 (not step 1)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await user.click(screen.getByTestId("step1-next-multi"));
    await user.click(screen.getByTestId("select-questions")); // satisfy round 1
    await user.click(screen.getByRole("button", { name: /next round/i }));
    // Now on round 2
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Round 2 of 2");
    await user.click(screen.getByRole("button", { name: /back/i }));
    // Should be back on round 1 (step 2 still shown)
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Round 1 of 2");
    expect(screen.getByTestId("step2")).toBeInTheDocument();
    expect(screen.queryByTestId("step1")).not.toBeInTheDocument();
  });

  // ── 20. onUpdateQuestions updates selected question IDs ──────────────────

  it("updates selected question IDs when Step2Questions calls onUpdateQuestions", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    // Before selection finish button should be disabled (0 < 2)
    const finishBtn = screen.getByRole("button", { name: /finish & create/i });
    expect(finishBtn).toBeDisabled();
    // Select questions — onUpdateQuestions(["q1","q2"]) will set question_ids
    await user.click(screen.getByTestId("select-questions"));
    // After selection, finish button should be enabled (2 >= 2)
    await waitFor(() => expect(finishBtn).not.toBeDisabled());
  });

  // ── 21. Finish button disabled when insufficient questions selected ───────

  it("finish button is disabled when roundSelected < roundRequired", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    // question_count=2, question_ids=[] initially → 0 < 2 → disabled
    const finishBtn = screen.getByRole("button", { name: /finish & create/i });
    expect(finishBtn).toBeDisabled();
  });

  // ── 22. Renders with initialData pre-filled ──────────────────────────────

  it("renders with initialData pre-filled in draft", () => {
    renderWizard({
      initialData: {
        name: "Prefilled Assessment",
        description: "Initial description",
        rounds: [
          {
            round_number: 1,
            question_count: 5,
            max_duration_minutes: 45,
            question_ids: [],
          },
        ],
        accessibility: "normal",
        monitoring_config: {},
      },
    });
    // Step1BasicInfo mock renders draft.name
    expect(screen.getByTestId("step1-draft-name")).toHaveTextContent("Prefilled Assessment");
  });

  // ── 23. Success toast in edit mode calls UPDATED message ─────────────────

  it("shows updated success toast in edit mode", async () => {
    const user = userEvent.setup();
    renderWizard({ editMode: true, assessmentId: "a-42" });
    await advanceToStep2(user);
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Assessment updated successfully.")
    );
  });

  // ── 24. Error toast when api.put fails (edit mode) ───────────────────────

  it("shows error toast when api.put fails in edit mode", async () => {
    mockPut.mockRejectedValue(new Error("server error"));
    const user = userEvent.setup();
    renderWizard({ editMode: true, assessmentId: "a-42" });
    await advanceToStep2(user);
    await user.click(screen.getByTestId("select-questions"));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to update assessment. Please try again.")
    );
  });

  // ── 25. Modal footer absent on step 1, present on step 2 ─────────────────

  it("modal footer is absent on step 1 and present on step 2", async () => {
    const user = userEvent.setup();
    renderWizard();
    expect(screen.queryByTestId("modal-footer")).not.toBeInTheDocument();
    await advanceToStep2(user);
    expect(screen.getByTestId("modal-footer")).toBeInTheDocument();
  });

  // ── 26. Step 2 data-round attribute tracks currentRound ──────────────────

  it("step2 element starts at round 0 (index)", async () => {
    const user = userEvent.setup();
    renderWizard();
    await advanceToStep2(user);
    expect(screen.getByTestId("step2")).toHaveAttribute("data-round", "0");
  });
});
