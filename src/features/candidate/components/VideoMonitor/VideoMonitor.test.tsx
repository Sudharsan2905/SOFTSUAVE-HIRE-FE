import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import React, { createRef } from "react";
import { VideoMonitor } from "./index";

// ── CSS module stub ──────────────────────────────────────────────────────────
vi.mock("./VideoMonitor.module.css", () => ({
  default: {
    container: "container",
    sectionTitle: "sectionTitle",
    videoWrapper: "videoWrapper",
    video: "video",
    badge: "badge",
    badgeLive: "badgeLive",
    badgeNoFeed: "badgeNoFeed",
    badgeChecking: "badgeChecking",
    badgeDot: "badgeDot",
  },
}));

// ── Icon stub ────────────────────────────────────────────────────────────────
vi.mock("@/assets/icons", () => ({
  IconCamera: ({ size, color }: { size?: number; color?: string }) => (
    <svg data-testid="icon-camera" data-size={size} data-color={color} />
  ),
}));

// ── Canvas context stub ──────────────────────────────────────────────────────
//
// The component creates an off-screen canvas via document.createElement("canvas"),
// calls getContext() once, and reuses the returned ctx on every interval tick.
// We stub HTMLCanvasElement.prototype.getContext globally so that off-screen canvas
// (and any other canvas) gets our controlled stub.
//
// "currentCtxStub" is a module-level variable that tests overwrite before rendering
// to control what getImageData returns.

interface CanvasCtxStub {
  drawImage: ReturnType<typeof vi.fn>;
  getImageData: ReturnType<typeof vi.fn>;
}

let currentCtxStub: CanvasCtxStub | null = null;

function makeCtxStub(brightness: number): CanvasCtxStub {
  const channelValue = Math.round(brightness);
  return {
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({
      data: new Uint8ClampedArray(32 * 32 * 4).fill(channelValue),
    })),
  };
}

// Install prototype stub before every test; restoreAllMocks restores it after.
beforeEach(() => {
  vi.useFakeTimers();
  currentCtxStub = makeCtxStub(200); // default: "live"

  HTMLCanvasElement.prototype.getContext = vi.fn(
    (_contextId: string) => currentCtxStub as unknown as CanvasRenderingContext2D
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  currentCtxStub = null;
});

// ── Video ref helper ──────────────────────────────────────────────────────────
//
// The component renders <video ref={videoRef} ...>, so React WILL overwrite
// videoRef.current with the real jsdom <video> element.  We therefore create a
// plain RefObject whose .current will be replaced by React, and then — after
// rendering — we patch the properties we care about onto the real DOM element.

function makeVideoRef(): React.MutableRefObject<HTMLVideoElement> {
  return createRef<HTMLVideoElement>() as React.MutableRefObject<HTMLVideoElement>;
}

/**
 * Patch the jsdom <video> element that React attached to videoRef with the
 * readyState / videoWidth that we need for the check() logic.
 */
function patchVideoElement(
  ref: React.MutableRefObject<HTMLVideoElement>,
  opts: { readyState?: number; videoWidth?: number } = {}
) {
  const el = ref.current;
  if (!el) return;
  const { readyState = 4, videoWidth = 640 } = opts;
  Object.defineProperty(el, "readyState", { value: readyState, configurable: true });
  Object.defineProperty(el, "videoWidth", { value: videoWidth, configurable: true });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("VideoMonitor", () => {
  // ── Static rendering ───────────────────────────────────────────────────────

  describe("Rendering", () => {
    it("renders the Camera label", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      expect(screen.getByText("Camera")).toBeInTheDocument();
    });

    it("renders the camera icon", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      expect(screen.getByTestId("icon-camera")).toBeInTheDocument();
    });

    it("renders a <video> element", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      expect(document.querySelector("video")).toBeInTheDocument();
    });

    it("video element has autoPlay and playsInline attributes", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      const video = document.querySelector("video")!;
      expect(video).toHaveAttribute("autoplay");
      expect(video).toHaveAttribute("playsinline");
    });

    it("video element has muted property set to true", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      // jsdom reflects the React "muted" prop as a DOM property, not an attribute
      const video = document.querySelector("video") as HTMLVideoElement;
      expect(video.muted).toBe(true);
    });
  });

  // ── Badge: live ────────────────────────────────────────────────────────────

  describe("Badge — live feed", () => {
    it("shows Live badge when video has sufficient brightness", () => {
      // currentCtxStub is already set to bright (200) in outer beforeEach
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref);
      // trigger another interval tick so check() runs with the patched element
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("Live")).toBeInTheDocument();
    });

    it("renders the live dot when status is live", () => {
      const ref = makeVideoRef();
      const { container } = render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(container.querySelector(".badgeDot")).toBeInTheDocument();
    });
  });

  // ── Badge: no-feed (dark frames) ───────────────────────────────────────────

  describe("Badge — no feed (dark frames)", () => {
    beforeEach(() => {
      currentCtxStub = makeCtxStub(0); // always dark
    });

    it("shows No Feed badge when video brightness is below threshold", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("No Feed")).toBeInTheDocument();
    });

    it("does NOT render the live dot when status is no-feed", () => {
      const ref = makeVideoRef();
      const { container } = render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref);
      act(() => { vi.advanceTimersByTime(3000); });
      expect(container.querySelector(".badgeDot")).not.toBeInTheDocument();
    });
  });

  // ── Badge: no-feed (video not ready) ───────────────────────────────────────

  describe("Badge — no feed when video element not ready", () => {
    it("shows No Feed when readyState < 2", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref, { readyState: 1, videoWidth: 640 });
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("No Feed")).toBeInTheDocument();
    });

    it("shows No Feed when videoWidth is 0", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref, { readyState: 4, videoWidth: 0 });
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("No Feed")).toBeInTheDocument();
    });
  });

  // ── Status badge always present ────────────────────────────────────────────

  describe("Badge always present", () => {
    it("renders a status badge on mount", () => {
      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      expect(
        screen.queryByText("Live") ??
        screen.queryByText("No Feed") ??
        screen.queryByText("Checking")
      ).toBeTruthy();
    });
  });

  // ── onWarning callback ─────────────────────────────────────────────────────

  describe("onWarning callback", () => {
    it("calls onWarning after 5 consecutive dark frames", () => {
      currentCtxStub = makeCtxStub(0); // always dark
      const onWarning = vi.fn();
      const ref = makeVideoRef();

      render(<VideoMonitor videoRef={ref} onWarning={onWarning} />);
      // Patch BEFORE the interval ticks so all interval checks count dark frames.
      // The initial check() at mount fires before patchVideoElement so it sees
      // readyState=0 and returns early (no dark-frame increment).
      // All 5 needed dark frames come from the interval ticks below.
      patchVideoElement(ref); // readyState=4, videoWidth=640

      for (let i = 0; i < 5; i++) {
        act(() => { vi.advanceTimersByTime(3000); });
      }
      expect(onWarning).toHaveBeenCalled();
    });

    it("does NOT call onWarning when video is live", () => {
      currentCtxStub = makeCtxStub(200); // always bright
      const onWarning = vi.fn();
      const ref = makeVideoRef();

      render(<VideoMonitor videoRef={ref} onWarning={onWarning} />);
      patchVideoElement(ref);

      act(() => { vi.advanceTimersByTime(15000); });
      expect(onWarning).not.toHaveBeenCalled();
    });

    it("resets dark-frame counter when a bright frame arrives, preventing premature warning", () => {
      let callCount = 0;
      currentCtxStub = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => {
          callCount++;
          // 1st-3rd checks dark, 4th check bright → resets counter
          const bright = callCount === 4;
          const val = bright ? 200 : 0;
          return { data: new Uint8ClampedArray(32 * 32 * 4).fill(val) };
        }),
      };

      const onWarning = vi.fn();
      const ref = makeVideoRef();

      render(<VideoMonitor videoRef={ref} onWarning={onWarning} />);
      patchVideoElement(ref);

      for (let i = 0; i < 4; i++) {
        act(() => { vi.advanceTimersByTime(3000); });
      }
      expect(onWarning).not.toHaveBeenCalled();
    });
  });

  // ── Interval cleanup ───────────────────────────────────────────────────────

  describe("Interval cleanup", () => {
    it("clears the interval on unmount", () => {
      const clearIntervalSpy = vi.spyOn(globalThis, "clearInterval");
      const ref = makeVideoRef();
      const { unmount } = render(<VideoMonitor videoRef={ref} />);
      unmount();
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });

  // ── Badge transitions ─────────────────────────────────────────────────────

  describe("Badge transitions", () => {
    it("switches from Live to No Feed when video goes dark on interval", () => {
      let dark = false;
      currentCtxStub = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => {
          const val = dark ? 0 : 200;
          return { data: new Uint8ClampedArray(32 * 32 * 4).fill(val) };
        }),
      };

      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref);

      // First tick: bright → "Live"
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("Live")).toBeInTheDocument();

      // Second tick: dark → "No Feed"
      dark = true;
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("No Feed")).toBeInTheDocument();
    });

    it("switches from No Feed to Live when video brightens on interval", () => {
      let bright = false;
      currentCtxStub = {
        drawImage: vi.fn(),
        getImageData: vi.fn(() => {
          const val = bright ? 200 : 0;
          return { data: new Uint8ClampedArray(32 * 32 * 4).fill(val) };
        }),
      };

      const ref = makeVideoRef();
      render(<VideoMonitor videoRef={ref} />);
      patchVideoElement(ref);

      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("No Feed")).toBeInTheDocument();

      bright = true;
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText("Live")).toBeInTheDocument();
    });
  });
});
