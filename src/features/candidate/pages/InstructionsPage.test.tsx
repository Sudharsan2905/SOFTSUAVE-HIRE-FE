import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import InstructionsPage from "./InstructionsPage";
import { renderWithProviders } from "@/test/utils";
import { makeCandidateUser, makeAuthState } from "@/test/mocks";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/features/candidate/components/CandidateHeader", () => ({
  default: ({ candidateName }: { candidateName?: string }) => (
    <div data-testid="candidate-header">{candidateName}</div>
  ),
}));

vi.mock("@/features/candidate/services/screenCaptureStore", () => ({
  storeMonitoringStreams: vi.fn(),
}));

vi.mock("@/utils/assessmentSession", () => ({
  markAssessmentDone: vi.fn(),
  saveSubmissionId: vi.fn(),
}));

const mockStartSession = vi.fn();
vi.mock("@/features/candidate/context/InterviewSessionContext", () => ({
  useInterviewSession: () => ({
    networkStatus: "connected",
    isOnline: true,
    sessionSubmissionId: null,
    startSession: mockStartSession,
    registerCallbacks: vi.fn(),
  }),
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ shareLink: "abc123" }),
  };
});

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

function makeAssessment(overrides: object = {}) {
  return {
    id: "a1",
    name: "Test Assessment",
    description: "A test assessment",
    accessibility: "public",
    rounds: [{ round_number: 1, question_count: 10, max_duration_minutes: 30 }],
    monitoring_config: {
      tab_monitoring: false,
      video_monitoring: false,
      audio_monitoring: false,
      screenshot_enabled: false,
    },
    ...overrides,
  };
}

const candidateUser = makeCandidateUser();

const renderPage = () =>
  renderWithProviders(<InstructionsPage />, {
    preloadedState: {
      auth: makeAuthState({ user: candidateUser, isAuthenticated: true }),
    },
  });

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockNavigate.mockReset();
  mockStartSession.mockReset();
});

describe("InstructionsPage", () => {
  it("shows loading spinner initially", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it("shows not found message when API fails", async () => {
    mockGet.mockRejectedValue(new Error("not found"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/assessment not found|link is invalid/i)).toBeInTheDocument()
    );
  });

  it("renders assessment name after load", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    renderPage();
    await waitFor(() => expect(screen.getByText("Test Assessment")).toBeInTheDocument());
  });

  it("renders assessment description", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    renderPage();
    await waitFor(() => expect(screen.getByText("A test assessment")).toBeInTheDocument());
  });

  it("renders round details", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/round 1/i)).toBeInTheDocument());
    expect(screen.getByText("10 questions")).toBeInTheDocument();
  });

  it("renders CandidateHeader with candidate name", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("candidate-header")).toBeInTheDocument());
    const fullName = [candidateUser.first_name, candidateUser.last_name].filter(Boolean).join(" ");
    expect(screen.getByTestId("candidate-header")).toHaveTextContent(fullName);
  });

  it("renders Start Assessment button when connected and no monitoring", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start assessment/i })).toBeInTheDocument()
    );
  });

  it("starts assessment and navigates on success", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    mockPost.mockResolvedValue({ data: { data: { id: "sub-1" } } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /start assessment/i })).toBeInTheDocument()
    );
    const startBtn = screen.getByRole("button", { name: /start assessment/i });
    startBtn.click();
    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());
  });

  it("shows monitoring mode label for monitored assessments", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: makeAssessment({
          accessibility: "monitoring",
          monitoring_config: { tab_monitoring: true, video_monitoring: false, audio_monitoring: false, screenshot_enabled: false },
        }),
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/monitored/i)).toBeInTheDocument());
  });

  it("shows general instructions list", async () => {
    mockGet.mockResolvedValue({ data: { data: makeAssessment() } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/general instructions/i)).toBeInTheDocument()
    );
    expect(screen.getByText(/stable internet connection/i)).toBeInTheDocument();
  });
});
