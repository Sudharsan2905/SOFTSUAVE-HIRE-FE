import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import CandidateDetailsPage from "./CandidateDetailsPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState } from "@/test/mocks";

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, actions }: { title: string; actions?: React.ReactNode }) => (
    <div data-testid="header">
      <span>{title}</span>
      {actions}
    </div>
  ),
}));

vi.mock("@/features/candidate/components/CandidateDetailsTabs", () => ({
  CandidateDetailsTabs: () => <div data-testid="candidate-tabs" />,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ workspaceId: "ws-1", assessmentId: "assess-1", candidateId: "cand-1" }),
  };
});

import { api } from "@/utils/api";
const mockGet = api.get as ReturnType<typeof vi.fn>;

function makeCandidateData() {
  return {
    candidate: {
      id: "cand-1",
      first_name: "Alice",
      last_name: "Smith",
      email: "alice@example.com",
      phone: "+1234567890",
      gender: "female",
      location: "New York",
    },
    available_versions: [{ version: 1 }, { version: 2 }],
    rounds: [],
    submission: { id: "sub-1", status: "completed" },
  };
}

const renderPage = () =>
  renderWithProviders(<CandidateDetailsPage />, {
    preloadedState: {
      auth: makeAuthState({ user: makeAdminUser(), isAuthenticated: true }),
    },
  });

beforeEach(() => {
  mockGet.mockReset();
  mockNavigate.mockReset();
});

describe("CandidateDetailsPage", () => {
  it("shows loading spinner initially", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    mockGet.mockRejectedValue(new Error("Not found"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/failed to load|not found/i)).toBeInTheDocument()
    );
  });

  it("renders candidate name after load", async () => {
    mockGet.mockResolvedValue({ data: { data: makeCandidateData() } });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
  });

  it("renders the header", async () => {
    mockGet.mockResolvedValue({ data: { data: makeCandidateData() } });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("header")).toBeInTheDocument());
    expect(screen.getByTestId("header")).toHaveTextContent("Candidate Details");
  });

  it("renders candidate email", async () => {
    mockGet.mockResolvedValue({ data: { data: makeCandidateData() } });
    renderPage();
    await waitFor(() => expect(screen.getByText("alice@example.com")).toBeInTheDocument());
  });

  it("renders CandidateDetailsTabs", async () => {
    mockGet.mockResolvedValue({ data: { data: makeCandidateData() } });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("candidate-tabs")).toBeInTheDocument());
  });

  it("renders version selector button", async () => {
    mockGet.mockResolvedValue({ data: { data: makeCandidateData() } });
    renderPage();
    // Version selector uses a custom button Select; "Latest" is the first option
    await waitFor(() => expect(screen.getByText("Latest")).toBeInTheDocument());
  });

  it("navigates back when back button is clicked", async () => {
    mockGet.mockResolvedValue({ data: { data: makeCandidateData() } });
    renderPage();
    await waitFor(() => expect(screen.getByText(/back to assessment/i)).toBeInTheDocument());
    screen.getByText(/back to assessment/i).closest("button")?.click();
    expect(mockNavigate).toHaveBeenCalled();
  });
});
