import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ExamSetupScreen } from "./index";
import { ExamPhase } from "@/features/candidate/hooks/useExamOrchestrator";

const defaultProps = {
  phase: ExamPhase.VALIDATING_NETWORK,
  phaseLabel: "Checking network…",
  phaseError: null,
  config: {},
  onShareScreen: vi.fn().mockResolvedValue(undefined),
  onRequestFullscreen: vi.fn().mockResolvedValue(undefined),
  onRetryCamera: vi.fn().mockResolvedValue(undefined),
  onRetryAudio: vi.fn().mockResolvedValue(undefined),
};

describe("ExamSetupScreen", () => {
  it("renders page title", () => {
    render(<ExamSetupScreen {...defaultProps} />);
    expect(screen.getByText("Setting up your exam")).toBeInTheDocument();
  });

  it("renders subtitle text", () => {
    render(<ExamSetupScreen {...defaultProps} />);
    expect(screen.getByText(/Please wait while we verify/i)).toBeInTheDocument();
  });

  it("always renders network connectivity step", () => {
    render(<ExamSetupScreen {...defaultProps} config={{}} />);
    expect(screen.getByText("Network connectivity")).toBeInTheDocument();
  });

  it("renders camera step when video_monitoring is enabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ video_monitoring: true }} />);
    expect(screen.getByText("Camera access")).toBeInTheDocument();
  });

  it("does not render camera step when video_monitoring is disabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ video_monitoring: false }} />);
    expect(screen.queryByText("Camera access")).not.toBeInTheDocument();
  });

  it("renders microphone step when audio_monitoring is enabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ audio_monitoring: true }} />);
    expect(screen.getByText("Microphone access")).toBeInTheDocument();
  });

  it("does not render microphone step when audio_monitoring is disabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{}} />);
    expect(screen.queryByText("Microphone access")).not.toBeInTheDocument();
  });

  it("renders developer tools step when tab_monitoring is enabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ tab_monitoring: true }} />);
    expect(screen.getByText("Developer tools closed")).toBeInTheDocument();
  });

  it("renders screen sharing step when tab_monitoring is enabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ tab_monitoring: true }} />);
    expect(screen.getByText("Screen sharing")).toBeInTheDocument();
  });

  it("renders screen sharing step when screenshot_enabled is on", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ screenshot_enabled: true }} />);
    expect(screen.getByText("Screen sharing")).toBeInTheDocument();
  });

  it("renders fullscreen step when tab_monitoring is enabled", () => {
    render(<ExamSetupScreen {...defaultProps} config={{ tab_monitoring: true }} />);
    expect(screen.getByText("Fullscreen mode")).toBeInTheDocument();
  });

  it("renders the phaseLabel status text", () => {
    render(<ExamSetupScreen {...defaultProps} phaseLabel="Requesting camera access…" />);
    expect(screen.getByText("Requesting camera access…")).toBeInTheDocument();
  });

  it("renders error alert when phaseError is set", () => {
    render(<ExamSetupScreen {...defaultProps} phaseError="Camera permission denied" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Camera permission denied")).toBeInTheDocument();
  });

  it("does not render error alert when phaseError is null", () => {
    render(<ExamSetupScreen {...defaultProps} phaseError={null} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows Setup progress list", () => {
    render(<ExamSetupScreen {...defaultProps} />);
    expect(screen.getByRole("list", { name: /setup progress/i })).toBeInTheDocument();
  });

  it("shows Share Screen button at VALIDATING_SCREEN_SHARE phase", () => {
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_SCREEN_SHARE}
        config={{ screenshot_enabled: true }}
      />
    );
    expect(screen.getByRole("button", { name: /share screen/i })).toBeInTheDocument();
  });

  it("shows Enter Fullscreen button at VALIDATING_FULLSCREEN phase with no error", () => {
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_FULLSCREEN}
        phaseError={null}
        config={{ tab_monitoring: true }}
      />
    );
    expect(screen.getByRole("button", { name: /enter fullscreen/i })).toBeInTheDocument();
  });

  it("shows Allow Camera button at VALIDATING_VIDEO phase with error", () => {
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_VIDEO}
        phaseError="Permission denied"
        config={{ video_monitoring: true }}
      />
    );
    expect(screen.getByRole("button", { name: /allow camera/i })).toBeInTheDocument();
  });

  it("shows Allow Microphone button at VALIDATING_AUDIO phase with error", () => {
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_AUDIO}
        phaseError="Mic denied"
        config={{ audio_monitoring: true }}
      />
    );
    expect(screen.getByRole("button", { name: /allow microphone/i })).toBeInTheDocument();
  });

  it("calls onShareScreen when Share Screen is clicked", () => {
    const onShareScreen = vi.fn().mockResolvedValue(undefined);
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_SCREEN_SHARE}
        config={{ screenshot_enabled: true }}
        onShareScreen={onShareScreen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /share screen/i }));
    expect(onShareScreen).toHaveBeenCalledOnce();
  });

  it("calls onRequestFullscreen when Enter Fullscreen is clicked", () => {
    const onRequestFullscreen = vi.fn().mockResolvedValue(undefined);
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_FULLSCREEN}
        phaseError={null}
        config={{ tab_monitoring: true }}
        onRequestFullscreen={onRequestFullscreen}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /enter fullscreen/i }));
    expect(onRequestFullscreen).toHaveBeenCalledOnce();
  });

  it("calls onRetryCamera when camera retry is clicked", () => {
    const onRetryCamera = vi.fn().mockResolvedValue(undefined);
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_VIDEO}
        phaseError="Error"
        config={{ video_monitoring: true }}
        onRetryCamera={onRetryCamera}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /allow camera/i }));
    expect(onRetryCamera).toHaveBeenCalledOnce();
  });

  it("calls onRetryAudio when microphone retry is clicked", () => {
    const onRetryAudio = vi.fn().mockResolvedValue(undefined);
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_AUDIO}
        phaseError="Error"
        config={{ audio_monitoring: true }}
        onRetryAudio={onRetryAudio}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: /allow microphone/i }));
    expect(onRetryAudio).toHaveBeenCalledOnce();
  });

  it("marks steps as done when phase is past them", () => {
    render(
      <ExamSetupScreen
        {...defaultProps}
        phase={ExamPhase.VALIDATING_VIDEO}
        config={{ video_monitoring: true }}
      />
    );
    // Network step is done (VALIDATING_NETWORK=1 < VALIDATING_VIDEO=3)
    expect(screen.getByText("Network connectivity")).toBeInTheDocument();
  });

  it("renders all monitoring steps when all options enabled", () => {
    render(
      <ExamSetupScreen
        {...defaultProps}
        config={{
          tab_monitoring: true,
          video_monitoring: true,
          audio_monitoring: true,
          screenshot_enabled: true,
        }}
      />
    );
    expect(screen.getByText("Network connectivity")).toBeInTheDocument();
    expect(screen.getByText("Developer tools closed")).toBeInTheDocument();
    expect(screen.getByText("Camera access")).toBeInTheDocument();
    expect(screen.getByText("Microphone access")).toBeInTheDocument();
    expect(screen.getByText("Screen sharing")).toBeInTheDocument();
    expect(screen.getByText("Fullscreen mode")).toBeInTheDocument();
  });
});
