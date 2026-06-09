import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { Sidebar } from "./index";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeSuperAdminUser } from "@/test/mocks";

vi.mock("@/assets/favicon.svg", () => ({ default: "/logo.svg" }));
vi.mock("@/assets/icons", () => ({
  IconQuestionBank: () => <svg data-testid="icon-vault" />,
  IconAssessment: () => <svg data-testid="icon-assessment" />,
  IconLiveInterview: () => <svg data-testid="icon-live" />,
  IconUsers: () => <svg data-testid="icon-users" />,
  IconDotsVertical: () => <svg data-testid="icon-dots" />,
}));
vi.mock("../WorkspaceSwitcher", () => ({
  WorkspaceSwitcher: ({ collapsed }: { collapsed: boolean }) => (
    <div data-testid="workspace-switcher" data-collapsed={String(collapsed)} />
  ),
}));

const workspace = { id: "ws-1", name: "Test Workspace", description: "", created_by: "user-1", members: [], created_at: "2024-01-01T00:00:00Z", updated_at: "2024-01-01T00:00:00Z" };

function makeAuthState(user = makeAdminUser()) {
  return {
    user,
    isAuthenticated: true,
    isLoading: false,
    accessToken: null,
    refreshToken: null,
  };
}

describe("Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders brand logo image", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByAltText("SoftSuave Hire")).toBeInTheDocument();
  });

  it("renders brand name text when expanded", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByText("SoftSuave Hire")).toBeInTheDocument();
  });

  it("renders Knowledge Vault navigation link", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByText("Knowledge Vault")).toBeInTheDocument();
  });

  it("renders Live Interviews navigation link", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByText("Live Interviews")).toBeInTheDocument();
  });

  it("renders Assessments link when activeWorkspace is set", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByText("Assessments")).toBeInTheDocument();
  });

  it("does not render Assessments link when there is no activeWorkspace", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: null, workspaces: [] },
      },
    });
    expect(screen.queryByText("Assessments")).not.toBeInTheDocument();
  });

  it("renders Users link for super admin", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(makeSuperAdminUser()),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByText("Users")).toBeInTheDocument();
  });

  it("does not render Users link for regular admin", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(makeAdminUser()),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.queryByText("Users")).not.toBeInTheDocument();
  });

  it("shows Collapse sidebar button when expanded", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByLabelText("Collapse sidebar")).toBeInTheDocument();
  });

  it("collapses sidebar when collapse button is clicked", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    expect(screen.queryByText("SoftSuave Hire")).not.toBeInTheDocument();
  });

  it("saves collapsed state to localStorage on toggle", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    fireEvent.click(screen.getByLabelText("Collapse sidebar"));
    expect(localStorage.getItem("ssh_sidebar_collapsed")).toBe("true");
  });

  it("reads collapsed state from localStorage on mount", () => {
    localStorage.setItem("ssh_sidebar_collapsed", "true");
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.queryByText("SoftSuave Hire")).not.toBeInTheDocument();
  });

  it("shows Expand sidebar button when collapsed", () => {
    localStorage.setItem("ssh_sidebar_collapsed", "true");
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByLabelText("Expand sidebar")).toBeInTheDocument();
  });

  it("expands sidebar on expand button click", () => {
    localStorage.setItem("ssh_sidebar_collapsed", "true");
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    fireEvent.click(screen.getByLabelText("Expand sidebar"));
    expect(screen.getByText("SoftSuave Hire")).toBeInTheDocument();
  });

  it("passes collapsed prop to WorkspaceSwitcher", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByTestId("workspace-switcher")).toHaveAttribute("data-collapsed", "false");
  });

  it("renders main navigation landmark", () => {
    renderWithProviders(<Sidebar />, {
      preloadedState: {
        auth: makeAuthState(),
        workspace: { activeWorkspace: workspace, workspaces: [workspace] },
      },
    });
    expect(screen.getByRole("navigation", { name: /main navigation/i })).toBeInTheDocument();
  });
});
