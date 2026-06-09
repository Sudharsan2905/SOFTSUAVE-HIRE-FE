import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UsersPage from "./UsersPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState } from "@/test/mocks";

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
  Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="header">
      {title}
      {actions}
    </div>
  ),
}));

vi.mock("@/components/shared/FilterBar", () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;

// Workspace preloaded state with one workspace
const withWorkspace = {
  workspace: {
    workspaces: [{ id: "ws-1", name: "Dev", description: "Dev workspace" }],
    activeWorkspace: null,
  },
};

// Workspace preloaded state with no workspaces
const noWorkspace = {
  workspace: {
    workspaces: [],
    activeWorkspace: null,
  },
};

function makeUsersResponse(users: { id: string; first_name: string; email: string }[] = []) {
  return {
    data: {
      data: users.map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: "Smith",
        email: u.email,
        role: "admin",
        is_active: true,
        workspaces: [],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "",
      })),
    },
  };
}

function renderPage(preloadedState: Record<string, unknown> = {}) {
  return renderWithProviders(<UsersPage />, {
    preloadedState: {
      auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
      ...preloadedState,
    },
  });
}

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockNavigate.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
});

describe("UsersPage", () => {
  // ──────────────────────────────────────────────────────────────
  // Existing tests (kept intact)
  // ──────────────────────────────────────────────────────────────

  it("renders the header", async () => {
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);
    await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
  });

  it("shows loading state initially", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage(withWorkspace);
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("shows empty state when no users found", async () => {
    mockGet.mockResolvedValue(makeUsersResponse([]));
    renderPage(withWorkspace);
    await waitFor(() =>
      expect(screen.queryByRole("row")).not.toBeInTheDocument()
    );
  });

  it("handles API error gracefully", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderPage(withWorkspace);
    await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
  });

  // ──────────────────────────────────────────────────────────────
  // New tests — user card rendering
  // ──────────────────────────────────────────────────────────────

  it("renders user cards with user names when users are returned", async () => {
    mockGet.mockResolvedValue(
      makeUsersResponse([
        { id: "u-1", first_name: "Alice", email: "alice@example.com" },
        { id: "u-2", first_name: "Bob", email: "bob@example.com" },
      ])
    );
    renderPage(withWorkspace);

    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.getByText("Bob Smith")).toBeInTheDocument();
  });

  it("shows user email in user card", async () => {
    mockGet.mockResolvedValue(
      makeUsersResponse([{ id: "u-1", first_name: "Alice", email: "alice@example.com" }])
    );
    renderPage(withWorkspace);

    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());
  });

  it("edit button navigates to user profile page", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(
      makeUsersResponse([{ id: "u-42", first_name: "Carol", email: "carol@example.com" }])
    );
    renderPage(withWorkspace);

    const editBtn = await screen.findByRole("button", { name: /Edit profile of Carol Smith/i });
    await user.click(editBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/profile/u-42");
  });

  // ──────────────────────────────────────────────────────────────
  // New tests — "New Admin" button & no-workspace guard
  // ──────────────────────────────────────────────────────────────

  it("New Admin button is disabled when there are no workspaces", async () => {
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(noWorkspace);

    // The header mock renders actions inline; the button should be present but disabled
    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    expect(newAdminBtn).toBeDisabled();
  });

  it("shows 'Create a workspace first' message when there are no workspaces", async () => {
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(noWorkspace);

    await waitFor(() =>
      expect(screen.getByText("Create a workspace first")).toBeInTheDocument()
    );
  });

  it("does not show FilterBar when there are no workspaces", async () => {
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(noWorkspace);

    await waitFor(() => expect(screen.queryByTestId("filter-bar")).not.toBeInTheDocument());
  });

  // ──────────────────────────────────────────────────────────────
  // New tests — create modal
  // ──────────────────────────────────────────────────────────────

  it("clicking New Admin button opens the create modal", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() =>
      expect(screen.getByText("Create Admin User")).toBeInTheDocument()
    );
  });

  it("Cancel button in create modal closes the modal", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    const cancelBtn = screen.getByRole("button", { name: /Cancel/i });
    await user.click(cancelBtn);

    await waitFor(() =>
      expect(screen.queryByText("Create Admin User")).not.toBeInTheDocument()
    );
  });

  it("Create button is disabled when all form fields are empty", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    // The Create button (last footer button) should be disabled
    const createBtn = screen.getByRole("button", { name: /^Create$/i });
    expect(createBtn).toBeDisabled();
  });

  it("can fill in form fields in the create modal", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    const firstNameInput = screen.getByPlaceholderText("Enter first name");
    const emailInput = screen.getByPlaceholderText("Enter email");
    const passwordInput = screen.getByPlaceholderText("Enter password");

    await user.type(firstNameInput, "David");
    await user.type(emailInput, "david@example.com");
    await user.type(passwordInput, "Secret123");

    expect(firstNameInput).toHaveValue("David");
    expect(emailInput).toHaveValue("david@example.com");
    expect(passwordInput).toHaveValue("Secret123");
  });

  it("Create button remains disabled for Admin role until a workspace is selected", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter first name"), "Eve");
    await user.type(screen.getByPlaceholderText("Enter email"), "eve@example.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "Pass123");

    // Default role is Admin which requires a workspace — Create should still be disabled
    const createBtn = screen.getByRole("button", { name: /^Create$/i });
    expect(createBtn).toBeDisabled();
  });

  it("selecting a workspace enables the Create button for Admin role", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter first name"), "Eve");
    await user.type(screen.getByPlaceholderText("Enter email"), "eve@example.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "Pass123");

    // Select the workspace checkbox
    const wsCheckbox = screen.getByRole("checkbox");
    await user.click(wsCheckbox);

    const createBtn = screen.getByRole("button", { name: /^Create$/i });
    expect(createBtn).not.toBeDisabled();
  });

  it("successful create calls api.post, shows success toast, and closes modal", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    mockPost.mockResolvedValue({});
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    const modal = await screen.findByRole("dialog");
    await waitFor(() => expect(within(modal).getByText("Create Admin User")).toBeInTheDocument());

    // Fill the form with Super Admin role (no workspace required)
    await user.type(screen.getByPlaceholderText("Enter first name"), "Frank");
    await user.type(screen.getByPlaceholderText("Enter email"), "frank@example.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "Pass123");

    // Change role to Super Admin — query by the label-linked accessible name
    const roleSelectTrigger = within(modal).getByRole("button", { name: /Role/i });
    await user.click(roleSelectTrigger);

    const superAdminOption = await screen.findByRole("button", { name: /^Super Admin$/i });
    await user.click(superAdminOption);

    // Now Create should be enabled
    const createBtn = await screen.findByRole("button", { name: /^Create$/i });
    await waitFor(() => expect(createBtn).not.toBeDisabled());
    await user.click(createBtn);

    await waitFor(() => expect(mockPost).toHaveBeenCalled());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("User created successfully."));
    await waitFor(() =>
      expect(screen.queryByText("Create Admin User")).not.toBeInTheDocument()
    );
  });

  it("failed create shows error toast", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    mockPost.mockRejectedValue({ response: { data: { message: "Email already taken" } } });
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    const modal = await screen.findByRole("dialog");
    await waitFor(() => expect(within(modal).getByText("Create Admin User")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter first name"), "Grace");
    await user.type(screen.getByPlaceholderText("Enter email"), "grace@example.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "Pass123");

    // Switch to Super Admin — scope to modal to avoid ambiguity with empty-state button
    const roleSelectTrigger = within(modal).getByRole("button", { name: /Role/i });
    await user.click(roleSelectTrigger);

    const superAdminOption = await screen.findByRole("button", { name: /^Super Admin$/i });
    await user.click(superAdminOption);

    const createBtn = await screen.findByRole("button", { name: /^Create$/i });
    await waitFor(() => expect(createBtn).not.toBeDisabled());
    await user.click(createBtn);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Email already taken")
    );
  });

  it("failed create with no server message shows fallback error toast", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    mockPost.mockRejectedValue(new Error("Network error"));
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    const modal = await screen.findByRole("dialog");
    await waitFor(() => expect(within(modal).getByText("Create Admin User")).toBeInTheDocument());

    await user.type(screen.getByPlaceholderText("Enter first name"), "Hank");
    await user.type(screen.getByPlaceholderText("Enter email"), "hank@example.com");
    await user.type(screen.getByPlaceholderText("Enter password"), "Pass123");

    // Switch to Super Admin — scope to modal to avoid ambiguity with empty-state button
    const roleSelectTrigger = within(modal).getByRole("button", { name: /Role/i });
    await user.click(roleSelectTrigger);

    const superAdminOption = await screen.findByRole("button", { name: /^Super Admin$/i });
    await user.click(superAdminOption);

    const createBtn = await screen.findByRole("button", { name: /^Create$/i });
    await waitFor(() => expect(createBtn).not.toBeDisabled());
    await user.click(createBtn);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to create user. Please try again.")
    );
  });

  it("password toggle shows and hides password in create modal", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    const passwordInput = screen.getByPlaceholderText("Enter password");
    expect(passwordInput).toHaveAttribute("type", "password");

    // The eye icon button is rendered as a plain button inside the rightElement
    // Find the toggle button by locating the button adjacent to the password input
    const passwordWrapper = passwordInput.closest("[class]");
    const toggleBtn = within(passwordWrapper!.parentElement!).getByRole("button");
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide
    await user.click(toggleBtn);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  it("API load failure shows error toast", async () => {
    mockGet.mockRejectedValue(new Error("Server error"));
    renderPage(withWorkspace);

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Failed to load users.")
    );
  });

  it("workspace checkbox toggles selection in create modal", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    const wsCheckbox = screen.getByRole("checkbox");
    expect(wsCheckbox).not.toBeChecked();

    await user.click(wsCheckbox);
    expect(wsCheckbox).toBeChecked();

    await user.click(wsCheckbox);
    expect(wsCheckbox).not.toBeChecked();
  });

  it("workspace section is hidden when Super Admin role is selected", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    const modal = await screen.findByRole("dialog");
    await waitFor(() => expect(within(modal).getByText("Create Admin User")).toBeInTheDocument());

    // By default (Admin role) the workspace section should be visible
    expect(screen.getByText("Select at least one workspace to assign")).toBeInTheDocument();

    // Switch to Super Admin — scope to modal to avoid ambiguity with empty-state button
    const roleSelectTrigger = within(modal).getByRole("button", { name: /Role/i });
    await user.click(roleSelectTrigger);

    const superAdminOption = await screen.findByRole("button", { name: /^Super Admin$/i });
    await user.click(superAdminOption);

    // Workspace section should now be gone
    expect(
      screen.queryByText("Select at least one workspace to assign")
    ).not.toBeInTheDocument();
  });

  it("modal can be closed via the X close button", async () => {
    const user = userEvent.setup();
    mockGet.mockResolvedValue(makeUsersResponse());
    renderPage(withWorkspace);

    const newAdminBtn = await screen.findByRole("button", { name: /New Admin/i });
    await user.click(newAdminBtn);

    await waitFor(() => expect(screen.getByText("Create Admin User")).toBeInTheDocument());

    const closeBtn = screen.getByRole("button", { name: /Close/i });
    await user.click(closeBtn);

    await waitFor(() =>
      expect(screen.queryByText("Create Admin User")).not.toBeInTheDocument()
    );
  });
});
