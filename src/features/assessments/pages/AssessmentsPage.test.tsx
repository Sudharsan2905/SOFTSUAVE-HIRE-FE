import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AssessmentsPage from "./AssessmentsPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState } from "@/test/mocks";
import type { Workspace } from "@/types";

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
  Header: ({ title }: { title: string }) => <div data-testid="header">{title}</div>,
}));

vi.mock("@/components/shared/FilterBar", () => ({
  FilterBar: () => <div data-testid="filter-bar" />,
}));

vi.mock("../components/CreateWizard/WizardContainer", () => ({
  CreateAssessmentWizard: () => <div data-testid="wizard" />,
}));

vi.mock("../components/AssessmentCard", () => ({
  AssessmentCard: ({ assessment }: { assessment: { name: string } }) => (
    <div data-testid="assessment-card">{assessment.name}</div>
  ),
}));

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;

const ws: Workspace = {
  id: "ws-1",
  name: "Engineering",
  description: "",
  members: [],
  created_at: "",
  updated_at: "",
  created_by: "user-1",
};

const mockUseParams = vi.fn(() => ({ workspaceId: "ws-1" }));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useParams: () => mockUseParams() };
});

beforeEach(() => {
  mockGet.mockReset();
  mockUseParams.mockReturnValue({ workspaceId: "ws-1" });
});

function makeAssessmentsResponse(items: { id: string; name: string }[] = []) {
  return {
    data: {
      data: {
        assessments: items.map((a) => ({
          id: a.id,
          name: a.name,
          description: "",
          workspace_id: "ws-1",
          time_limit: 60,
          monitoring_config: {},
          created_at: "",
          updated_at: "",
          rounds: [],
          share_link: "abc",
        })),
        pagination: { page: 1, page_size: 10, total: items.length, total_pages: 1 },
      },
    },
  };
}

describe("AssessmentsPage", () => {
  it("renders the header", async () => {
    mockGet.mockResolvedValue(makeAssessmentsResponse());
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
  });

  it("shows empty state when no assessments", async () => {
    mockGet.mockResolvedValue(makeAssessmentsResponse([]));
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    await waitFor(() => expect(screen.queryByTestId("assessment-card")).not.toBeInTheDocument());
  });

  it("renders assessment cards when data is loaded", async () => {
    mockGet.mockResolvedValue(
      makeAssessmentsResponse([
        { id: "a-1", name: "JS Test" },
        { id: "a-2", name: "Python Test" },
      ])
    );
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    await waitFor(() => expect(screen.getAllByTestId("assessment-card")).toHaveLength(2));
    expect(screen.getByText("JS Test")).toBeInTheDocument();
  });

  it("does not fetch when workspaceId is missing", () => {
    mockUseParams.mockReturnValue({ workspaceId: undefined as unknown as string });
    mockGet.mockResolvedValue(makeAssessmentsResponse());
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("handles API errors gracefully", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    // Should not crash
    await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
  });

  it("Create Assessment button opens wizard", async () => {
    mockGet.mockResolvedValue(makeAssessmentsResponse());
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /create assessment/i })).toBeInTheDocument()
    );
    await userEvent.click(screen.getByRole("button", { name: /create assessment/i }));
    await waitFor(() => expect(screen.getByTestId("wizard")).toBeInTheDocument());
  });

  it("shows loading spinner while fetching", async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderWithProviders(<AssessmentsPage />, {
      preloadedState: {
        auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
        workspace: { activeWorkspace: ws, workspaces: [ws] },
      },
    });
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
