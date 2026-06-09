import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import DashboardPage from "./DashboardPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser, makeAuthState } from "@/test/mocks";
import type { Workspace } from "@/types";

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const commonWorkspace: Workspace = {
  id: "ws-common",
  name: "Common",
  description: "",
  members: [],
  created_at: "",
  updated_at: "",
  created_by: "user-1",
};

const realWorkspace: Workspace = {
  id: "ws-1",
  name: "Engineering",
  description: "",
  members: [],
  created_at: "",
  updated_at: "",
  created_by: "user-1",
};

describe("DashboardPage", () => {
  it("shows Common Workspace message for admin with no assigned workspace", () => {
    const user = makeAdminUser();
    renderWithProviders(<DashboardPage />, {
      preloadedState: {
        auth: makeAuthState({ user, isAuthenticated: true }),
        workspace: { activeWorkspace: null, workspaces: [] },
      },
    });
    expect(screen.getByText("Common Workspace")).toBeInTheDocument();
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();
  });

  it("shows Common Workspace message for admin with Common workspace active", () => {
    const user = makeAdminUser();
    renderWithProviders(<DashboardPage />, {
      preloadedState: {
        auth: makeAuthState({ user, isAuthenticated: true }),
        workspace: { activeWorkspace: commonWorkspace, workspaces: [commonWorkspace] },
      },
    });
    expect(screen.getByText("Common Workspace")).toBeInTheDocument();
  });

  it("shows No Workspaces Yet for super admin with no workspace", () => {
    const user = makeSuperAdminUser();
    renderWithProviders(<DashboardPage />, {
      preloadedState: {
        auth: makeAuthState({ user, isAuthenticated: true }),
        workspace: { activeWorkspace: null, workspaces: [] },
      },
    });
    expect(screen.getByText("No Workspaces Yet")).toBeInTheDocument();
  });

  it("redirects to assessments page when a real workspace is active", () => {
    const user = makeAdminUser();
    renderWithProviders(<DashboardPage />, {
      preloadedState: {
        auth: makeAuthState({ user, isAuthenticated: true }),
        workspace: { activeWorkspace: realWorkspace, workspaces: [realWorkspace] },
      },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining(realWorkspace.id),
      { replace: true }
    );
  });
});
