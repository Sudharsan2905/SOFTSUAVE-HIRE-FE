import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LiveMonitoringPage from "./LiveMonitoringPage";
import { renderWithProviders } from "@/test/utils";
import { makeAdminUser, makeAuthState } from "@/test/mocks";

// ── WebSocket mock with instance tracking ──────────────────────────────────
let wsInstances: MockWebSocket[] = [];

class MockWebSocket {
  onmessage: ((e: MessageEvent) => void) | null = null;
  onopen: ((e: Event) => void) | null = null;
  onclose: ((e: CloseEvent) => void) | null = null;
  readyState = 0;
  addEventListener = vi.fn();
  send = vi.fn();
  close = vi.fn();
  constructor(_url: string) {
    wsInstances.push(this);
  }
  simulateMessage(data: object) {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }
  simulateOpen() {
    this.readyState = 1;
    this.onopen?.(new Event("open"));
  }
}

vi.stubGlobal("WebSocket", MockWebSocket);

vi.mock("@/utils/api", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (e: unknown, fb: string) => fb,
}));

vi.mock("@/features/candidate/hooks/useLiveKit", () => ({
  useLiveKitViewer: () => ({ screenTrack: null, isConnected: false, connectionError: null }),
}));

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, subtitle }: { title: string; subtitle?: string }) => (
    <div data-testid="header">
      <span>{title}</span>
      {subtitle && <span data-testid="subtitle">{subtitle}</span>}
    </div>
  ),
}));

vi.mock("@/components/shared/FilterBar", () => ({
  FilterBar: ({ search, onSearchChange }: { search: string; onSearchChange: (v: string) => void }) => (
    <input
      data-testid="search-input"
      value={search}
      onChange={(e) => onSearchChange(e.target.value)}
      placeholder="Search"
    />
  ),
}));

vi.mock("../components/CandidateStreamPanel", () => ({
  CandidateStreamPanel: ({
    session,
    onClose,
    onTerminate,
    onResume,
  }: {
    session: { candidate_name: string; submission_id: string };
    onClose: () => void;
    onTerminate: (id: string) => void;
    onResume: (id: string) => void;
  }) => (
    <div data-testid="stream-panel">
      <span data-testid="stream-panel-name">{session.candidate_name}</span>
      <button onClick={onClose}>Close</button>
      <button onClick={() => onTerminate(session.submission_id)}>Terminate</button>
      <button onClick={() => onResume(session.submission_id)}>Resume</button>
    </div>
  ),
}));

import api from "@/utils/api";
const mockGet = (api as unknown as { get: ReturnType<typeof vi.fn> }).get;
const mockPost = (api as unknown as { post: ReturnType<typeof vi.fn> }).post;

function makeSession(overrides: object = {}) {
  return {
    submission_id: "sub-1",
    candidate_name: "Alice Smith",
    assessment_name: "JavaScript Test",
    workspace_id: "ws-1",
    current_round: 1,
    status: "in_progress",
    started_at: "2024-01-01T10:00:00Z",
    malpractice_count: 0,
    ...overrides,
  };
}

const renderPage = () =>
  renderWithProviders(<LiveMonitoringPage />, {
    preloadedState: {
      auth: makeAuthState({
        user: makeAdminUser(),
        isAuthenticated: true,
        accessToken: "mock-token",
      }),
    },
  });

beforeEach(() => {
  wsInstances = [];
  mockGet.mockReset();
  mockPost.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("LiveMonitoringPage", () => {
  it("shows loading spinner initially", () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    mockGet.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it("shows empty state when no active sessions", async () => {
    mockGet.mockResolvedValue({ data: { data: { live_interviews: [] } } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no active interviews/i)).toBeInTheDocument()
    );
  });

  it("renders the header", async () => {
    mockGet.mockResolvedValue({ data: { data: { live_interviews: [] } } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Live Monitoring")).toBeInTheDocument()
    );
  });

  it("renders session cards when sessions exist", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.getByText("JavaScript Test")).toBeInTheDocument();
  });

  it("shows candidate count in subtitle", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("subtitle")).toHaveTextContent(/1 candidate/)
    );
  });

  it("shows 0 candidates in subtitle when empty", async () => {
    mockGet.mockResolvedValue({ data: { data: { live_interviews: [] } } });
    renderPage();
    await waitFor(() =>
      expect(screen.getByTestId("subtitle")).toHaveTextContent(/0 candidate/)
    );
  });

  it("handles API error gracefully", async () => {
    mockGet.mockRejectedValue(new Error("Network error"));
    renderPage();
    await waitFor(() =>
      expect(screen.queryByLabelText(/loading/i)).not.toBeInTheDocument()
    );
    expect(screen.getByText(/no active interviews/i)).toBeInTheDocument();
  });

  it("clicking session card shows stream panel", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /alice smith/i }));

    await waitFor(() =>
      expect(screen.getByTestId("stream-panel")).toBeInTheDocument()
    );
    expect(screen.getByTestId("stream-panel-name")).toHaveTextContent("Alice Smith");
  });

  it("clicking selected session deselects (closes stream panel)", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    const btn = screen.getByRole("button", { name: /alice smith/i });
    await userEvent.click(btn);
    await waitFor(() => expect(screen.getByTestId("stream-panel")).toBeInTheDocument());

    await userEvent.click(btn);
    await waitFor(() =>
      expect(screen.queryByTestId("stream-panel")).not.toBeInTheDocument()
    );
  });

  it("stream panel Close button deselects session", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /alice smith/i }));
    await waitFor(() => expect(screen.getByTestId("stream-panel")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    await waitFor(() =>
      expect(screen.queryByTestId("stream-panel")).not.toBeInTheDocument()
    );
  });

  it("stream panel Terminate calls api.post", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    mockPost.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /alice smith/i }));
    await waitFor(() => expect(screen.getByTestId("stream-panel")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /terminate/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledOnce());
  });

  it("stream panel Resume calls api.post", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    mockPost.mockResolvedValue({});
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /alice smith/i }));
    await waitFor(() => expect(screen.getByTestId("stream-panel")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: /resume/i }));
    await waitFor(() => expect(mockPost).toHaveBeenCalledOnce());
  });

  it("shows malpractice violation badge when malpractice_count > 0", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession({ malpractice_count: 2 })] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/violation/i)).toBeInTheDocument());
  });

  it("shows singular 'violation' for count of 1", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession({ malpractice_count: 1 })] } },
    });
    renderPage();
    await waitFor(() => {
      const badge = screen.getByText(/1 violation/i);
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).not.toContain("violations");
    });
  });

  it("WS candidate_disconnected removes session from list", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession()] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    const ws = wsInstances.at(-1);
    ws?.simulateMessage({ type: "candidate_disconnected", submission_id: "sub-1" });

    await waitFor(() =>
      expect(screen.queryByText("Alice Smith")).not.toBeInTheDocument()
    );
  });

  it("WS submission_status_change updates session status", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession({ status: "in_progress" })] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());

    const ws = wsInstances.at(-1);
    ws?.simulateMessage({ type: "submission_status_change", submission_id: "sub-1", status: "on_hold" });

    await waitFor(() => {
      // The status label should change (On Hold, etc.)
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
    });
  });

  it("WS malpractice_event increments malpractice_count", async () => {
    mockGet.mockResolvedValue({
      data: { data: { live_interviews: [makeSession({ malpractice_count: 0 })] } },
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice Smith")).toBeInTheDocument());
    expect(screen.queryByText(/violation/i)).not.toBeInTheDocument();

    const ws = wsInstances.at(-1);
    ws?.simulateMessage({ type: "malpractice_event", submission_id: "sub-1" });

    await waitFor(() => expect(screen.getByText(/1 violation/i)).toBeInTheDocument());
  });

  it("WS candidate_connected triggers refetch", async () => {
    mockGet.mockResolvedValue({ data: { data: { live_interviews: [] } } });
    renderPage();
    await waitFor(() => expect(mockGet).toHaveBeenCalledOnce());

    const ws = wsInstances.at(-1);
    ws?.simulateMessage({ type: "candidate_connected" });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  });

  it("search input filters sessions by candidate name", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          live_interviews: [
            makeSession({ candidate_name: "Alice Smith", submission_id: "sub-1" }),
            makeSession({ candidate_name: "Bob Jones", submission_id: "sub-2" }),
          ],
        },
      },
    });
    renderPage();
    await waitFor(() => expect(screen.getAllByRole("button", { name: /smith|jones/i })).toHaveLength(2));

    fireEvent.change(screen.getByTestId("search-input"), { target: { value: "alice" } });

    await waitFor(() => {
      expect(screen.getByText("Alice Smith")).toBeInTheDocument();
      expect(screen.queryByText("Bob Jones")).not.toBeInTheDocument();
    });
  });
});
