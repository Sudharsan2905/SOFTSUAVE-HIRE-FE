import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceSwitcher } from "./index";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser, makeAuthState } from "@/test/mocks";

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

const mockNavigate = vi.fn();
let mockPathname = "/dashboard";
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: mockPathname }),
  };
});

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockPut = api.put as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;

const workspace1 = {
  id: "ws-1",
  name: "Engineering",
  description: "Eng team",
  members: [],
};
const workspace2 = {
  id: "ws-2",
  name: "Sales",
  description: "Sales team",
  members: [],
};
const adminUser = makeAdminUser({ default_workspace_id: "ws-1" });
const superAdmin = makeSuperAdminUser({ default_workspace_id: "ws-1" });

function makeWsListResponse(workspaces: object[]) {
  return { data: { data: { workspaces } } };
}

function makeMeResponse(user: object = adminUser) {
  return { data: { data: user } };
}

/**
 * Default GET handler used at mount. The component fires two requests in
 * parallel: the workspace list and /auth/me. /auth/me must return a real user
 * (with a role) or `updateUser` would wipe the role and break isSuperAdmin.
 * `currentUser` is set per-test so the post-fetch user keeps the right role.
 */
let currentUser: object = adminUser;
function defaultGet(workspaces: object[]) {
  return (url: string) => {
    if (typeof url === "string" && url.includes("/auth/me")) {
      return Promise.resolve(makeMeResponse(currentUser));
    }
    if (typeof url === "string" && (url.includes("/members") || url.includes("/admin-users"))) {
      return Promise.resolve({ data: { data: [] } });
    }
    return Promise.resolve(makeWsListResponse(workspaces));
  };
}

function renderSwitcher(
  preloadedState: Record<string, unknown>,
  props: { collapsed?: boolean } = {}
) {
  // Keep the post-mount /auth/me user in sync with the preloaded auth user so
  // updateUser() does not strip the role and flip isSuperAdmin.
  const authUser = (preloadedState.auth as { user?: object } | undefined)?.user;
  if (authUser) currentUser = authUser;
  return renderWithProviders(<WorkspaceSwitcher {...props} />, {
    preloadedState: preloadedState as never,
  });
}

beforeEach(() => {
  mockPathname = "/dashboard";
  mockGet.mockReset();
  mockPost.mockReset();
  mockPut.mockReset();
  mockDelete.mockReset();
  mockNavigate.mockReset();
  vi.mocked(toast.success).mockReset();
  vi.mocked(toast.error).mockReset();
  currentUser = adminUser;
  // Default mount fetch: workspaces list (returns the two seed workspaces) + /me.
  mockGet.mockImplementation(defaultGet([workspace1, workspace2]));
});

describe("WorkspaceSwitcher", () => {
  // ──────────────────────────────────────────────────────────────
  // Basic rendering
  // ──────────────────────────────────────────────────────────────

  it("renders active workspace name from store", async () => {
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());
  });

  it("shows 'Select Workspace' when there is no active workspace", async () => {
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Select Workspace")).toBeInTheDocument());
  });

  // ──────────────────────────────────────────────────────────────
  // Empty states
  // ──────────────────────────────────────────────────────────────

  it("shows 'No workspace access' for admin with no workspaces", async () => {
    mockGet.mockImplementation(defaultGet([]));
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [] },
    });
    await waitFor(() => expect(screen.getByText(/no workspace access/i)).toBeInTheDocument());
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });

  it("shows collapsed placeholder for admin with no workspaces", async () => {
    mockGet.mockImplementation(defaultGet([]));
    const { container } = renderSwitcher(
      {
        auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
        workspace: { activeWorkspace: null, workspaces: [] },
      },
      { collapsed: true }
    );
    await waitFor(() => expect(container.textContent).toContain("?"));
    expect(screen.queryByText(/no workspace access/i)).not.toBeInTheDocument();
  });

  it("shows create prompt for super admin with no workspaces", async () => {
    mockGet.mockImplementation(defaultGet([]));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [] },
    });
    await waitFor(() => expect(screen.getByText("No workspaces yet")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /create workspace/i })).toBeInTheDocument();
  });

  it("shows collapsed create trigger for super admin with no workspaces", async () => {
    mockGet.mockImplementation(defaultGet([]));
    renderSwitcher(
      {
        auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
        workspace: { activeWorkspace: null, workspaces: [] },
      },
      { collapsed: true }
    );
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create workspace/i })).toBeInTheDocument()
    );
  });

  // ──────────────────────────────────────────────────────────────
  // Dropdown open / close
  // ──────────────────────────────────────────────────────────────

  it("opens dropdown when trigger is clicked and lists workspaces", async () => {
    const user = userEvent.setup();
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1, workspace2] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await waitFor(() => expect(screen.getByText("Sales")).toBeInTheDocument());
  });

  it("closes the dropdown when clicking outside", async () => {
    const user = userEvent.setup();
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1, workspace2] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await waitFor(() => expect(screen.getByText("Sales")).toBeInTheDocument());

    // mousedown outside the container
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByText("Sales")).not.toBeInTheDocument());
  });

  it("shows 'New Workspace' button in dropdown only for super admin", async () => {
    const user = userEvent.setup();
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /new workspace/i })).toBeInTheDocument()
    );
  });

  it("does not show 'New Workspace' button for admin", async () => {
    const user = userEvent.setup();
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /settings/i })).toBeInTheDocument()
    );
    expect(screen.queryByRole("button", { name: /new workspace/i })).not.toBeInTheDocument();
  });

  // ──────────────────────────────────────────────────────────────
  // Switching workspace (dispatch)
  // ──────────────────────────────────────────────────────────────

  it("switching workspace dispatches setActiveWorkspace", async () => {
    const user = userEvent.setup();
    const { store } = renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1, workspace2] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByText("Sales"));

    await waitFor(() => expect(store.getState().workspace.activeWorkspace?.id).toBe("ws-2"));
  });

  it("navigates to assessments when switching while on a /workspaces route", async () => {
    mockPathname = "/workspaces/ws-1/assessments";
    const user = userEvent.setup();
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1, workspace2] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByText("Sales"));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspaces/ws-2/assessments"));
  });

  it("does not navigate when switching while not on a /workspaces route", async () => {
    mockPathname = "/dashboard";
    const user = userEvent.setup();
    const { store } = renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1, workspace2] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByText("Sales"));

    // Active workspace switched in store, but no route navigation occurred.
    await waitFor(() => expect(store.getState().workspace.activeWorkspace?.id).toBe("ws-2"));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────
  // Collapsed mode
  // ──────────────────────────────────────────────────────────────

  it("renders collapsed trigger with aria-label and opens portal popup", async () => {
    const user = userEvent.setup();
    renderSwitcher(
      {
        auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
        workspace: { activeWorkspace: workspace1, workspaces: [workspace1, workspace2] },
      },
      { collapsed: true }
    );
    const trigger = await screen.findByRole("button", { name: /engineering/i });
    await user.click(trigger);
    // Portal popup lists other workspace
    await waitFor(() => expect(screen.getByText("Sales")).toBeInTheDocument());
    // Clicking again closes it
    await user.click(trigger);
    await waitFor(() => expect(screen.queryByText("Sales")).not.toBeInTheDocument());
  });

  // ──────────────────────────────────────────────────────────────
  // Create workspace modal
  // ──────────────────────────────────────────────────────────────

  it("super admin can open the create modal and create a workspace", async () => {
    const user = userEvent.setup();
    const newWs = { id: "ws-3", name: "Design", description: "", members: [] };
    mockPost.mockResolvedValue({ data: { data: newWs } });
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /new workspace/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(/Engineering Hiring/i), "Design");

    const createBtn = within(dialog).getByRole("button", { name: /^Create$/i });
    expect(createBtn).not.toBeDisabled();
    await user.click(createBtn);

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("/api/workspaces", {
        name: "Design",
        description: "",
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Workspace created"));
  });

  it("create button is disabled until a name is entered", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([]));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create workspace/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^Create$/i })).toBeDisabled();

    await user.type(within(dialog).getByPlaceholderText(/Engineering Hiring/i), "Design");
    expect(within(dialog).getByRole("button", { name: /^Create$/i })).not.toBeDisabled();
  });

  it("shows error toast when create workspace fails", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([]));
    mockPost.mockRejectedValue(new Error("boom"));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create workspace/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(/Engineering Hiring/i), "X");
    await user.click(within(dialog).getByRole("button", { name: /^Create$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to create workspace"));
  });

  it("create modal can be cancelled", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([]));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [] },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create workspace/i })).toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /create workspace/i }));

    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /cancel/i }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  // ──────────────────────────────────────────────────────────────
  // Settings modal
  // ──────────────────────────────────────────────────────────────

  it("opens settings modal showing workspace details", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([workspace1]));
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Workspace Settings")).toBeInTheDocument();
    expect(within(dialog).getByText("Eng team")).toBeInTheDocument();
  });

  it("super admin sees member-management actions in settings and can edit", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([workspace1]));
    mockPut.mockResolvedValue({ data: { data: { ...workspace1, name: "Eng v2" } } });
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));

    const dialog = await screen.findByRole("dialog");
    // Super-admin-only actions
    expect(within(dialog).getByRole("button", { name: /invite members/i })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /delete/i })).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: /^edit$/i }));
    const nameInput = within(dialog).getByDisplayValue("Engineering");
    await user.clear(nameInput);
    await user.type(nameInput, "Eng v2");
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(mockPut).toHaveBeenCalledWith("/api/workspaces/ws-1", {
        name: "Eng v2",
        description: "Eng team",
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Workspace updated"));
  });

  it("admin does not see super-admin settings actions", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([workspace1]));
    renderSwitcher({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));

    const dialog = await screen.findByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /invite members/i })
    ).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });

  it("settings save failure shows error toast", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([workspace1]));
    mockPut.mockRejectedValue(new Error("nope"));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^edit$/i }));
    await user.click(within(dialog).getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to update workspace"));
  });

  // ──────────────────────────────────────────────────────────────
  // Delete workspace
  // ──────────────────────────────────────────────────────────────

  it("super admin can delete a workspace", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([workspace1]));
    mockDelete.mockResolvedValue({});
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /delete/i }));

    // Delete confirm modal appears
    dialog = await screen.findByRole("dialog", { name: /delete workspace/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("/api/workspaces/ws-1"));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('"Engineering" deleted'));
  });

  it("delete failure shows error toast", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation(defaultGet([workspace1]));
    mockDelete.mockRejectedValue(new Error("fail"));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /delete/i }));
    dialog = await screen.findByRole("dialog", { name: /delete workspace/i });
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to delete workspace"));
  });

  // ──────────────────────────────────────────────────────────────
  // Invite members
  // ──────────────────────────────────────────────────────────────

  it("super admin can open invite modal, toggle a user, and save", async () => {
    const user = userEvent.setup();
    const adminUsers = [
      { id: "u-10", first_name: "Pat", last_name: "Lee", email: "pat@example.com" },
    ];
    // mount fetch (ws list + me), then settings members fetch, then invite fetch
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/members")) return Promise.resolve({ data: { data: [] } });
      if (url.includes("/admin-users")) return Promise.resolve({ data: { data: adminUsers } });
      if (url.includes("/auth/me")) return Promise.resolve(makeMeResponse(superAdmin));
      return Promise.resolve(makeWsListResponse([workspace1]));
    });
    mockPost.mockResolvedValue({});
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /invite members/i }));

    // Invite modal appears with the admin user
    dialog = await screen.findByRole("dialog", { name: /invite members/i });
    await user.click(await within(dialog).findByText("Pat Lee"));
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("/api/workspaces/ws-1/invite", {
        user_ids: ["u-10"],
      })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Members updated"));
  });

  it("invite save failure shows error toast", async () => {
    const user = userEvent.setup();
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/members")) return Promise.resolve({ data: { data: [] } });
      if (url.includes("/admin-users")) return Promise.resolve({ data: { data: [] } });
      if (url.includes("/auth/me")) return Promise.resolve(makeMeResponse(superAdmin));
      return Promise.resolve(makeWsListResponse([workspace1]));
    });
    mockPost.mockRejectedValue(new Error("x"));
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));
    let dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /invite members/i }));
    dialog = await screen.findByRole("dialog", { name: /invite members/i });
    await user.click(within(dialog).getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to update members"));
  });

  // ──────────────────────────────────────────────────────────────
  // Member avatars in settings
  // ──────────────────────────────────────────────────────────────

  it("renders member avatars in settings for super admin", async () => {
    const user = userEvent.setup();
    const wsWithMembers = {
      ...workspace1,
      members: [
        { user_id: "u-1", email: "a@example.com", role: "admin" },
        { user_id: "u-2", email: "b@example.com", role: "admin" },
      ],
    };
    mockGet.mockImplementation((url: string) => {
      if (url.includes("/members"))
        return Promise.resolve({
          data: {
            data: [{ id: "u-1", first_name: "Alpha", last_name: "One", email: "a@example.com" }],
          },
        });
      if (url.includes("/auth/me")) return Promise.resolve(makeMeResponse(superAdmin));
      return Promise.resolve(makeWsListResponse([wsWithMembers]));
    });
    renderSwitcher({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: wsWithMembers, workspaces: [wsWithMembers] },
    });
    await waitFor(() => expect(screen.getByText("Engineering")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /engineering/i }));
    await user.click(await screen.findByRole("button", { name: /settings/i }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Members")).toBeInTheDocument();
    // Avatar initials from resolved detail (Alpha One -> AO)
    await waitFor(() => expect(within(dialog).getByText("AO")).toBeInTheDocument());
  });
});
