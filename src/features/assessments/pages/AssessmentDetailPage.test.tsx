import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import AssessmentDetailPage from "./AssessmentDetailPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState } from "@/test/mocks";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("write-excel-file/browser", () => ({
  // writeXlsxFile(rows, opts).toFile(name) — synchronous return, async toFile
  default: vi.fn().mockReturnValue({ toFile: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="header">
      <span data-testid="header-title">{title}</span>
      <div data-testid="header-actions">{actions}</div>
    </div>
  ),
}));

vi.mock("@/components/shared/FilterBar", () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock("@/features/assessments/components/ShareWizard/ShareWizardModal", () => ({
  ShareWizardModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="share-wizard">
        <button data-testid="close-share-wizard" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ workspaceId: "ws-1", id: "assess-1" }),
  };
});

import { api } from "@/utils/api";
import writeXlsxFile from "write-excel-file/browser";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockWriteXlsxFile = writeXlsxFile as unknown as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

function makeSubmissionsResponse(submissions: object[] = []) {
  return {
    data: {
      data: {
        submissions,
        pagination: { page: 1, page_size: 10, total: submissions.length, total_pages: 1 },
        assessment_name: "My Assessment",
      },
    },
  };
}

function makeSubmissionsResponseWithPagination(
  submissions: object[] = [],
  pagination: object = {}
) {
  return {
    data: {
      data: {
        submissions,
        pagination: {
          page: 1,
          page_size: 10,
          total: submissions.length,
          total_pages: 1,
          has_prev: false,
          has_next: false,
          ...pagination,
        },
        assessment_name: "My Assessment",
      },
    },
  };
}

function makeAssessmentResponse() {
  return {
    data: {
      data: {
        id: "assess-1",
        name: "My Assessment",
        rounds: [{ id: "r1" }, { id: "r2" }],
        share_link: "https://share.example.com/assess-1",
        workspace_id: "ws-1",
      },
    },
  };
}

function makeSingleSubmission(overrides: object = {}) {
  return {
    id: "sub-1",
    status: "completed",
    score_percentage: 85.5,
    current_round: 1,
    malpractice_count: 0,
    started_at: "2024-01-01T10:00:00Z",
    candidate: {
      id: "c1",
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@example.com",
    },
    ...overrides,
  };
}

const renderPage = () =>
  renderWithProviders(<AssessmentDetailPage />, {
    preloadedState: {
      auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
    },
  });

beforeEach(() => {
  mockGet.mockReset();
  mockNavigate.mockReset();
  mockToastError.mockReset();
  // Restore default writeXlsxFile behaviour so non-export tests aren't affected
  mockWriteXlsxFile.mockReturnValue({ toFile: vi.fn().mockResolvedValue(undefined) });
});

describe("AssessmentDetailPage", () => {
  // -------------------------------------------------------------------------
  // Existing tests
  // -------------------------------------------------------------------------
  it("shows loading spinner initially", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no submissions", async () => {
    mockGet.mockResolvedValue(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() => expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument());
  });

  it("renders submissions table rows", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([makeSingleSubmission()]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("handles API error and shows empty state", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument());
  });

  it("renders the filter bar", async () => {
    mockGet.mockResolvedValue(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("filter-bar")).toBeInTheDocument());
  });

  it("fetches assessment detail on mount", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalled());
    const calls = mockGet.mock.calls.map((c) => c[0] as string);
    expect(calls.some((url) => url.includes("assess-1"))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // New tests — Back button navigation
  // -------------------------------------------------------------------------
  it("back button navigates to the assessments list", async () => {
    mockGet.mockResolvedValue(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("filter-bar")).toBeInTheDocument());
    const backBtn = screen.getByRole("button", { name: /back to assessments/i });
    fireEvent.click(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith("/workspaces/ws-1/assessments");
  });

  // -------------------------------------------------------------------------
  // Assessment name in header
  // -------------------------------------------------------------------------
  it("shows assessment name from submissions API in header", async () => {
    mockGet.mockResolvedValue(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("header-title")).toHaveTextContent("My Assessment")
    );
  });

  // -------------------------------------------------------------------------
  // Score percentage display
  // -------------------------------------------------------------------------
  it("shows score percentage for a submission with score_percentage=85.5", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(
        makeSubmissionsResponse([makeSingleSubmission({ score_percentage: 85.5 })])
      );
    renderPage();
    await waitFor(() => expect(screen.getByText("85.5%")).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Status badge
  // -------------------------------------------------------------------------
  it("shows 'Completed' status badge for a completed submission", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(
        makeSubmissionsResponse([makeSingleSubmission({ status: "completed" })])
      );
    renderPage();
    await waitFor(() => expect(screen.getByText("Completed")).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Malpractice count
  // -------------------------------------------------------------------------
  it("displays malpractice count in the table", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(
        makeSubmissionsResponse([makeSingleSubmission({ malpractice_count: 2 })])
      );
    renderPage();
    await waitFor(() => expect(screen.getByText("2 / 3")).toBeInTheDocument());
  });

  it("displays zero malpractice count when not provided", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(
        makeSubmissionsResponse([makeSingleSubmission({ malpractice_count: null })])
      );
    renderPage();
    await waitFor(() => expect(screen.getByText("0 / 3")).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Share button opens ShareWizardModal
  // -------------------------------------------------------------------------
  it("share button opens ShareWizardModal after assessment loads", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([]));
    renderPage();
    // Wait for assessment to be fetched so Share button becomes enabled
    await waitFor(() => expect(screen.queryByTestId("share-wizard")).not.toBeInTheDocument());
    const shareBtn = screen.getByRole("button", { name: /share/i });
    expect(shareBtn).not.toBeDisabled();
    fireEvent.click(shareBtn);
    await waitFor(() => expect(screen.getByTestId("share-wizard")).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // ShareWizardModal closes via onClose
  // -------------------------------------------------------------------------
  it("ShareWizardModal closes when its onClose callback is called", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    // Open modal
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    await waitFor(() => expect(screen.getByTestId("share-wizard")).toBeInTheDocument());
    // Close modal via onClose
    fireEvent.click(screen.getByTestId("close-share-wizard"));
    await waitFor(() => expect(screen.queryByTestId("share-wizard")).not.toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Multiple submissions render
  // -------------------------------------------------------------------------
  it("renders 3 rows when 3 submissions are returned", async () => {
    const subs = [
      makeSingleSubmission({
        id: "sub-1",
        candidate: { id: "c1", first_name: "Alice", last_name: "A", email: "a@x.com" },
      }),
      makeSingleSubmission({
        id: "sub-2",
        candidate: { id: "c2", first_name: "Bob", last_name: "B", email: "b@x.com" },
      }),
      makeSingleSubmission({
        id: "sub-3",
        candidate: { id: "c3", first_name: "Carol", last_name: "C", email: "c@x.com" },
      }),
    ];
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse(subs));
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice A")).toBeInTheDocument());
    expect(screen.getByText("Bob B")).toBeInTheDocument();
    expect(screen.getByText("Carol C")).toBeInTheDocument();
    // 3 data rows in tbody
    const rows = screen.getAllByRole("row");
    // 1 thead row + 3 tbody rows
    expect(rows.length).toBeGreaterThanOrEqual(4);
  });

  // -------------------------------------------------------------------------
  // Download / Export button exists
  // -------------------------------------------------------------------------
  it("renders an Export button in the header", async () => {
    mockGet.mockResolvedValue(makeSubmissionsResponse([]));
    renderPage();
    await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
    const exportBtn = screen.getByRole("button", { name: /export/i });
    expect(exportBtn).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Submission row action — navigate to candidate detail
  // -------------------------------------------------------------------------
  it("clicking the candidate details action navigates to candidate detail page", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([makeSingleSubmission()]));
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    const detailBtn = screen.getByRole("button", { name: /view candidate details/i });
    fireEvent.click(detailBtn);
    expect(mockNavigate).toHaveBeenCalledWith(
      "/workspaces/ws-1/assessments/assess-1/candidates/c1"
    );
  });

  // -------------------------------------------------------------------------
  // Submission without score shows fallback dash
  // -------------------------------------------------------------------------
  it("shows '—' when submission has no score_percentage", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(
        makeSubmissionsResponse([makeSingleSubmission({ score_percentage: null })])
      );
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    // The em-dash character rendered when pct is null
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Pagination renders with correct total
  // -------------------------------------------------------------------------
  it("renders pagination component when submissions exist", async () => {
    mockGet.mockResolvedValueOnce(makeAssessmentResponse()).mockResolvedValueOnce(
      makeSubmissionsResponseWithPagination([makeSingleSubmission()], {
        page: 1,
        page_size: 10,
        total: 1,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      })
    );
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    // Pagination renders Prev/Next nav buttons
    expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // Header subtitle shows submission count
  // -------------------------------------------------------------------------
  it("share button is disabled while assessment is loading", () => {
    // Simulate assessment API never resolving so assessment stays null
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Share button should be disabled because assessment is null
    const shareBtn = screen.getByRole("button", { name: /share/i });
    expect(shareBtn).toBeDisabled();
  });

  // -------------------------------------------------------------------------
  // "In Progress" status badge label
  // -------------------------------------------------------------------------
  it("shows 'In Progress' status badge for an in_progress submission", async () => {
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(
        makeSubmissionsResponse([makeSingleSubmission({ status: "in_progress" })])
      );
    renderPage();
    await waitFor(() => expect(screen.getByText("In Progress")).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Round display includes maxRounds when assessment is loaded
  // -------------------------------------------------------------------------
  it("shows current_round / total_rounds when assessment has rounds", async () => {
    // assessment has 2 rounds
    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse()) // rounds: [{id:"r1"},{id:"r2"}]
      .mockResolvedValueOnce(makeSubmissionsResponse([makeSingleSubmission({ current_round: 1 })]));
    renderPage();
    await waitFor(() => expect(screen.getByText("1 / 2")).toBeInTheDocument());
  });

  // -------------------------------------------------------------------------
  // Export (Download) — success path
  // -------------------------------------------------------------------------
  it("calls writeXlsxFile and toFile when Export button is clicked", async () => {
    const toFileMock = vi.fn().mockResolvedValue(undefined);
    mockWriteXlsxFile.mockReturnValue({ toFile: toFileMock });

    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([]))
      // third call: export endpoint
      .mockResolvedValueOnce({
        data: {
          data: [
            {
              name: "Alice Smith",
              email: "alice@example.com",
              phone: "1234567890",
              percentage: 85.5,
              rounds_count: 2,
              completed_at: "2024-01-01T10:00:00Z",
            },
          ],
        },
      });

    renderPage();
    await waitFor(() => expect(screen.getByTestId("filter-bar")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => expect(toFileMock).toHaveBeenCalledWith("My Assessment_submissions.xlsx"));
  });

  // -------------------------------------------------------------------------
  // Export — error path shows toast
  // -------------------------------------------------------------------------
  it("shows error toast when export API call fails", async () => {
    const toFileMock = vi.fn().mockResolvedValue(undefined);
    mockWriteXlsxFile.mockReturnValue({ toFile: toFileMock });

    mockGet
      .mockResolvedValueOnce(makeAssessmentResponse())
      .mockResolvedValueOnce(makeSubmissionsResponse([]))
      // third call: export endpoint fails
      .mockRejectedValueOnce(new Error("Export failed"));

    renderPage();
    await waitFor(() => expect(screen.getByTestId("filter-bar")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /export/i }));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });
});
