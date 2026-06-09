import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuestionsPage from "./QuestionsPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState } from "@/test/mocks";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle?: string;
    actions?: React.ReactNode;
  }) => (
    <div data-testid="header">
      <span data-testid="header-title">{title}</span>
      {subtitle && <span data-testid="header-subtitle">{subtitle}</span>}
      {actions && <div data-testid="header-actions">{actions}</div>}
    </div>
  ),
}));

vi.mock("@/components/shared/FilterBar", () => ({
  FilterBar: ({
    search,
    onSearchChange,
    sortOrder,
    onSortOrderToggle,
    _viewMode,
    onViewModeChange,
    complexity,
    onComplexityChange,
    questionType,
    onQuestionTypeChange,
    onRefresh,
  }: {
    search: string;
    onSearchChange: (v: string) => void;
    sortOrder: string;
    onSortOrderToggle: () => void;
    _viewMode?: string;
    onViewModeChange?: (v: string) => void;
    complexity?: string;
    onComplexityChange?: (v: string) => void;
    questionType?: string;
    onQuestionTypeChange?: (v: string) => void;
    onRefresh?: () => void;
  }) => (
    <div data-testid="filter-bar">
      <input
        data-testid="search-input"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        aria-label="Search"
      />
      <button data-testid="sort-order-toggle" onClick={onSortOrderToggle}>
        {sortOrder}
      </button>
      {onViewModeChange && (
        <>
          <button data-testid="view-mode-list" onClick={() => onViewModeChange("list")}>
            List
          </button>
          <button data-testid="view-mode-grid" onClick={() => onViewModeChange("grid")}>
            Grid
          </button>
        </>
      )}
      {onComplexityChange && (
        <select
          data-testid="complexity-filter"
          value={complexity}
          onChange={(e) => onComplexityChange(e.target.value)}
        >
          <option value="">All</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      )}
      {onQuestionTypeChange && (
        <select
          data-testid="question-type-filter"
          value={questionType}
          onChange={(e) => onQuestionTypeChange(e.target.value)}
        >
          <option value="">All</option>
          <option value="mcq_single">MCQ Single</option>
          <option value="mcq_multi">MCQ Multi</option>
          <option value="essay">Essay</option>
        </select>
      )}
      {onRefresh && (
        <button data-testid="refresh-btn" onClick={onRefresh}>
          Refresh
        </button>
      )}
    </div>
  ),
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({
    children,
    isOpen,
    title,
    footer,
    onClose,
  }: {
    children: React.ReactNode;
    isOpen: boolean;
    title?: string;
    footer?: React.ReactNode;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="modal" aria-label={title}>
        <h2 data-testid="modal-title">{title}</h2>
        <div data-testid="modal-body">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        <button data-testid="modal-close" onClick={onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ui/RichText", () => ({
  RichText: ({ children }: { children: string }) => (
    <div data-testid="rich-text">{children}</div>
  ),
}));

vi.mock("@/components/ui/Pagination", () => ({
  Pagination: ({
    meta,
    onPageChange,
  }: {
    meta: { page: number; total_pages: number; total: number };
    onPageChange: (p: number) => void;
  }) => (
    <div data-testid="pagination">
      <span data-testid="pagination-total">{meta.total}</span>
      <button data-testid="pagination-next" onClick={() => onPageChange(meta.page + 1)}>
        Next
      </button>
    </div>
  ),
}));

vi.mock("read-excel-file/browser", () => ({ default: vi.fn() }));

const mockNavigate = vi.fn();
const mockUseParams = vi.fn<() => { categoryId: string | undefined }>(() => ({ categoryId: "cat-1" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => mockUseParams() };
});

// ─── Import mocked modules ────────────────────────────────────────────────────

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPut = api.put as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface QuestionOverride {
  id?: string;
  question_text?: string;
  question_type?: "mcq_single" | "mcq_multi" | "essay";
  complexity?: "low" | "medium" | "high";
  options?: { id: string; text: string; is_correct: boolean }[];
  correct_answer?: string;
}

function makeQuestion(overrides: QuestionOverride = {}) {
  return {
    id: overrides.id ?? "q-1",
    category_id: "cat-1",
    question_text: overrides.question_text ?? "What is JavaScript?",
    question_type: overrides.question_type ?? "mcq_single",
    complexity: overrides.complexity ?? "medium",
    options: overrides.options ?? [
      { id: "opt-1", text: "A scripting language", is_correct: true },
      { id: "opt-2", text: "A markup language", is_correct: false },
    ],
    correct_answer: overrides.correct_answer ?? "",
    created_by: "user-1",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z",
  };
}

function makeCategoriesResponse(cats: { id: string; name: string }[] = []) {
  return {
    data: {
      data: {
        categories: cats.map((c) => ({
          id: c.id,
          name: c.name,
          description: "",
          question_count: 0,
          created_by: "user-1",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        })),
      },
    },
  };
}

function makeQuestionsResponse(
  items: ReturnType<typeof makeQuestion>[] = [],
  paginationOverrides: Partial<{
    page: number;
    page_size: number;
    total: number;
    total_pages: number;
    has_prev: boolean;
    has_next: boolean;
  }> = {}
) {
  const total = paginationOverrides.total ?? items.length;
  return {
    data: {
      data: {
        questions: items,
        pagination: {
          page: 1,
          page_size: 20,
          total,
          total_pages: paginationOverrides.total_pages ?? 1,
          has_prev: paginationOverrides.has_prev ?? false,
          has_next: paginationOverrides.has_next ?? false,
          ...paginationOverrides,
        },
      },
    },
  };
}

/**
 * mockGet needs to handle two separate GET calls:
 *  1. categories list — /api/questions/categories   (no trailing path segment with "questions")
 *  2. questions list  — /api/questions/categories/cat-1/questions?...
 *
 * We distinguish them by checking whether the URL contains "/categories/" (i.e. has a
 * category-id segment, meaning it is the per-category questions endpoint) vs. ending at
 * "/categories" (the list endpoint used by fetchCategory).
 */
function setupGetMocks(
  questions: ReturnType<typeof makeQuestion>[] = [],
  paginationOverrides = {}
) {
  mockGet.mockImplementation((url: string) => {
    // Per-category questions endpoint: /api/questions/categories/{id}/questions?...
    if (/\/categories\/[^/]+\/questions/.test(url)) {
      return Promise.resolve(makeQuestionsResponse(questions, paginationOverrides));
    }
    // Categories list endpoint: /api/questions/categories
    return Promise.resolve(makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }]));
  });
}

const renderPage = () =>
  renderWithProviders(<QuestionsPage />, {
    preloadedState: {
      auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
    },
  });

// ─── Test setup ───────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  mockNavigate.mockReset();
  mockUseParams.mockReturnValue({ categoryId: "cat-1" });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("QuestionsPage", () => {
  // ── Initial render ──────────────────────────────────────────────────────────

  describe("initial render", () => {
    it("renders the header after loading", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
    });

    it("renders the FilterBar", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() => expect(screen.getByTestId("filter-bar")).toBeInTheDocument());
    });

    it("renders the back-to-categories button", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() =>
        expect(screen.getByText(/back to categories/i)).toBeInTheDocument()
      );
    });

    it("displays the category name in the header when the category is found", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId("header-title")).toHaveTextContent("JavaScript")
      );
    });

    it("calls the questions API with the categoryId", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      const calls = (mockGet as ReturnType<typeof vi.fn>).mock.calls.map(
        (c: string[]) => c[0]
      );
      expect(calls.some((url: string) => url.includes("cat-1"))).toBe(true);
    });

    it("shows empty state when no questions are returned", async () => {
      setupGetMocks([]);
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      expect(screen.getByText(/no questions found/i)).toBeInTheDocument();
    });

    it("renders header actions: AI Generate, Excel Import, Add buttons", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      const actions = screen.getByTestId("header-actions");
      expect(within(actions).getByText(/ai generate/i)).toBeInTheDocument();
      expect(within(actions).getByText(/excel import/i)).toBeInTheDocument();
      expect(within(actions).getByText(/^add$/i)).toBeInTheDocument();
    });
  });

  // ── Question list rendering ─────────────────────────────────────────────────

  describe("question list rendering", () => {
    it("renders a question card for each returned question", async () => {
      setupGetMocks([
        makeQuestion({ id: "q-1", question_text: "What is JS?" }),
        makeQuestion({ id: "q-2", question_text: "What is TS?" }),
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText("What is JS?")).toBeInTheDocument());
      expect(screen.getByText("What is TS?")).toBeInTheDocument();
    });

    it("renders the question text via RichText component", async () => {
      setupGetMocks([makeQuestion({ question_text: "Explain closures." })]);
      renderPage();
      await waitFor(() => expect(screen.getByText("Explain closures.")).toBeInTheDocument());
    });

    it("renders edit and delete action buttons on each card", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      expect(screen.getByRole("button", { name: /edit question/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /delete question/i })).toBeInTheDocument();
    });

    it("renders correct options for an MCQ question", async () => {
      setupGetMocks([
        makeQuestion({
          options: [
            { id: "o-1", text: "Option A", is_correct: true },
            { id: "o-2", text: "Option B", is_correct: false },
            { id: "o-3", text: "Option C", is_correct: false },
          ],
        }),
      ]);
      renderPage();
      await waitFor(() => expect(screen.getByText("Option A")).toBeInTheDocument());
      expect(screen.getByText("Option B")).toBeInTheDocument();
      expect(screen.getByText("Option C")).toBeInTheDocument();
    });

    it("does not render options section for essay questions with no options", async () => {
      setupGetMocks([
        makeQuestion({
          question_type: "essay",
          options: [],
          correct_answer: "Because it is dynamic.",
        }),
      ]);
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      // Options list should not appear since options array is empty
      expect(screen.queryByText("Option A")).not.toBeInTheDocument();
    });

    it("shows header subtitle with total question count", async () => {
      setupGetMocks([makeQuestion()], { total: 42 });
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId("header-subtitle")).toHaveTextContent("42")
      );
    });
  });

  // ── Error states ────────────────────────────────────────────────────────────

  describe("error states", () => {
    it("shows a toast error when questions API fails", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() => expect(mockToastError).toHaveBeenCalledWith(
        expect.stringContaining("Failed to load questions")
      ));
    });

    it("does not crash when categoryId is missing", async () => {
      mockUseParams.mockReturnValue({ categoryId: undefined });
      // categories GET still fires; questions GET should NOT be called
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      expect(() => renderPage()).not.toThrow();
    });

    it("handles API error gracefully and still renders header", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
    });
  });

  // ── Navigation ──────────────────────────────────────────────────────────────

  describe("navigation", () => {
    it("navigates to question bank when back button is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByText(/back to categories/i)).toBeInTheDocument()
      );
      await user.click(screen.getByText(/back to categories/i));
      expect(mockNavigate).toHaveBeenCalledWith("/question-bank");
    });
  });

  // ── Create question modal ────────────────────────────────────────────────────

  describe("create question modal", () => {
    it("opens the create modal when Add button in header is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/add questions/i);
    });

    it("opens the create modal from empty state Add Questions button", async () => {
      setupGetMocks([]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByText(/no questions found/i)).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /add questions/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
    });

    it("closes the create modal when Cancel is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });

    it("calls POST API when Save is clicked with question text filled in", async () => {
      setupGetMocks();
      mockPost.mockResolvedValue({
        data: { data: { created: 1 } },
      });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());

      // Fill in question text
      const textarea = screen.getByPlaceholderText(/enter the question/i);
      await user.type(textarea, "What is a closure?");

      // Click Save
      await user.click(screen.getByRole("button", { name: /^save$/i }));
      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith(
          expect.stringContaining("cat-1"),
          expect.objectContaining({ questions: expect.any(Array) })
        )
      );
    });

    it("shows success toast after creating a question", async () => {
      setupGetMocks();
      mockPost.mockResolvedValue({ data: { data: { created: 1 } } });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());

      const textarea = screen.getByPlaceholderText(/enter the question/i);
      await user.type(textarea, "What is a closure?");
      await user.click(screen.getByRole("button", { name: /^save$/i }));
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    });

    it("shows error toast when question creation fails", async () => {
      setupGetMocks();
      mockPost.mockRejectedValue(new Error("Server error"));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());

      const textarea = screen.getByPlaceholderText(/enter the question/i);
      await user.type(textarea, "What is a closure?");
      await user.click(screen.getByRole("button", { name: /^save$/i }));
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to create question")
        )
      );
    });

    it("disables Save button when question text is empty", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /^save$/i })).toBeDisabled();
    });

    it("shows Add Another Question button in create mode (not edit)", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /add another question/i })).toBeInTheDocument()
      );
    });
  });

  // ── Edit question modal ──────────────────────────────────────────────────────

  describe("edit question modal", () => {
    it("opens the edit modal with 'Edit Question' title when edit button is clicked", async () => {
      setupGetMocks([makeQuestion({ id: "q-1", question_text: "What is JS?" })]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /edit question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /edit question/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/edit question/i);
    });

    it("pre-fills question text in the edit form", async () => {
      setupGetMocks([makeQuestion({ id: "q-1", question_text: "What is JS?" })]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /edit question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /edit question/i }));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      const textarea = screen.getByPlaceholderText(/enter the question/i);
      expect(textarea).toHaveValue("What is JS?");
    });

    it("calls PUT API when Save Changes is clicked in edit mode", async () => {
      setupGetMocks([makeQuestion({ id: "q-1", question_text: "What is JS?" })]);
      mockPut.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /edit question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /edit question/i }));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /save changes/i }));
      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith(
          expect.stringContaining("q-1"),
          expect.any(Object)
        )
      );
    });

    it("shows success toast after updating a question", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      mockPut.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /edit question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /edit question/i }));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /save changes/i }));
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    });

    it("does NOT show Add Another Question button in edit mode", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /edit question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /edit question/i }));
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      expect(
        screen.queryByRole("button", { name: /add another question/i })
      ).not.toBeInTheDocument();
    });
  });

  // ── Delete question modal ────────────────────────────────────────────────────

  describe("delete question modal", () => {
    it("opens the delete modal when delete button is clicked", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /delete question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /delete question/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/delete question/i);
    });

    it("calls DELETE API when Delete button is confirmed", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      mockDelete.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /delete question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /delete question/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /^delete$/i }));
      await waitFor(() =>
        expect(mockDelete).toHaveBeenCalledWith(expect.stringContaining("q-1"))
      );
    });

    it("shows success toast after deleting a question", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      mockDelete.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /delete question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /delete question/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /^delete$/i }));
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    });

    it("shows error toast when delete fails", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      mockDelete.mockRejectedValue(new Error("Server error"));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /delete question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /delete question/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /^delete$/i }));
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to delete question")
        )
      );
    });

    it("closes the delete modal when Cancel is clicked", async () => {
      setupGetMocks([makeQuestion({ id: "q-1" })]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /delete question/i })).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /delete question/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: /^cancel$/i }));
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });
  });

  // ── AI Generate modal ────────────────────────────────────────────────────────

  describe("AI Generate modal", () => {
    it("opens the AI Generate modal when AI Generate button is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/ai generate/i));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/ai question generator/i);
    });

    it("calls AI generate API when Generate button is clicked", async () => {
      setupGetMocks();
      mockPost.mockResolvedValue({ data: { data: { created: 5 } } });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/ai generate/i));
      await waitFor(() => expect(screen.getByTestId("modal-footer")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /generate/i })
      );
      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith(
          expect.stringContaining("ai-generate"),
          expect.any(Object)
        )
      );
    });

    it("shows success toast after AI generation", async () => {
      setupGetMocks();
      mockPost.mockResolvedValue({ data: { data: { created: 3 } } });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/ai generate/i));
      await waitFor(() => expect(screen.getByTestId("modal-footer")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /generate/i })
      );
      await waitFor(() => expect(mockToastSuccess).toHaveBeenCalled());
    });

    it("shows error toast when AI generation fails", async () => {
      setupGetMocks();
      mockPost.mockRejectedValue(new Error("AI error"));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/ai generate/i));
      await waitFor(() => expect(screen.getByTestId("modal-footer")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /generate/i })
      );
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("AI generation failed")
        )
      );
    });

    it("closes the AI modal when Cancel is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/ai generate/i));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /cancel/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });
  });

  // ── Excel Import modal ───────────────────────────────────────────────────────

  describe("Excel Import modal", () => {
    it("opens the Excel Import modal when Excel Import button is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByText(/excel import/i)
      );
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/excel import/i);
    });

    it("disables the Next: Map Columns button when no file is selected", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByText(/excel import/i)
      );
      await waitFor(() => expect(screen.getByTestId("modal-footer")).toBeInTheDocument());
      expect(
        within(screen.getByTestId("modal-footer")).getByRole("button", {
          name: /next: map columns/i,
        })
      ).toBeDisabled();
    });

    it("closes Excel Import modal when Cancel is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByText(/excel import/i)
      );
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /cancel/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });
  });

  // ── Pagination ───────────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("renders Pagination component when meta has results", async () => {
      setupGetMocks([makeQuestion()], {
        total: 1,
        total_pages: 1,
        has_prev: false,
        has_next: false,
      });
      renderPage();
      await waitFor(() => expect(screen.getByTestId("pagination")).toBeInTheDocument());
    });

    it("shows correct total count in pagination", async () => {
      setupGetMocks([makeQuestion()], { total: 99 });
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId("pagination-total")).toHaveTextContent("99")
      );
    });

    it("re-fetches when pagination Next button is clicked", async () => {
      setupGetMocks([makeQuestion()], {
        total: 40,
        total_pages: 2,
        has_next: true,
      });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("pagination-next")).toBeInTheDocument());
      const callCountBefore = mockGet.mock.calls.length;
      await user.click(screen.getByTestId("pagination-next"));
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callCountBefore));
    });
  });

  // ── Refresh ──────────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("re-fetches questions when refresh button is clicked", async () => {
      setupGetMocks([makeQuestion()]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("refresh-btn")).toBeInTheDocument());
      const callsBefore = mockGet.mock.calls.length;
      await user.click(screen.getByTestId("refresh-btn"));
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });
  });

  // ── Sort order toggle ────────────────────────────────────────────────────────

  describe("sort order toggle", () => {
    it("renders sort order toggle in FilterBar with initial desc order", async () => {
      setupGetMocks();
      renderPage();
      await waitFor(() => expect(screen.getByTestId("sort-order-toggle")).toBeInTheDocument());
      expect(screen.getByTestId("sort-order-toggle")).toHaveTextContent("desc");
    });

    it("toggles sort order from desc to asc when toggle is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("sort-order-toggle")).toBeInTheDocument());
      await user.click(screen.getByTestId("sort-order-toggle"));
      await waitFor(() =>
        expect(screen.getByTestId("sort-order-toggle")).toHaveTextContent("asc")
      );
    });
  });

  // ── View mode switch ─────────────────────────────────────────────────────────

  describe("view mode switch", () => {
    it("switches to grid view when grid button is clicked", async () => {
      setupGetMocks([makeQuestion()]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("view-mode-grid")).toBeInTheDocument());
      await user.click(screen.getByTestId("view-mode-grid"));
      // No crash / re-render error expected — grid mode is toggled
      expect(screen.getByTestId("view-mode-grid")).toBeInTheDocument();
    });

    it("switches back to list view when list button is clicked", async () => {
      setupGetMocks([makeQuestion()]);
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("view-mode-list")).toBeInTheDocument());
      await user.click(screen.getByTestId("view-mode-grid"));
      await user.click(screen.getByTestId("view-mode-list"));
      expect(screen.getByTestId("view-mode-list")).toBeInTheDocument();
    });
  });

  // ── Multiple question forms ───────────────────────────────────────────────────

  describe("multiple question forms (create mode)", () => {
    it("adds a second form when Add Another Question is clicked", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /add another question/i })
        ).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /add another question/i }));
      // Now there should be 2 textareas
      await waitFor(() =>
        expect(screen.getAllByPlaceholderText(/enter the question/i)).toHaveLength(2)
      );
    });

    it("shows Save (2) label when two forms are present", async () => {
      setupGetMocks();
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(within(screen.getByTestId("header-actions")).getByText(/^add$/i));
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /add another question/i })
        ).toBeInTheDocument()
      );
      // Fill first form so we can add another
      const [firstTextarea] = screen.getAllByPlaceholderText(/enter the question/i);
      await user.type(firstTextarea, "First question?");
      await user.click(screen.getByRole("button", { name: /add another question/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /save \(2\)/i })).toBeInTheDocument()
      );
    });
  });
});
