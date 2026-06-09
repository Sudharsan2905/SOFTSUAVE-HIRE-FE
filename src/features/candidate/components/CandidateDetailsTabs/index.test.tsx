import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { CandidateDetailsTabs } from "./index";
import { renderWithProviders } from "@/test/utils";
import type { CandidateSubmissionDetail, MalpracticeEvent, RoundResult, QuestionAnswer } from "@/types";
import { SubmissionStatus, MalpracticeType, QuestionType } from "@/types";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

// ---------------------------------------------------------------------------
// Import api after mock
// ---------------------------------------------------------------------------
import { api } from "@/utils/api";
import toast from "react-hot-toast";
const mockPost = api.post as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Data factories
// ---------------------------------------------------------------------------

function makeQuestionAnswer(overrides: Partial<QuestionAnswer> = {}): QuestionAnswer {
  return {
    question_id: "q-1",
    question_text: "What is 2 + 2?",
    question_type: QuestionType.MCQ_SINGLE,
    options: [
      { id: "opt-a", text: "3", is_correct: false },
      { id: "opt-b", text: "4", is_correct: true },
    ],
    candidate_answer: "opt-b",
    is_correct: true,
    ...overrides,
  };
}

function makeRoundResult(overrides: Partial<RoundResult> = {}): RoundResult {
  return {
    round_number: 1,
    score: 10,
    percentage: 100,
    started_at: "2024-06-01T10:00:00Z",
    completed_at: "2024-06-01T10:30:00Z",
    question_answers: [makeQuestionAnswer()],
    ...overrides,
  };
}

function makeMalpracticeEvent(overrides: Partial<MalpracticeEvent> = {}): MalpracticeEvent {
  return {
    type: MalpracticeType.TAB_SWITCH,
    label: null,
    description: null,
    timestamp: "2024-06-01T10:05:00Z",
    round: 1,
    screen_image_url: null,
    face_image_url: null,
    screen_video_url: null,
    audio_clip_url: null,
    is_terminal: false,
    ...overrides,
  };
}

function makeSubmissionDetail(
  overrides: Partial<CandidateSubmissionDetail> = {}
): CandidateSubmissionDetail {
  return {
    candidate: {
      id: "cand-1",
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@example.com",
      phone: null,
      gender: null,
      dob: null,
      institution: null,
      location: null,
    },
    submission_id: "sub-1",
    status: SubmissionStatus.COMPLETED,
    score: 10,
    percentage: 80,
    malpractice_count: 0,
    reaccess_count: 0,
    started_at: "2024-06-01T10:00:00Z",
    completed_at: "2024-06-01T10:30:00Z",
    current_version: 1,
    available_versions: [],
    rounds: [makeRoundResult()],
    malpractice_events: [],
    screenshots: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

const defaultProps = {
  workspaceId: "ws-1",
  assessmentId: "assess-1",
  onRefresh: vi.fn(),
};

function renderComponent(data: CandidateSubmissionDetail = makeSubmissionDetail()) {
  return renderWithProviders(
    <CandidateDetailsTabs {...defaultProps} data={data} />
  );
}

beforeEach(() => {
  mockPost.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  defaultProps.onRefresh.mockReset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CandidateDetailsTabs", () => {
  // ── Tab navigation ──────────────────────────────────────────────────────

  describe("Tab bar", () => {
    it("renders all four tab buttons", () => {
      renderComponent();
      expect(screen.getByRole("tab", { name: /over all/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /rounds/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /malpractice/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /screenshots/i })).toBeInTheDocument();
    });

    it("defaults to the Overall tab selected", () => {
      renderComponent();
      expect(screen.getByRole("tab", { name: /over all/i })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    it("other tabs are not selected initially", () => {
      renderComponent();
      expect(screen.getByRole("tab", { name: /rounds/i })).toHaveAttribute(
        "aria-selected",
        "false"
      );
      expect(screen.getByRole("tab", { name: /malpractice/i })).toHaveAttribute(
        "aria-selected",
        "false"
      );
      expect(screen.getByRole("tab", { name: /screenshots/i })).toHaveAttribute(
        "aria-selected",
        "false"
      );
    });

    it("switches to Rounds tab when clicked", () => {
      renderComponent();
      fireEvent.click(screen.getByRole("tab", { name: /rounds/i }));
      expect(screen.getByRole("tab", { name: /rounds/i })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    it("switches to Malpractice tab when clicked", () => {
      renderComponent();
      fireEvent.click(screen.getByRole("tab", { name: /malpractice/i }));
      expect(screen.getByRole("tab", { name: /malpractice/i })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    it("switches to Screenshots tab when clicked", () => {
      renderComponent();
      fireEvent.click(screen.getByRole("tab", { name: /screenshots/i }));
      expect(screen.getByRole("tab", { name: /screenshots/i })).toHaveAttribute(
        "aria-selected",
        "true"
      );
    });

    it("renders a tabpanel region", () => {
      renderComponent();
      expect(screen.getByRole("tabpanel")).toBeInTheDocument();
    });

    it("tabpanel is labelled by the active tab", () => {
      renderComponent();
      const panel = screen.getByRole("tabpanel");
      expect(panel).toHaveAttribute("aria-labelledby", "tab-overall");
    });
  });

  // ── Overall tab ─────────────────────────────────────────────────────────

  describe("Overall tab", () => {
    it("shows the Over All card heading", () => {
      renderComponent();
      // "Over All" appears in both the tab label and the card heading — use getAllByText
      expect(screen.getAllByText("Over All").length).toBeGreaterThanOrEqual(2);
    });

    it("displays score", () => {
      renderComponent(makeSubmissionDetail({ score: 42 }));
      expect(screen.getByText("42")).toBeInTheDocument();
    });

    it("displays percentage", () => {
      renderComponent(makeSubmissionDetail({ percentage: 80 }));
      expect(screen.getByText("80%")).toBeInTheDocument();
    });

    it("displays malpractice count", () => {
      renderComponent(makeSubmissionDetail({ malpractice_count: 3 }));
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("displays reaccess count", () => {
      renderComponent(makeSubmissionDetail({ reaccess_count: 2 }));
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("shows dash for started_at when null", () => {
      renderComponent(makeSubmissionDetail({ started_at: null }));
      // Both started and completed may show "-" — verify at least one is present
      expect(screen.getAllByText("-").length).toBeGreaterThan(0);
    });

    it("shows Re-access button for completed status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      expect(screen.getByRole("button", { name: /re-access/i })).toBeInTheDocument();
    });

    it("shows Re-access button for malpractice status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.MALPRACTICE }));
      expect(screen.getByRole("button", { name: /re-access/i })).toBeInTheDocument();
    });

    it("shows Re-access button for terminated status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.TERMINATED }));
      expect(screen.getByRole("button", { name: /re-access/i })).toBeInTheDocument();
    });

    it("shows Resume button for on_hold status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.ON_HOLD }));
      expect(screen.getByRole("button", { name: /resume/i })).toBeInTheDocument();
    });

    it("shows Terminate button for in_progress status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.IN_PROGRESS }));
      expect(screen.getByRole("button", { name: /terminate/i })).toBeInTheDocument();
    });

    it("shows Terminate button for pending status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.PENDING }));
      expect(screen.getByRole("button", { name: /terminate/i })).toBeInTheDocument();
    });

    it("does not show Resume or Terminate for completed status", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      expect(screen.queryByRole("button", { name: /resume/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /terminate/i })).not.toBeInTheDocument();
    });
  });

  // ── Re-access modal ─────────────────────────────────────────────────────

  describe("Re-access modal", () => {
    it("opens modal when Re-access button is clicked", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      fireEvent.click(screen.getByRole("button", { name: /re-access/i }));
      expect(screen.getByText("Grant Re-access")).toBeInTheDocument();
    });

    it("closes modal when Cancel is clicked", () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      fireEvent.click(screen.getByRole("button", { name: /re-access/i }));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      expect(screen.queryByText("Grant Re-access")).not.toBeInTheDocument();
    });

    it("calls api.post and onRefresh after confirming re-access", async () => {
      mockPost.mockResolvedValue({});
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      fireEvent.click(screen.getByRole("button", { name: /re-access/i }));
      fireEvent.click(screen.getByRole("button", { name: /confirm re-access/i }));
      await waitFor(() => expect(mockPost).toHaveBeenCalledOnce());
      expect(defaultProps.onRefresh).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Re-access granted.");
    });

    it("shows error toast when re-access API fails", async () => {
      mockPost.mockRejectedValue(new Error("server error"));
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      fireEvent.click(screen.getByRole("button", { name: /re-access/i }));
      fireEvent.click(screen.getByRole("button", { name: /confirm re-access/i }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
    });

    it("shows reason textarea when 'Other' category is selected", async () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      fireEvent.click(screen.getByRole("button", { name: /re-access/i }));
      // The Select is a custom portal dropdown. Click the trigger to open it.
      const selectTrigger = screen.getByLabelText(/reason category/i);
      fireEvent.click(selectTrigger);
      // "Other" option is rendered into document.body via portal
      await waitFor(() => expect(screen.getByText("Other")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Other"));
      await waitFor(() =>
        expect(screen.getByPlaceholderText(/describe why re-access/i)).toBeInTheDocument()
      );
    });

    it("shows error toast when 'Other' category has empty reason", async () => {
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.COMPLETED }));
      fireEvent.click(screen.getByRole("button", { name: /re-access/i }));
      // Open the custom Select and pick "Other"
      const selectTrigger = screen.getByLabelText(/reason category/i);
      fireEvent.click(selectTrigger);
      await waitFor(() => expect(screen.getByText("Other")).toBeInTheDocument());
      fireEvent.click(screen.getByText("Other"));
      // Leave the reason textarea empty and confirm
      await waitFor(() =>
        expect(screen.getByPlaceholderText(/describe why re-access/i)).toBeInTheDocument()
      );
      fireEvent.click(screen.getByRole("button", { name: /confirm re-access/i }));
      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith("Please provide a reason for re-access.")
      );
    });
  });

  // ── Resume action ───────────────────────────────────────────────────────

  describe("Resume action", () => {
    it("calls api.post and onRefresh when Resume succeeds", async () => {
      mockPost.mockResolvedValue({});
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.ON_HOLD }));
      fireEvent.click(screen.getByRole("button", { name: /resume/i }));
      await waitFor(() => expect(mockPost).toHaveBeenCalledOnce());
      expect(defaultProps.onRefresh).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Interview resumed — candidate can continue.");
    });

    it("shows error toast when Resume fails", async () => {
      mockPost.mockRejectedValue(new Error("network error"));
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.ON_HOLD }));
      fireEvent.click(screen.getByRole("button", { name: /resume/i }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
    });
  });

  // ── Terminate action ────────────────────────────────────────────────────

  describe("Terminate action", () => {
    it("calls api.post and onRefresh when Terminate succeeds", async () => {
      mockPost.mockResolvedValue({});
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.IN_PROGRESS }));
      fireEvent.click(screen.getByRole("button", { name: /terminate/i }));
      await waitFor(() => expect(mockPost).toHaveBeenCalledOnce());
      expect(defaultProps.onRefresh).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Submission terminated.");
    });

    it("shows error toast when Terminate fails", async () => {
      mockPost.mockRejectedValue(new Error("network error"));
      renderComponent(makeSubmissionDetail({ status: SubmissionStatus.IN_PROGRESS }));
      fireEvent.click(screen.getByRole("button", { name: /terminate/i }));
      await waitFor(() => expect(toast.error).toHaveBeenCalled());
    });
  });

  // ── Rounds tab ──────────────────────────────────────────────────────────

  describe("Rounds tab", () => {
    function goToRoundsTab() {
      fireEvent.click(screen.getByRole("tab", { name: /rounds/i }));
    }

    it("shows empty placeholder when no rounds", () => {
      renderComponent(makeSubmissionDetail({ rounds: [] }));
      goToRoundsTab();
      expect(
        screen.getByText(/no rounds recorded for this candidate/i)
      ).toBeInTheDocument();
    });

    it("renders round tab buttons for each round", () => {
      const data = makeSubmissionDetail({
        rounds: [
          makeRoundResult({ round_number: 1 }),
          makeRoundResult({ round_number: 2, question_answers: [] }),
        ],
      });
      renderComponent(data);
      goToRoundsTab();
      expect(screen.getByRole("tab", { name: /round 1/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /round 2/i })).toBeInTheDocument();
    });

    it("renders question card for a round", () => {
      renderComponent();
      goToRoundsTab();
      expect(screen.getByText("Q1")).toBeInTheDocument();
    });

    it("switches between rounds when round tab is clicked", () => {
      const data = makeSubmissionDetail({
        rounds: [
          makeRoundResult({ round_number: 1, question_answers: [makeQuestionAnswer({ question_text: "Question in Round 1" })] }),
          makeRoundResult({ round_number: 2, question_answers: [makeQuestionAnswer({ question_id: "q-2", question_text: "Question in Round 2" })] }),
        ],
      });
      renderComponent(data);
      goToRoundsTab();
      // Initially shows Round 1 content
      expect(screen.getByText("Question in Round 1")).toBeInTheDocument();
      // Click Round 2
      fireEvent.click(screen.getByRole("tab", { name: /round 2/i }));
      expect(screen.getByText("Question in Round 2")).toBeInTheDocument();
    });

    it("shows Correct badge for correct answers", () => {
      const data = makeSubmissionDetail({
        rounds: [makeRoundResult({ question_answers: [makeQuestionAnswer({ is_correct: true })] })],
      });
      renderComponent(data);
      goToRoundsTab();
      expect(screen.getByText("Correct")).toBeInTheDocument();
    });

    it("shows Incorrect badge for wrong answers", () => {
      const data = makeSubmissionDetail({
        rounds: [makeRoundResult({ question_answers: [makeQuestionAnswer({ is_correct: false, candidate_answer: "opt-a" })] })],
      });
      renderComponent(data);
      goToRoundsTab();
      expect(screen.getByText("Incorrect")).toBeInTheDocument();
    });

    it("shows Multiple Choice label for mcq_single questions", () => {
      renderComponent();
      goToRoundsTab();
      expect(screen.getByText("Multiple Choice")).toBeInTheDocument();
    });

    it("shows Multiple Select label for mcq_multi questions", () => {
      const data = makeSubmissionDetail({
        rounds: [makeRoundResult({ question_answers: [makeQuestionAnswer({ question_type: QuestionType.MCQ_MULTI, candidate_answer: ["opt-b"] })] })],
      });
      renderComponent(data);
      goToRoundsTab();
      expect(screen.getByText("Multiple Select")).toBeInTheDocument();
    });

    it("shows Descriptive label for essay questions", () => {
      const data = makeSubmissionDetail({
        rounds: [makeRoundResult({ question_answers: [makeQuestionAnswer({ question_type: QuestionType.ESSAY, options: [], candidate_answer: "My answer", is_correct: null })] })],
      });
      renderComponent(data);
      goToRoundsTab();
      expect(screen.getByText("Descriptive")).toBeInTheDocument();
    });

    it("shows candidate answer text for essay questions", () => {
      const data = makeSubmissionDetail({
        rounds: [makeRoundResult({ question_answers: [makeQuestionAnswer({ question_type: QuestionType.ESSAY, options: [], candidate_answer: "My essay answer", is_correct: null })] })],
      });
      renderComponent(data);
      goToRoundsTab();
      expect(screen.getByText("My essay answer")).toBeInTheDocument();
    });
  });

  // ── Malpractice tab ─────────────────────────────────────────────────────

  describe("Malpractice tab", () => {
    function goToMalpracticeTab() {
      fireEvent.click(screen.getByRole("tab", { name: /malpractice/i }));
    }

    it("shows empty placeholder when no malpractice events", () => {
      renderComponent(makeSubmissionDetail({ malpractice_events: [] }));
      goToMalpracticeTab();
      expect(screen.getByText(/no malpractice events recorded/i)).toBeInTheDocument();
    });

    it("renders malpractice table with events", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent()],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByText("Tab Switch")).toBeInTheDocument();
    });

    it("shows event description in table", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ type: MalpracticeType.TAB_SWITCH })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByText(/switched to another tab/i)).toBeInTheDocument();
    });

    it("shows custom label from backend when provided", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ label: "Custom Label" })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByText("Custom Label")).toBeInTheDocument();
    });

    it("renders dash in face image column when face_image_url is null", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ face_image_url: null })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      // There will be multiple "—" for missing media columns
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThan(0);
    });

    it("renders face image when face_image_url is provided", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ face_image_url: "http://example.com/face.jpg" })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByAltText("Face capture")).toBeInTheDocument();
    });

    it("renders screen image thumbnail when screen_image_url is provided", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ screen_image_url: "http://example.com/screen.jpg" })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByAltText("Screen capture")).toBeInTheDocument();
    });

    it("renders play video button when screen_video_url is provided", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ screen_video_url: "http://example.com/vid.mp4" })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByRole("button", { name: /play screen recording/i })).toBeInTheDocument();
    });

    it("renders play audio button when audio_clip_url is provided", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent({ audio_clip_url: "http://example.com/audio.mp3" })],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByRole("button", { name: /play audio clip/i })).toBeInTheDocument();
    });

    it("shows event count in footer", () => {
      const data = makeSubmissionDetail({
        malpractice_events: [makeMalpracticeEvent()],
      });
      renderComponent(data);
      goToMalpracticeTab();
      expect(screen.getByText(/showing 1 to 1 of 1 events/i)).toBeInTheDocument();
    });

    it("opens image preview modal when face image thumbnail is clicked", async () => {
      const data = makeSubmissionDetail({
        malpractice_events: [
          makeMalpracticeEvent({ face_image_url: "http://example.com/face.jpg" }),
        ],
      });
      renderComponent(data);
      goToMalpracticeTab();
      fireEvent.click(screen.getByAltText("Face capture").closest("button")!);
      await waitFor(() =>
        expect(screen.getByText(/face capture/i)).toBeInTheDocument()
      );
    });

    it("paginates when more than 8 malpractice events exist", () => {
      const events: MalpracticeEvent[] = Array.from({ length: 10 }, (_, i) =>
        makeMalpracticeEvent({ timestamp: `2024-06-01T10:0${i < 9 ? "0" : "1"}:0${i}Z` })
      );
      const data = makeSubmissionDetail({ malpractice_events: events });
      renderComponent(data);
      goToMalpracticeTab();
      // Footer shows pagination
      expect(screen.getByRole("button", { name: /next page/i })).toBeInTheDocument();
    });

    it("navigates to next page when next button is clicked", () => {
      const events: MalpracticeEvent[] = Array.from({ length: 10 }, (_, i) =>
        makeMalpracticeEvent({ timestamp: `2024-06-01T10:0${i < 9 ? "0" : "1"}:0${i}Z` })
      );
      const data = makeSubmissionDetail({ malpractice_events: events });
      renderComponent(data);
      goToMalpracticeTab();
      // Initially shows events 1-8
      expect(screen.getByText(/showing 1 to 8 of 10/i)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /next page/i }));
      expect(screen.getByText(/showing 9 to 10 of 10/i)).toBeInTheDocument();
    });
  });

  // ── Screenshots tab ─────────────────────────────────────────────────────

  describe("Screenshots tab", () => {
    function goToScreenshotsTab() {
      fireEvent.click(screen.getByRole("tab", { name: /screenshots/i }));
    }

    it("shows empty placeholder when no screenshots", () => {
      renderComponent(makeSubmissionDetail({ screenshots: [] }));
      goToScreenshotsTab();
      expect(screen.getByText(/no screenshots captured/i)).toBeInTheDocument();
    });

    it("renders screenshot images", () => {
      const data = makeSubmissionDetail({
        screenshots: [
          { url: "http://example.com/shot1.jpg", round: 1, taken_at: "2024-06-01T10:05:00Z" },
        ],
      });
      renderComponent(data);
      goToScreenshotsTab();
      expect(screen.getByAltText("Screenshot from Round 1")).toBeInTheDocument();
    });

    it("renders round caption for each screenshot", () => {
      const data = makeSubmissionDetail({
        screenshots: [
          { url: "http://example.com/shot1.jpg", round: 2, taken_at: "2024-06-01T10:05:00Z" },
        ],
      });
      renderComponent(data);
      goToScreenshotsTab();
      expect(screen.getByText("Round 2")).toBeInTheDocument();
    });

    it("opens preview modal when screenshot is clicked", async () => {
      const data = makeSubmissionDetail({
        screenshots: [
          { url: "http://example.com/shot1.jpg", round: 1, taken_at: "2024-06-01T10:05:00Z" },
        ],
      });
      renderComponent(data);
      goToScreenshotsTab();
      fireEvent.click(screen.getByAltText("Screenshot from Round 1").closest("button")!);
      await waitFor(() =>
        expect(screen.getAllByRole("dialog").length).toBeGreaterThan(0)
      );
    });

    it("renders multiple screenshots", () => {
      const data = makeSubmissionDetail({
        screenshots: [
          { url: "http://example.com/shot1.jpg", round: 1, taken_at: "2024-06-01T10:05:00Z" },
          { url: "http://example.com/shot2.jpg", round: 1, taken_at: "2024-06-01T10:10:00Z" },
          { url: "http://example.com/shot3.jpg", round: 2, taken_at: "2024-06-01T10:15:00Z" },
        ],
      });
      renderComponent(data);
      goToScreenshotsTab();
      expect(screen.getAllByRole("figure").length).toBe(3);
    });
  });
});
