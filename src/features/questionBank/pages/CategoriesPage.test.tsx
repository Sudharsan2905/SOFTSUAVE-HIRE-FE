import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event"; // used via userEvent.setup() in all interaction tests
import CategoriesPage from "./CategoriesPage";
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
    onRefresh,
    search,
    onSearchChange,
    sortOrder,
    onSortOrderToggle,
    _viewMode,
    onViewModeChange,
  }: {
    onRefresh?: () => void;
    search?: string;
    onSearchChange?: (v: string) => void;
    sortOrder?: string;
    onSortOrderToggle?: () => void;
    _viewMode?: string;
    onViewModeChange?: (v: string) => void;
  }) => (
    <div data-testid="filter-bar">
      {onRefresh && (
        <button data-testid="refresh-btn" onClick={onRefresh}>
          Refresh
        </button>
      )}
      {onSearchChange && (
        <input
          data-testid="search-input"
          value={search ?? ""}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search"
        />
      )}
      {onSortOrderToggle && (
        <button data-testid="sort-order-toggle" onClick={onSortOrderToggle}>
          {sortOrder}
        </button>
      )}
      {onViewModeChange && (
        <>
          <button data-testid="view-mode-grid" onClick={() => onViewModeChange("grid")}>
            Grid
          </button>
          <button data-testid="view-mode-list" onClick={() => onViewModeChange("list")}>
            List
          </button>
        </>
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
    onClose?: () => void;
  }) =>
    isOpen ? (
      <div data-testid="modal" aria-label={title}>
        <h2 data-testid="modal-title">{title}</h2>
        <div data-testid="modal-body">{children}</div>
        {footer && <div data-testid="modal-footer">{footer}</div>}
        {onClose && (
          <button data-testid="modal-close" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    ) : null,
}));

vi.mock("@/components/ui/Input", () => ({
  Input: ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLInputElement>;
    placeholder?: string;
  }) => (
    <div>
      {label && <label>{label}</label>}
      <input
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value ?? ""}
        onChange={onChange}
      />
    </div>
  ),
  Textarea: ({
    label,
    value,
    onChange,
    placeholder,
  }: {
    label?: string;
    value?: string;
    onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
    placeholder?: string;
  }) => (
    <div>
      {label && <label>{label}</label>}
      <textarea
        aria-label={label}
        placeholder={placeholder ?? label}
        value={value ?? ""}
        onChange={onChange}
      />
    </div>
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

vi.mock("@/components/ui/Badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

vi.mock("@/components/ui/Tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/assets/icons", () => ({
  IconPlus: () => <span data-testid="icon-plus" />,
  IconEdit: () => <span data-testid="icon-edit" />,
  IconDelete: () => <span data-testid="icon-delete" />,
  IconQuestionBank: () => <span data-testid="icon-question-bank" />,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
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

function makeCategoriesResponse(
  items: { id: string; name: string; question_count?: number; description?: string }[] = []
) {
  return {
    data: {
      data: {
        categories: items.map((c) => ({
          id: c.id,
          name: c.name,
          description: c.description ?? `Description for ${c.name}`,
          question_count: c.question_count ?? 0,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        })),
        pagination: { page: 1, page_size: 10, total: items.length, total_pages: 1 },
      },
    },
  };
}

const renderPage = () =>
  renderWithProviders(<CategoriesPage />, {
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
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("CategoriesPage", () => {
  // ── Initial render ───────────────────────────────────────────────────────────

  describe("initial render", () => {
    it("renders the header with correct title", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse());
      renderPage();
      await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
      expect(screen.getByTestId("header-title")).toHaveTextContent("Knowledge Vault");
    });

    it("renders the FilterBar", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse());
      renderPage();
      await waitFor(() => expect(screen.getByTestId("filter-bar")).toBeInTheDocument());
    });

    it("renders the New Category button in header actions", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse());
      renderPage();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      expect(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      ).toBeInTheDocument();
    });

    it("calls the categories API on mount", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse());
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalledWith(expect.stringContaining("categories")));
    });

    it("handles API error gracefully and still renders header", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
    });

    it("shows toast error when categories API fails", async () => {
      mockGet.mockRejectedValue(new Error("Network error"));
      renderPage();
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to load categories")
        )
      );
    });
  });

  // ── Loading state ─────────────────────────────────────────────────────────────

  describe("loading state", () => {
    it("shows a loading spinner while fetching categories", async () => {
      // Never resolves so loading state persists
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      mockGet.mockImplementation(() => new Promise(() => {}));
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("status", { hidden: true })).toBeInTheDocument()
      );
    });

    it("removes the spinner after categories load", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      // Spinner uses <output aria-label="Loading"> - it should be gone once done
      expect(screen.queryByRole("status", { hidden: true })).not.toBeInTheDocument();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────────────

  describe("empty state", () => {
    it("shows empty state message when no categories exist", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      expect(screen.getByText(/no categories yet/i)).toBeInTheDocument();
    });

    it("shows 'Create your first category' button in empty state", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      expect(
        screen.getByRole("button", { name: /create your first category/i })
      ).toBeInTheDocument();
    });

    it("empty state button opens the create modal", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(
          screen.getByRole("button", { name: /create your first category/i })
        ).toBeInTheDocument()
      );
      await user.click(screen.getByRole("button", { name: /create your first category/i }));
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/create category/i);
    });
  });

  // ── Category cards ────────────────────────────────────────────────────────────

  describe("category cards", () => {
    it("renders a card for each returned category", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([
          { id: "cat-1", name: "JavaScript" },
          { id: "cat-2", name: "Python" },
        ])
      );
      renderPage();
      await waitFor(() => expect(screen.getAllByText("JavaScript").length).toBeGreaterThan(0));
      expect(screen.getAllByText("JavaScript").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Python").length).toBeGreaterThan(0);
    });

    it("shows question count badge on each card", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript", question_count: 5 }])
      );
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      expect(screen.getAllByText(/5 questions/i).length).toBeGreaterThan(0);
    });

    it("renders Edit category button for each card", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      const editBtns = screen.getAllByRole("button", { name: /edit category/i });
      expect(editBtns.length).toBeGreaterThan(0);
    });

    it("renders Delete category button for each card", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      const deleteBtns = screen.getAllByRole("button", { name: /delete category/i });
      expect(deleteBtns.length).toBeGreaterThan(0);
    });
  });

  // ── Navigation ────────────────────────────────────────────────────────────────

  describe("navigation", () => {
    it("navigates to the category questions page when nav button is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(mockGet).toHaveBeenCalled());
      const navBtn = screen.getByRole("button", { name: /open javascript category/i });
      await user.click(navBtn);
      expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining("cat-1"));
    });
  });

  // ── Create modal ──────────────────────────────────────────────────────────────

  describe("create modal", () => {
    it("opens create modal when New Category header button is clicked", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/create category/i);
    });

    it("closes create modal when Cancel is clicked", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^cancel$/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });

    it("Create button is disabled when category name is empty", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal-footer")).toBeInTheDocument());
      expect(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^create$/i })
      ).toBeDisabled();
    });

    it("calls POST API when Create is submitted with a name", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      mockPost.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.type(
        within(screen.getByTestId("modal-body")).getByRole("textbox", { name: /category name/i }),
        "TypeScript"
      );
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^create$/i })
      );
      await waitFor(() =>
        expect(mockPost).toHaveBeenCalledWith(
          expect.stringContaining("categories"),
          expect.objectContaining({ name: "TypeScript" })
        )
      );
    });

    it("shows success toast after creating a category", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      mockPost.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.type(
        within(screen.getByTestId("modal-body")).getByRole("textbox", { name: /category name/i }),
        "TypeScript"
      );
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^create$/i })
      );
      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("Category created")
        )
      );
    });

    it("closes modal and re-fetches after successful create", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      mockPost.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      const callsBefore = mockGet.mock.calls.length;
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.type(
        within(screen.getByTestId("modal-body")).getByRole("textbox", { name: /category name/i }),
        "TypeScript"
      );
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^create$/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    it("shows error toast when create API fails", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      mockPost.mockRejectedValue(new Error("Server error"));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("header-actions")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("header-actions")).getByRole("button", {
          name: /new category/i,
        })
      );
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.type(
        within(screen.getByTestId("modal-body")).getByRole("textbox", { name: /category name/i }),
        "TypeScript"
      );
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^create$/i })
      );
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to create category")
        )
      );
    });
  });

  // ── Edit modal ────────────────────────────────────────────────────────────────

  describe("edit modal", () => {
    it("opens edit modal when Edit category button is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/edit category/i);
    });

    it("pre-fills category name in edit modal", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      const nameInput = within(screen.getByTestId("modal-body")).getByRole("textbox", {
        name: /category name/i,
      });
      expect(nameInput).toHaveValue("JavaScript");
    });

    it("closes edit modal when Cancel is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^cancel$/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });

    it("calls PUT API when Save is clicked in edit modal", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockPut.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^save$/i })
      );
      await waitFor(() =>
        expect(mockPut).toHaveBeenCalledWith(
          expect.stringContaining("cat-1"),
          expect.any(Object)
        )
      );
    });

    it("shows success toast after editing a category", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockPut.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^save$/i })
      );
      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("Category updated")
        )
      );
    });

    it("closes edit modal and re-fetches after successful save", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockPut.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      const callsBefore = mockGet.mock.calls.length;
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^save$/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    it("shows error toast when edit API fails", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockPut.mockRejectedValue(new Error("Server error"));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /edit category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /edit category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^save$/i })
      );
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to update category")
        )
      );
    });
  });

  // ── Delete modal ──────────────────────────────────────────────────────────────

  describe("delete modal", () => {
    it("opens delete modal when Delete category button is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      expect(screen.getByTestId("modal-title")).toHaveTextContent(/delete category/i);
    });

    it("shows category name in delete confirmation modal", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal-body")).toBeInTheDocument());
      expect(within(screen.getByTestId("modal-body")).getByText("JavaScript")).toBeInTheDocument();
    });

    it("closes delete modal when Cancel is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^cancel$/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
    });

    it("calls DELETE API when Delete button is confirmed", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockDelete.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^delete$/i })
      );
      await waitFor(() =>
        expect(mockDelete).toHaveBeenCalledWith(expect.stringContaining("cat-1"))
      );
    });

    it("shows success toast after deleting a category", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockDelete.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^delete$/i })
      );
      await waitFor(() =>
        expect(mockToastSuccess).toHaveBeenCalledWith(
          expect.stringContaining("Category deleted")
        )
      );
    });

    it("closes delete modal and re-fetches after successful delete", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockDelete.mockResolvedValue({ data: {} });
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      const callsBefore = mockGet.mock.calls.length;
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^delete$/i })
      );
      await waitFor(() => expect(screen.queryByTestId("modal")).not.toBeInTheDocument());
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });

    it("shows error toast when delete API fails", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      mockDelete.mockRejectedValue(new Error("Server error"));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() =>
        expect(screen.getAllByRole("button", { name: /delete category/i }).length).toBeGreaterThan(0)
      );
      await user.click(screen.getAllByRole("button", { name: /delete category/i })[0]);
      await waitFor(() => expect(screen.getByTestId("modal")).toBeInTheDocument());
      await user.click(
        within(screen.getByTestId("modal-footer")).getByRole("button", { name: /^delete$/i })
      );
      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith(
          expect.stringContaining("Failed to delete category")
        )
      );
    });
  });

  // ── Refresh ───────────────────────────────────────────────────────────────────

  describe("refresh", () => {
    it("re-fetches categories when refresh button in FilterBar is clicked", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("refresh-btn")).toBeInTheDocument());
      const callsBefore = mockGet.mock.calls.length;
      await user.click(screen.getByTestId("refresh-btn"));
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });
  });

  // ── Pagination ────────────────────────────────────────────────────────────────

  describe("pagination", () => {
    it("renders Pagination component when categories are returned", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      await waitFor(() => expect(screen.getByTestId("pagination")).toBeInTheDocument());
    });

    it("shows correct total count in pagination", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([
          { id: "cat-1", name: "JavaScript" },
          { id: "cat-2", name: "Python" },
        ])
      );
      renderPage();
      await waitFor(() =>
        expect(screen.getByTestId("pagination-total")).toHaveTextContent("2")
      );
    });

    it("re-fetches when pagination Next button is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("pagination-next")).toBeInTheDocument());
      const callsBefore = mockGet.mock.calls.length;
      await user.click(screen.getByTestId("pagination-next"));
      await waitFor(() => expect(mockGet.mock.calls.length).toBeGreaterThan(callsBefore));
    });
  });

  // ── Sort order toggle ─────────────────────────────────────────────────────────

  describe("sort order toggle", () => {
    it("toggles sort order from desc to asc when toggle is clicked", async () => {
      mockGet.mockResolvedValue(makeCategoriesResponse([]));
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("sort-order-toggle")).toBeInTheDocument());
      expect(screen.getByTestId("sort-order-toggle")).toHaveTextContent("desc");
      await user.click(screen.getByTestId("sort-order-toggle"));
      await waitFor(() =>
        expect(screen.getByTestId("sort-order-toggle")).toHaveTextContent("asc")
      );
    });
  });

  // ── View mode switch ──────────────────────────────────────────────────────────

  describe("view mode switch", () => {
    it("switches to list view when list button is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("view-mode-list")).toBeInTheDocument());
      await user.click(screen.getByTestId("view-mode-list"));
      // No crash expected — list mode toggled
      expect(screen.getByTestId("view-mode-list")).toBeInTheDocument();
    });

    it("switches to grid view when grid button is clicked", async () => {
      mockGet.mockResolvedValue(
        makeCategoriesResponse([{ id: "cat-1", name: "JavaScript" }])
      );
      renderPage();
      const user = userEvent.setup();
      await waitFor(() => expect(screen.getByTestId("view-mode-grid")).toBeInTheDocument());
      await user.click(screen.getByTestId("view-mode-list"));
      await user.click(screen.getByTestId("view-mode-grid"));
      expect(screen.getByTestId("view-mode-grid")).toBeInTheDocument();
    });
  });
});
