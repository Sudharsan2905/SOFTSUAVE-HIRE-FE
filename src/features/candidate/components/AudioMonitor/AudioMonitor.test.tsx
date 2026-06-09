import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React, { createRef } from "react";
import { AudioMonitor } from "./index";

// ── CSS module stub ──────────────────────────────────────────────────────────
vi.mock("./AudioMonitor.module.css", () => ({
  default: {
    container: "container",
    sectionTitle: "sectionTitle",
    activeDot: "activeDot",
    waveWrapper: "waveWrapper",
    canvas: "canvas",
  },
}));

// ── Icon stub ────────────────────────────────────────────────────────────────
vi.mock("@/assets/icons", () => ({
  IconMic: ({ size, color }: { size?: number; color?: string }) => (
    <svg data-testid="icon-mic" data-size={size} data-color={color} />
  ),
}));

// ── Canvas + rAF stubs ───────────────────────────────────────────────────────
let rafCallback: FrameRequestCallback | null = null;

beforeEach(() => {
  rafCallback = null;

  vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(
    (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    }
  );
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});

  // Provide a minimal canvas 2D context stub
  HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fill: vi.fn(),
    roundRect: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    set strokeStyle(_: unknown) {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    set lineWidth(_: unknown) {},
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    set fillStyle(_: unknown) {},
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAnalyserRef(overrides?: Partial<AnalyserNode>) {
  const ref = createRef<AnalyserNode | null>() as React.MutableRefObject<AnalyserNode | null>;
  ref.current = {
    frequencyBinCount: 64,
    getByteFrequencyData: vi.fn((arr: Uint8Array) => {
      arr.fill(128);
    }),
    ...overrides,
  } as unknown as AnalyserNode;
  return ref;
}

function makeNullAnalyserRef() {
  const ref = createRef<AnalyserNode | null>() as React.MutableRefObject<AnalyserNode | null>;
  ref.current = null;
  return ref;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AudioMonitor", () => {
  describe("Rendering", () => {
    it("renders the Audio label", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      expect(screen.getByText("Audio")).toBeInTheDocument();
    });

    it("renders the mic icon", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      expect(screen.getByTestId("icon-mic")).toBeInTheDocument();
    });

    it("renders a <canvas> element", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      expect(document.querySelector("canvas")).toBeInTheDocument();
    });

    it("canvas has the correct width and height attributes", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      const canvas = document.querySelector("canvas")!;
      expect(canvas.getAttribute("width")).toBe("200");
      expect(canvas.getAttribute("height")).toBe("48");
    });
  });

  describe("Active dot", () => {
    it("does NOT render the active dot when active=false", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      expect(screen.queryByLabelText("Microphone active")).not.toBeInTheDocument();
    });

    it("renders the active dot when active=true", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={true} />);
      expect(screen.getByLabelText("Microphone active")).toBeInTheDocument();
    });
  });

  describe("Animation loop", () => {
    it("calls requestAnimationFrame on mount", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      expect(requestAnimationFrame).toHaveBeenCalled();
    });

    it("calls cancelAnimationFrame on unmount", () => {
      const ref = makeNullAnalyserRef();
      const { unmount } = render(<AudioMonitor analyserRef={ref} active={false} />);
      unmount();
      expect(cancelAnimationFrame).toHaveBeenCalled();
    });

    it("schedules another frame after each draw tick (idle path)", () => {
      const ref = makeNullAnalyserRef();
      render(<AudioMonitor analyserRef={ref} active={false} />);
      const callsBefore = (requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length;
      // Fire one animation frame manually
      act(() => {
        if (rafCallback) rafCallback(0);
      });
      const callsAfter = (requestAnimationFrame as ReturnType<typeof vi.fn>).mock.calls.length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });

    it("calls getByteFrequencyData when analyser is present and active", () => {
      const analyser = {
        frequencyBinCount: 64,
        getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(200)),
      } as unknown as AnalyserNode;
      const ref = makeAnalyserRef();
      ref.current = analyser;

      render(<AudioMonitor analyserRef={ref} active={true} />);
      act(() => {
        if (rafCallback) rafCallback(0);
      });
      expect(analyser.getByteFrequencyData).toHaveBeenCalled();
    });

    it("does NOT call getByteFrequencyData when active=false even if analyser exists", () => {
      const analyser = {
        frequencyBinCount: 64,
        getByteFrequencyData: vi.fn((arr: Uint8Array) => arr.fill(200)),
      } as unknown as AnalyserNode;
      const ref = makeAnalyserRef();
      ref.current = analyser;

      render(<AudioMonitor analyserRef={ref} active={false} />);
      act(() => {
        if (rafCallback) rafCallback(0);
      });
      // In the idle path (analyser exists but active=false) getByteFrequencyData is NOT called
      expect(analyser.getByteFrequencyData).not.toHaveBeenCalled();
    });
  });

  describe("Re-render on prop changes", () => {
    it("shows active dot after re-render with active=true", () => {
      const ref = makeNullAnalyserRef();
      const { rerender } = render(<AudioMonitor analyserRef={ref} active={false} />);
      expect(screen.queryByLabelText("Microphone active")).not.toBeInTheDocument();

      rerender(<AudioMonitor analyserRef={ref} active={true} />);
      expect(screen.getByLabelText("Microphone active")).toBeInTheDocument();
    });

    it("hides active dot after re-render with active=false", () => {
      const ref = makeNullAnalyserRef();
      const { rerender } = render(<AudioMonitor analyserRef={ref} active={true} />);
      expect(screen.getByLabelText("Microphone active")).toBeInTheDocument();

      rerender(<AudioMonitor analyserRef={ref} active={false} />);
      expect(screen.queryByLabelText("Microphone active")).not.toBeInTheDocument();
    });
  });
});
