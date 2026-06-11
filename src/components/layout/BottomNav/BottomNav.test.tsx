import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BottomNav } from "./index";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser, makeAuthState } from "@/test/mocks";
import { api } from "@/utils/api";

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
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: "/dashboard" }),
  };
});

const mockGet = api.get as ReturnType<typeof vi.fn>;

const workspace1 = { id: "ws-1", name: "Engineering", description: "Eng", members: [] };
const adminUser = makeAdminUser({ default_workspace_id: "ws-1" });
const superAdmin = makeSuperAdminUser({ default_workspace_id: "ws-1" });

let currentUser: object = adminUser;

function renderNav(preloadedState: Record<string, unknown>) {
  const authUser = (preloadedState.auth as { user?: object } | undefined)?.user;
  if (authUser) currentUser = authUser;
  return renderWithProviders(<BottomNav />, { preloadedState: preloadedState as never });
}

beforeEach(() => {
  mockNavigate.mockReset();
  currentUser = adminUser;
  // The embedded WorkspaceSwitcher fetches on mount; keep the active workspace
  // present (so it is not cleared) and return a real user for /auth/me.
  mockGet.mockImplementation((url: string) => {
    if (typeof url === "string" && url.includes("/auth/me")) {
      return Promise.resolve({ data: { data: currentUser } });
    }
    return Promise.resolve({ data: { data: { workspaces: [workspace1] } } });
  });
});

describe("BottomNav", () => {
  it("renders the core nav items for an admin", () => {
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    expect(screen.getByRole("link", { name: /question bank/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /assessments/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /live interviews/i })).toBeInTheDocument();
  });

  it("does not render the Users item for an admin", () => {
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    expect(screen.queryByRole("link", { name: /^users$/i })).not.toBeInTheDocument();
  });

  it("renders the Users item for a super admin", () => {
    renderNav({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    expect(screen.getByRole("link", { name: /^users$/i })).toBeInTheDocument();
  });

  it("navigates to question bank after tap flash", async () => {
    const user = userEvent.setup();
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });

    await user.click(screen.getByRole("link", { name: /question bank/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/question-bank"));
  });

  it("navigates to the active workspace's assessments", async () => {
    const user = userEvent.setup();
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });

    await user.click(screen.getByRole("link", { name: /assessments/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/workspaces/ws-1/assessments"));
  });

  it("disables the assessments link when there is no active workspace", async () => {
    const user = userEvent.setup();
    // The embedded switcher's fetch must not assign an active workspace here.
    mockGet.mockImplementation((url: string) => {
      if (typeof url === "string" && url.includes("/auth/me")) {
        return Promise.resolve({ data: { data: { ...adminUser, default_workspace_id: null } } });
      }
      return Promise.resolve({ data: { data: { workspaces: [] } } });
    });
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: null, workspaces: [] },
    });

    const link = screen.getByRole("link", { name: /assessments/i });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");

    await user.click(link);
    // disabled items never navigate
    await new Promise((r) => setTimeout(r, 250));
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates to live interviews", async () => {
    const user = userEvent.setup();
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });

    await user.click(screen.getByRole("link", { name: /live interviews/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/live-interviews"));
  });

  it("navigates to users for a super admin", async () => {
    const user = userEvent.setup();
    renderNav({
      auth: makeAuthState({ user: superAdmin, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });

    await user.click(screen.getByRole("link", { name: /^users$/i }));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/users"));
  });

  it("renders the workspace switcher slot", () => {
    renderNav({
      auth: makeAuthState({ user: adminUser, isAuthenticated: true }),
      workspace: { activeWorkspace: workspace1, workspaces: [workspace1] },
    });
    expect(screen.getByLabelText(/switch workspace/i)).toBeInTheDocument();
  });
});
