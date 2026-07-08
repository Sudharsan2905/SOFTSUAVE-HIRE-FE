import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { makeAuthState, makeCandidateUser } from "@/test/mocks";

// ─── Hoisted configurable mock state ────────────────────────────────────────
const PHASES = vi.hoisted(() => ({
  IDLE: 0,
  VALIDATING_NETWORK: 1,
  VALIDATING_DEVTOOLS: 2,
  VALIDATING_VIDEO: 3,
  VALIDATING_AUDIO: 4,
  VALIDATING_SCREEN_SHARE: 5,
  VALIDATING_FULLSCREEN: 6,
  ACTIVE: 7,
  SUSPENDED: 8,
  TERMINATED: 9,
}));

const h = vi.hoisted(() => {
  return {
    orchestrator: {
      phase: 7, // ACTIVE
      phaseLabel: "Exam Active",
      phaseError: null as string | null,
      examActiveRef: { current: true },
      isPermissionFlowActiveRef: { current: false },
      shouldAcquireCamera: true,
      shouldAcquireAudio: true,
      shouldAcquireScreen: true,
      shouldEnforceFullscreen: true,
      setPhaseError: vi.fn(),
      markPermissionFlowStart: vi.fn(),
      markPermissionFlowEnd: vi.fn(),
      suspend: vi.fn(),
      resume: vi.fn(),
      terminate: vi.fn(),
    },
    session: {
      networkStatus: "connected" as string,
      sessionSubmissionId: "sub-1",
      startSession: vi.fn(),
      registerCallbacks: vi.fn(),
    },
    timer: {
      setTimeLeft: vi.fn(),
      timeLeftRef: { current: 600 },
      isLowTime: false,
      formattedTime: { hh: "00", mm: "10", ss: "00" },
    },
    answerSync: {
      setAnswer: vi.fn(),
      flushPending: vi.fn(),
    },
    screenCapture: {
      captureFrame: vi.fn(async () => null),
      isCapturing: true,
      isInitialized: true,
      startScreenCapture: vi.fn(async () => true),
      stopScreenCapture: vi.fn(),
      streamRef: { current: null },
    },
    fullscreen: {
      requestFullscreen: vi.fn(async () => undefined),
    },
  };
});

// ─── Mock custom hooks ──────────────────────────────────────────────────────
vi.mock("@/features/candidate/hooks/useExamOrchestrator", () => ({
  ExamPhase: PHASES,
  useExamOrchestrator: () => h.orchestrator,
}));

vi.mock("@/features/candidate/context/InterviewSessionContext", () => ({
  useInterviewSession: () => h.session,
}));

vi.mock("@/features/candidate/hooks/useRoundTimer", () => ({
  useRoundTimer: () => h.timer,
}));

vi.mock("@/features/candidate/hooks/useAnswerSync", () => ({
  useAnswerSync: () => h.answerSync,
}));

vi.mock("@/features/candidate/hooks/useScreenCapture", () => ({
  useScreenCapture: () => h.screenCapture,
}));

vi.mock("@/features/candidate/hooks/useFullscreenEnforcement", () => ({
  useFullscreenEnforcement: () => h.fullscreen,
}));

vi.mock("@/features/candidate/hooks/useLiveKit", () => ({
  useLiveKitPublisher: () => ({
    isPublishing: false,
    startPublishing: vi.fn(async () => undefined),
  }),
}));

vi.mock("@/features/candidate/hooks/useMalpracticeCoordinator", () => ({
  useMalpracticeCoordinator: () => ({ flagViolation: vi.fn(async () => undefined) }),
}));

vi.mock("@/features/candidate/hooks/useTabMonitoring", () => ({ useTabMonitoring: vi.fn() }));
vi.mock("@/features/candidate/hooks/useAudioMonitoring", () => ({ useAudioMonitoring: vi.fn() }));
vi.mock("@/features/candidate/hooks/useVideoMonitoring", () => ({ useVideoMonitoring: vi.fn() }));
vi.mock("@/features/candidate/hooks/useScreenMonitoring", () => ({ useScreenMonitoring: vi.fn() }));
vi.mock("@/features/candidate/hooks/useDevtoolsMonitoring", () => ({
  useDevtoolsMonitoring: vi.fn(),
}));

// ─── Mock child components ──────────────────────────────────────────────────
vi.mock("@/features/candidate/components/ExamSetupScreen", () => ({
  ExamSetupScreen: (props: Record<string, unknown>) => (
    <div data-testid="exam-setup-screen">
      <span>{String(props.phaseLabel)}</span>
      <button onClick={props.onShareScreen as () => void}>setup-share-screen</button>
      <button onClick={props.onRequestFullscreen as () => void}>setup-fullscreen</button>
      <button onClick={props.onRetryCamera as () => void}>setup-retry-camera</button>
      <button onClick={props.onRetryAudio as () => void}>setup-retry-audio</button>
    </div>
  ),
}));

vi.mock("@/features/candidate/components/CandidateHeader", () => ({
  default: (props: { candidateName?: string }) => (
    <div data-testid="candidate-header">{props.candidateName}</div>
  ),
}));

vi.mock("@/features/candidate/components/VideoMonitor", () => ({
  VideoMonitor: (props: { onWarning?: () => void }) => (
    <button data-testid="video-monitor" onClick={props.onWarning}>
      video-monitor
    </button>
  ),
}));

vi.mock("@/features/candidate/components/AudioMonitor", () => ({
  AudioMonitor: () => <div data-testid="audio-monitor" />,
}));

vi.mock("@/features/candidate/components/ConnectionLostOverlay", () => ({
  ConnectionLostOverlay: (props: { status: string }) => (
    <div data-testid="connection-overlay">{props.status}</div>
  ),
}));

vi.mock("@/features/candidate/components/MalpracticeWarningModal", () => ({
  MalpracticeWarningModal: () => <div data-testid="malpractice-modal" />,
}));

// ─── Mock UI primitives ─────────────────────────────────────────────────────
vi.mock("@/components/ui/RichText", () => ({
  RichText: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/Spinner", () => ({
  Spinner: () => <div data-testid="spinner" />,
}));

vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    isLoading?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    isOpen,
    title,
    children,
    footer,
  }: {
    isOpen: boolean;
    title?: string;
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) =>
    isOpen ? (
      <div data-testid="modal" role="dialog" aria-label={title}>
        <h2>{title}</h2>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    ) : null,
}));

// ─── Mock api / toast / utils ───────────────────────────────────────────────
vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
  },
  extractApiErrorMessage: (_e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/utils/assessmentSession", () => ({
  markAssessmentDone: vi.fn(),
}));

vi.mock("@/features/candidate/services/screenCaptureStore", () => ({
  takeCameraStream: vi.fn(() => null),
}));

// ─── Router mocks ───────────────────────────────────────────────────────────
const mockNavigate = vi.fn();
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ shareLink: "abc", submissionId: "sub-1" })));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: mockUseParams,
  };
});

// ─── Imports after mocks ────────────────────────────────────────────────────
import InterviewPage from "./InterviewPage";
import { api } from "@/utils/api";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

// ─── Round data fixtures ────────────────────────────────────────────────────
const ROUND_DATA = {
  round_number: 1,
  max_duration_minutes: 30,
  questions: [
    {
      id: "q1",
      text: "What is 2+2?",
      type: "mcq_single",
      options: [{ text: "3" }, { text: "4" }],
    },
    {
      id: "q2",
      text: "Pick all primes",
      type: "mcq_multiple",
      options: [{ text: "2" }, { text: "3" }, { text: "4" }],
    },
    {
      id: "q3",
      text: "Explain closures",
      type: "essay",
    },
  ],
};

const ASSESSMENT_DATA = {
  rounds: [
    {
      round_number: 1,
      question_count: 3,
      max_duration_minutes: 30,
      question_ids: ["q1", "q2", "q3"],
    },
    { round_number: 2, question_count: 2, max_duration_minutes: 20, question_ids: ["q4", "q5"] },
  ],
};

function mockSuccessfulLoad(roundOverride?: Record<string, unknown>) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes("/round")) {
      return Promise.resolve({
        data: {
          data: {
            round: ROUND_DATA,
            tab_monitoring: true,
            video_monitoring: true,
            audio_monitoring: true,
            screenshot_enabled: true,
            screenshot_interval_seconds: 30,
            remaining_seconds: 600,
            current_question_idx: 0,
            ...roundOverride,
          },
        },
      });
    }
    if (url.includes("/assessment/")) {
      return Promise.resolve({ data: { data: ASSESSMENT_DATA } });
    }
    return Promise.resolve({ data: { data: {} } });
  });
}

const candidatePreloaded = {
  auth: makeAuthState({
    user: makeCandidateUser({ first_name: "John", last_name: "Doe" }),
    isAuthenticated: true,
  }),
};

function renderPage() {
  return renderWithProviders(<InterviewPage />, { preloadedState: candidatePreloaded });
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom lacks the Fullscreen API
  document.documentElement.requestFullscreen = vi.fn(async () => undefined);
  document.exitFullscreen = vi.fn(async () => undefined);
  // reset configurable mock state to ACTIVE defaults
  h.orchestrator.phase = PHASES.ACTIVE;
  h.orchestrator.phaseError = null;
  h.orchestrator.examActiveRef.current = true;
  h.session.networkStatus = "connected";
  h.timer.isLowTime = false;
  h.screenCapture.isCapturing = true;
  mockPost.mockResolvedValue({ data: { data: {} } });
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("InterviewPage - loading", () => {
  it("shows spinner while loading", () => {
    // api.get never resolves -> stays loading
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
  });
});

describe("InterviewPage - setup phase", () => {
  it("renders ExamSetupScreen when phase < ACTIVE", async () => {
    h.orchestrator.phase = PHASES.VALIDATING_VIDEO;
    h.orchestrator.phaseLabel = "Requesting camera access…";
    mockSuccessfulLoad();
    renderPage();
    expect(await screen.findByTestId("exam-setup-screen")).toBeInTheDocument();
  });

  it("invokes setup screen callbacks without crashing", async () => {
    h.orchestrator.phase = PHASES.VALIDATING_SCREEN_SHARE;
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("exam-setup-screen");
    await user.click(screen.getByText("setup-share-screen"));
    await user.click(screen.getByText("setup-retry-camera"));
    await user.click(screen.getByText("setup-retry-audio"));
    await user.click(screen.getByText("setup-fullscreen"));
    expect(h.orchestrator.markPermissionFlowStart).toHaveBeenCalled();
  });
});

describe("InterviewPage - active exam UI", () => {
  it("renders question UI when ACTIVE", async () => {
    mockSuccessfulLoad();
    renderPage();
    expect(await screen.findByText("What is 2+2?")).toBeInTheDocument();
    expect(screen.getByTestId("candidate-header")).toHaveTextContent("John Doe");
    expect(screen.getByText("Single Choice")).toBeInTheDocument();
    expect(screen.getByText(/Round 1 of 2/)).toBeInTheDocument();
  });

  it("renders network banner label for connected", async () => {
    mockSuccessfulLoad();
    renderPage();
    expect(await screen.findByText("Network Stable")).toBeInTheDocument();
  });

  it("renders Reconnecting label when reconnecting", async () => {
    h.session.networkStatus = "reconnecting";
    mockSuccessfulLoad();
    renderPage();
    expect(await screen.findByText("Reconnecting…")).toBeInTheDocument();
  });

  it("renders Session Paused label when on_hold", async () => {
    h.session.networkStatus = "on_hold";
    mockSuccessfulLoad();
    renderPage();
    expect(await screen.findByText("Session Paused")).toBeInTheDocument();
  });

  it("shows empty state when no questions", async () => {
    mockSuccessfulLoad({ round: { ...ROUND_DATA, questions: [] } });
    renderPage();
    expect(await screen.findByText(/No questions found/)).toBeInTheDocument();
  });
});

describe("InterviewPage - navigation", () => {
  it("navigates to next question and back", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");

    await user.click(screen.getByText("Next"));
    expect(await screen.findByText("Pick all primes")).toBeInTheDocument();
    expect(screen.getByText("Multiple Choice")).toBeInTheDocument();

    await user.click(screen.getByText("Previous"));
    expect(await screen.findByText("What is 2+2?")).toBeInTheDocument();
  });

  it("jumps to a question via the question grid buttons", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");

    // grid button "3" jumps to essay question
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(await screen.findByText("Explain closures")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Write your answer here...")).toBeInTheDocument();
  });

  it("shows Submit Round button on last question", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");
    await user.click(screen.getByRole("button", { name: "3" }));
    expect(await screen.findByText("Submit Round")).toBeInTheDocument();
  });
});

describe("InterviewPage - answering", () => {
  it("selects an MCQ single option and syncs answer", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");

    const radios = screen.getAllByRole("radio");
    await user.click(radios[1]); // "4"
    expect(h.answerSync.setAnswer).toHaveBeenCalledWith("q1", "4");
    expect((radios[1] as HTMLInputElement).checked).toBe(true);
  });

  it("selects MCQ multiple options", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");
    await user.click(screen.getByText("Next"));
    await screen.findByText("Pick all primes");

    const checks = screen.getAllByRole("checkbox");
    await user.click(checks[0]);
    expect(h.answerSync.setAnswer).toHaveBeenCalledWith("q2", ["2"]);
    await user.click(checks[1]);
    expect(h.answerSync.setAnswer).toHaveBeenLastCalledWith("q2", ["2", "3"]);
    // deselect
    await user.click(checks[0]);
    expect(h.answerSync.setAnswer).toHaveBeenLastCalledWith("q2", ["3"]);
  });

  it("types into essay answer", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");
    await user.click(screen.getByRole("button", { name: "3" }));

    const textarea = await screen.findByPlaceholderText("Write your answer here...");
    await user.type(textarea, "Hi");
    expect(h.answerSync.setAnswer).toHaveBeenCalledWith("q3", expect.any(String));
    expect(screen.getByText(/characters/)).toBeInTheDocument();
  });
});

describe("InterviewPage - submit flow", () => {
  it("opens submit confirm modal and confirms -> calls finish-round api", async () => {
    mockSuccessfulLoad();
    mockPost.mockResolvedValue({ data: { data: { completed: true } } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");

    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByText("Submit Round"));

    // modal opens
    expect(await screen.findByRole("dialog", { name: "Submit Round?" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(expect.stringContaining("/finish-round"))
    );
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/completed"),
        expect.anything()
      )
    );
  });

  it("Review Answers closes the submit modal", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");
    await user.click(screen.getByRole("button", { name: "3" }));
    await user.click(screen.getByText("Submit Round"));
    expect(await screen.findByRole("dialog", { name: "Submit Round?" })).toBeInTheDocument();
    await user.click(screen.getByText("Review Answers"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Submit Round?" })).not.toBeInTheDocument()
    );
  });
});

describe("InterviewPage - monitoring badges", () => {
  it("renders camera/mic/screen badges from monitoring config", async () => {
    mockSuccessfulLoad();
    renderPage();
    await screen.findByText("What is 2+2?");
    expect(screen.getByText("Camera Active")).toBeInTheDocument();
    expect(screen.getByText("Mic Active")).toBeInTheDocument();
    expect(screen.getByText("Screen Capture Active")).toBeInTheDocument();
  });

  it("renders inactive screen capture badge when not capturing", async () => {
    h.screenCapture.isCapturing = false;
    mockSuccessfulLoad();
    renderPage();
    await screen.findByText("What is 2+2?");
    expect(screen.getByText("Screen Capture Inactive")).toBeInTheDocument();
  });

  it("invokes VideoMonitor onWarning callback", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");
    // Should not throw
    await user.click(screen.getByTestId("video-monitor"));
    expect(screen.getByTestId("video-monitor")).toBeInTheDocument();
  });
});

describe("InterviewPage - sidebar", () => {
  it("toggles the left sidebar panel", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");
    await user.click(screen.getByLabelText("Toggle progress panel"));
    expect(screen.getByText("Assessment Progress")).toBeInTheDocument();
  });

  it("renders round cards with status pills", async () => {
    mockSuccessfulLoad();
    renderPage();
    await screen.findByText("What is 2+2?");
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });
});

describe("InterviewPage - admin callbacks", () => {
  it("shows admin warning modal when onAdminWarning fires", async () => {
    mockSuccessfulLoad();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("What is 2+2?");

    // grab the callbacks registered with the session
    const calls = h.session.registerCallbacks.mock.calls;
    const cb = calls.at(-1)![0] as {
      onAdminWarning: (m: string) => void;
    };
    act(() => cb.onAdminWarning("Please focus on the screen"));

    expect(await screen.findByText("Please focus on the screen")).toBeInTheDocument();
    // acknowledge dismisses
    await user.click(screen.getByText("Acknowledge"));
    await waitFor(() =>
      expect(screen.queryByText("Please focus on the screen")).not.toBeInTheDocument()
    );
  });

  it("renders paused indicator when network not connected while active", async () => {
    h.session.networkStatus = "on_hold";
    mockSuccessfulLoad();
    renderPage();
    await screen.findByText("What is 2+2?");
    expect(screen.getByText("(paused)")).toBeInTheDocument();
  });
});

describe("InterviewPage - load error", () => {
  it("navigates to completed on 403", async () => {
    mockGet.mockRejectedValue({ response: { status: 403 } });
    renderPage();
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(
        expect.stringContaining("/completed"),
        expect.anything()
      )
    );
  });
});

describe("InterviewPage - guards", () => {
  it("returns null (no spinner, no UI) when round data missing", async () => {
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/round")) {
        return Promise.resolve({ data: { data: { round: null } } });
      }
      return Promise.resolve({ data: { data: ASSESSMENT_DATA } });
    });
    const { container } = renderPage();
    await waitFor(() => expect(screen.queryByTestId("spinner")).not.toBeInTheDocument());
    expect(container.querySelector('[data-testid="candidate-header"]')).toBeNull();
  });
});
