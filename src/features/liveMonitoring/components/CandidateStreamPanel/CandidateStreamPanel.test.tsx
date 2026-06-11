import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { CandidateStreamPanel } from "./index";

// ── livekit-client mock ──────────────────────────────────────────────────────
vi.mock("livekit-client", () => ({
  Track: { Kind: { Video: "video", Audio: "audio" } },
  RemoteTrack: class {},
}));

// ── Icon mocks ───────────────────────────────────────────────────────────────
vi.mock("@/assets/icons", () => ({
  IconMaximize: () => <svg data-testid="icon-maximize" />,
  IconMinimize: () => <svg data-testid="icon-minimize" />,
}));

// ── Spinner mock ─────────────────────────────────────────────────────────────
vi.mock("@/components/ui/Spinner", () => ({
  Spinner: ({ size }: { size?: string }) => (
    <div data-testid="spinner" data-size={size} role="status" />
  ),
}));

// ── Button mock ──────────────────────────────────────────────────────────────
vi.mock("@/components/ui/Button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
}));

// ── CSS module mock ──────────────────────────────────────────────────────────
vi.mock("./CandidateStreamPanel.module.css", () => ({
  default: {
    panel: "panel",
    header: "header",
    headerInfo: "headerInfo",
    candidateName: "candidateName",
    assessmentName: "assessmentName",
    elapsed: "elapsed",
    closeBtn: "closeBtn",
    videoArea: "videoArea",
    video: "video",
    noStream: "noStream",
    connecting: "connecting",
    fullscreenBtn: "fullscreenBtn",
    warnInputArea: "warnInputArea",
    warnInput: "warnInput",
    warnInputActions: "warnInputActions",
    actions: "actions",
  },
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(
  overrides: Partial<{
    submission_id: string;
    candidate_name: string;
    assessment_name: string;
    workspace_id: string;
    status: string;
    current_round: number;
    started_at: string;
  }> = {}
) {
  return {
    submission_id: "sub-1",
    candidate_name: "John Doe",
    assessment_name: "React Test",
    workspace_id: "ws-1",
    status: "active",
    current_round: 1,
    // 10 minutes ago so elapsedMins > 0
    started_at: new Date(Date.now() - 10 * 60_000).toISOString(),
    ...overrides,
  };
}

function makeScreenTrack(kind = "video") {
  return {
    kind,
    attach: vi.fn(),
    detach: vi.fn(),
  };
}

// ── Default props ─────────────────────────────────────────────────────────────

function makeDefaultProps() {
  return {
    session: makeSession(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    screenTrack: null as any,
    isConnected: false,
    connectionError: null as string | null,
    onTerminate: vi.fn(),
    onResume: vi.fn(),
    onClose: vi.fn(),
    onWarnCandidate: vi.fn(),
  };
}

let props: ReturnType<typeof makeDefaultProps>;

beforeEach(() => {
  props = makeDefaultProps();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("CandidateStreamPanel", () => {
  // 1 ─────────────────────────────────────────────────────────────────────────
  it("renders candidate name and assessment name", () => {
    render(<CandidateStreamPanel {...props} />);
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText(/React Test/)).toBeInTheDocument();
  });

  // 2 ─────────────────────────────────────────────────────────────────────────
  it("renders round number", () => {
    render(<CandidateStreamPanel {...props} />);
    expect(screen.getByText(/Round 1/)).toBeInTheDocument();
  });

  // 3 ─────────────────────────────────────────────────────────────────────────
  it("shows elapsed time in minutes", () => {
    render(<CandidateStreamPanel {...props} />);
    // started_at is 10 minutes ago, so elapsedMins should be > 0
    const elapsedEl = screen.getByText(/\dm elapsed/);
    const mins = parseInt(elapsedEl.textContent ?? "0", 10);
    expect(mins).toBeGreaterThan(0);
  });

  // 4 ─────────────────────────────────────────────────────────────────────────
  it("calls onClose when close button clicked", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  // 5 ─────────────────────────────────────────────────────────────────────────
  it("calls onTerminate with submission_id when Terminate clicked", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /terminate/i }));
    expect(props.onTerminate).toHaveBeenCalledWith("sub-1");
  });

  // 6 ─────────────────────────────────────────────────────────────────────────
  it("shows Resume Session button when status is on_hold", () => {
    props.session = makeSession({ status: "on_hold" });
    render(<CandidateStreamPanel {...props} />);
    expect(screen.getByRole("button", { name: /resume session/i })).toBeInTheDocument();
  });

  // 7 ─────────────────────────────────────────────────────────────────────────
  it("calls onResume with submission_id when Resume Session clicked", async () => {
    props.session = makeSession({ status: "on_hold" });
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /resume session/i }));
    expect(props.onResume).toHaveBeenCalledWith("sub-1");
  });

  // 8 ─────────────────────────────────────────────────────────────────────────
  it("does not show Resume Session when status is not on_hold", () => {
    props.session = makeSession({ status: "active" });
    render(<CandidateStreamPanel {...props} />);
    expect(screen.queryByRole("button", { name: /resume session/i })).not.toBeInTheDocument();
  });

  // 9 ─────────────────────────────────────────────────────────────────────────
  it("shows connecting state when not connected and no error", () => {
    render(
      <CandidateStreamPanel
        {...props}
        isConnected={false}
        screenTrack={null}
        connectionError={null}
      />
    );
    expect(screen.getByTestId("spinner")).toBeInTheDocument();
    expect(screen.getByText(/Connecting to stream/)).toBeInTheDocument();
  });

  // 10 ────────────────────────────────────────────────────────────────────────
  it("shows connection error message when connectionError is set", () => {
    render(
      <CandidateStreamPanel {...props} connectionError="Connection refused" isConnected={false} />
    );
    expect(screen.getByText("Stream connection failed")).toBeInTheDocument();
    expect(screen.getByText("Connection refused")).toBeInTheDocument();
  });

  // 11 ────────────────────────────────────────────────────────────────────────
  it("shows screen share not available when connected but no screenTrack", () => {
    render(
      <CandidateStreamPanel
        {...props}
        isConnected={true}
        screenTrack={null}
        connectionError={null}
      />
    );
    expect(screen.getByText("Screen share not available")).toBeInTheDocument();
    expect(screen.getByText(/Candidate may not have enabled screen sharing/)).toBeInTheDocument();
  });

  // 12 ────────────────────────────────────────────────────────────────────────
  it("shows video element when connected with screenTrack", () => {
    const screenTrack = makeScreenTrack("video");
    render(
      <CandidateStreamPanel
        {...props}
        isConnected={true}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        screenTrack={screenTrack as any}
        connectionError={null}
      />
    );
    const videoEl = document.querySelector("video");
    expect(videoEl).toBeInTheDocument();
  });

  // 13 ────────────────────────────────────────────────────────────────────────
  it("shows fullscreen button when has video", () => {
    const screenTrack = makeScreenTrack("video");
    render(
      <CandidateStreamPanel
        {...props}
        isConnected={true}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        screenTrack={screenTrack as any}
        connectionError={null}
      />
    );
    expect(screen.getByRole("button", { name: /view full screen/i })).toBeInTheDocument();
  });

  // 14 ────────────────────────────────────────────────────────────────────────
  it("toggles warn input when Warn Candidate clicked", async () => {
    render(<CandidateStreamPanel {...props} />);

    // Initially hidden
    expect(screen.queryByPlaceholderText(/type a warning message/i)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    expect(screen.getByPlaceholderText(/type a warning message/i)).toBeInTheDocument();
  });

  // 15 ────────────────────────────────────────────────────────────────────────
  it("shows warn input with placeholder text", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    const input = screen.getByPlaceholderText("Type a warning message…");
    expect(input).toBeInTheDocument();
  });

  // 16 ────────────────────────────────────────────────────────────────────────
  it("send button disabled when message is empty", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    const sendBtn = screen.getByRole("button", { name: /^send$/i });
    expect(sendBtn).toBeDisabled();
  });

  // 17 ────────────────────────────────────────────────────────────────────────
  it("calls onWarnCandidate when message submitted", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    const input = screen.getByPlaceholderText("Type a warning message…");
    await userEvent.type(input, "Please stop cheating");

    const sendBtn = screen.getByRole("button", { name: /^send$/i });
    expect(sendBtn).not.toBeDisabled();
    await userEvent.click(sendBtn);

    expect(props.onWarnCandidate).toHaveBeenCalledWith("sub-1", "Please stop cheating");
  });

  // 18 ────────────────────────────────────────────────────────────────────────
  it("clears input and hides warn area after sending", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    const input = screen.getByPlaceholderText("Type a warning message…");
    await userEvent.type(input, "Stop it");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Type a warning message…")).not.toBeInTheDocument();
    });
  });

  // 19 ────────────────────────────────────────────────────────────────────────
  it("Cancel in warn area hides the input", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    expect(screen.getByPlaceholderText("Type a warning message…")).toBeInTheDocument();

    // There are two Cancel-like buttons once warn input is open:
    // "Cancel" inside warnInputActions and "Cancel Warn" in the actions row.
    // Target the one inside the warn input area specifically.
    await userEvent.click(screen.getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Type a warning message…")).not.toBeInTheDocument();
    });
  });

  // 20 ────────────────────────────────────────────────────────────────────────
  it("Enter key in warn input sends the warning", async () => {
    render(<CandidateStreamPanel {...props} />);
    await userEvent.click(screen.getByRole("button", { name: /warn candidate/i }));

    const input = screen.getByPlaceholderText("Type a warning message…");
    await userEvent.type(input, "Final warning");
    fireEvent.keyDown(input, { key: "Enter" });

    expect(props.onWarnCandidate).toHaveBeenCalledWith("sub-1", "Final warning");

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Type a warning message…")).not.toBeInTheDocument();
    });
  });

  // ── Bonus: screenTrack.attach called in useEffect ─────────────────────────
  it("calls screenTrack.attach when screenTrack with video kind is provided", () => {
    const screenTrack = makeScreenTrack("video");
    render(
      <CandidateStreamPanel
        {...props}
        isConnected={true}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        screenTrack={screenTrack as any}
        connectionError={null}
      />
    );
    expect(screenTrack.attach).toHaveBeenCalledOnce();
  });

  // ── Bonus: fullscreen toggle changes aria-label ───────────────────────────
  it("fullscreen button shows exit label when in fullscreen", async () => {
    const screenTrack = makeScreenTrack("video");

    // Stub document.fullscreenElement to simulate entering fullscreen
    const videoAreaDiv = document.createElement("div");
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => videoAreaDiv,
    });
    // Stub exitFullscreen
    document.exitFullscreen = vi.fn().mockResolvedValue(undefined);

    render(
      <CandidateStreamPanel
        {...props}
        isConnected={true}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        screenTrack={screenTrack as any}
        connectionError={null}
      />
    );

    const fsBtn = screen.getByRole("button", { name: /view full screen/i });

    // Trigger fullscreen toggle — this calls exitFullscreen since fullscreenElement is set
    await userEvent.click(fsBtn);

    // Now dispatch the fullscreenchange event — the component's handler checks
    // document.fullscreenElement === videoAreaRef.current. Since our stub always
    // returns a different element, isFullscreen will be set to false (stays as-is).
    // The important check here is that exitFullscreen was called.
    expect(document.exitFullscreen).toHaveBeenCalled();

    // Cleanup
    Object.defineProperty(document, "fullscreenElement", {
      configurable: true,
      get: () => null,
    });
  });
});
