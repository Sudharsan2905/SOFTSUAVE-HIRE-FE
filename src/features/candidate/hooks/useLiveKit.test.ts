import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { RefObject } from "react";

// ── api mock ─────────────────────────────────────────────────────────────────
vi.mock("../../../utils/api", () => ({
  default: { post: vi.fn() },
}));
vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    CANDIDATE: {
      SUBMISSION_LIVEKIT_TOKEN: (id: string) => `/candidate/submission/${id}/livekit-token`,
    },
    LIVE_MONITORING: {
      LIVEKIT_TOKEN: "/live-interviews/livekit-token",
    },
  },
}));

// ── livekit-client mock ──────────────────────────────────────────────────────
interface MockRemoteTrackPublication {
  source: string;
  isSubscribed: boolean;
  setSubscribed: ReturnType<typeof vi.fn>;
  track?: { source: string } | null;
}
interface MockRemoteParticipant {
  identity: string;
  trackPublications: Map<string, MockRemoteTrackPublication>;
}

// Defined via vi.hoisted so they exist before the hoisted vi.mock factory runs.
const {
  roomInstances,
  resetRoomInstances,
  connectControl,
  MockRoom,
  MockLocalVideoTrack,
  MockLocalAudioTrack,
  RoomEvent,
  Track,
} = vi.hoisted(() => {
  const instances: MockRoomType[] = [];
  // Overridable connect behaviour shared by all room instances.
  const connectCtl: { impl: (...args: unknown[]) => Promise<void> } = {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    impl: async () => {},
  };

  class MockLocalParticipant {
    publishTrack = vi.fn().mockResolvedValue(undefined);
    unpublishTrack = vi.fn().mockResolvedValue(undefined);
  }

  class MockRoomClass {
    localParticipant = new MockLocalParticipant();
    remoteParticipants = new Map<string, unknown>();
    connect = vi.fn((...args: unknown[]) => connectCtl.impl(...(args as [])));
    disconnect = vi.fn();
    removeAllListeners = vi.fn();
    _handlers: Record<string, Array<(...args: unknown[]) => void>> = {};
    on = vi.fn(function (this: MockRoomClass, event: string, cb: (...args: unknown[]) => void) {
      (this._handlers[event] ??= []).push(cb);
      return this;
    });
    off = vi.fn();
    emit(event: string, ...args: unknown[]) {
      for (const cb of this._handlers[event] ?? []) cb(...args);
    }
    constructor() {
      instances.push(this as unknown as MockRoomType);
    }
  }

  class MockLocalVideoTrackClass {
    stop = vi.fn();
    constructor(public raw: unknown) {}
  }
  class MockLocalAudioTrackClass {
    stop = vi.fn();
    constructor(public raw: unknown) {}
  }

  type MockRoomType = MockRoomClass;

  return {
    roomInstances: instances,
    resetRoomInstances: () => {
      instances.length = 0;
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      connectCtl.impl = async () => {};
    },
    connectControl: connectCtl,
    MockRoom: MockRoomClass,
    MockLocalVideoTrack: MockLocalVideoTrackClass,
    MockLocalAudioTrack: MockLocalAudioTrackClass,
    RoomEvent: {
      Connected: "connected",
      Disconnected: "disconnected",
      TrackPublished: "trackPublished",
      TrackSubscribed: "trackSubscribed",
      TrackUnsubscribed: "trackUnsubscribed",
    },
    Track: {
      Kind: { Video: "video", Audio: "audio" },
      Source: {
        Camera: "camera",
        ScreenShare: "screen_share",
        Microphone: "microphone",
      },
    },
  };
});

vi.mock("livekit-client", () => ({
  Room: MockRoom,
  RoomEvent,
  Track,
  LocalVideoTrack: MockLocalVideoTrack,
  LocalAudioTrack: MockLocalAudioTrack,
}));

import api from "../../../utils/api";
import { useLiveKitPublisher, useLiveKitViewer } from "./useLiveKit";

const mockPost = vi.mocked((api as unknown as { post: (...args: unknown[]) => unknown }).post);

// ── Mock stream/track helpers ────────────────────────────────────────────────
function makeMockTrack() {
  return {
    readyState: "live",
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStreamTrack & {
    addEventListener: ReturnType<typeof vi.fn>;
  };
}

function makeStreamRef(opts: { video?: boolean; audio?: boolean }): RefObject<MediaStream | null> {
  const videoTracks = opts.video ? [makeMockTrack()] : [];
  const audioTracks = opts.audio ? [makeMockTrack()] : [];
  const stream = {
    getVideoTracks: () => videoTracks,
    getAudioTracks: () => audioTracks,
    getTracks: () => [...videoTracks, ...audioTracks],
  } as unknown as MediaStream;
  return { current: stream };
}

beforeEach(() => {
  resetRoomInstances();
  mockPost.mockReset();
  mockPost.mockResolvedValue({ data: { data: { token: "tok-123" } } });
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── useLiveKitPublisher ──────────────────────────────────────────────────────
describe("useLiveKitPublisher", () => {
  const baseOpts = {
    submissionId: "sub-1",
    enabled: true,
  };

  it("returns the expected shape on mount and is not publishing", () => {
    const { result } = renderHook(() => useLiveKitPublisher(baseOpts));
    expect(result.current.isPublishing).toBe(false);
    expect(typeof result.current.startPublishing).toBe("function");
    expect(typeof result.current.stopPublishing).toBe("function");
  });

  it("startPublishing is a no-op when disabled", async () => {
    const { result } = renderHook(() => useLiveKitPublisher({ ...baseOpts, enabled: false }));
    await act(async () => {
      await result.current.startPublishing();
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(roomInstances).toHaveLength(0);
    expect(result.current.isPublishing).toBe(false);
  });

  it("startPublishing is a no-op when submissionId is null", async () => {
    const { result } = renderHook(() => useLiveKitPublisher({ ...baseOpts, submissionId: null }));
    await act(async () => {
      await result.current.startPublishing();
    });
    expect(mockPost).not.toHaveBeenCalled();
    expect(roomInstances).toHaveLength(0);
  });

  it("fetches token, connects room, and sets isPublishing on success", async () => {
    const { result } = renderHook(() => useLiveKitPublisher(baseOpts));
    await act(async () => {
      await result.current.startPublishing();
    });

    expect(mockPost).toHaveBeenCalledWith("/candidate/submission/sub-1/livekit-token");
    expect(roomInstances).toHaveLength(1);
    expect(roomInstances[0].connect).toHaveBeenCalledWith(expect.any(String), "tok-123");
    expect(result.current.isPublishing).toBe(true);
  });

  it("publishes screen, camera, and audio tracks from the provided refs", async () => {
    const screenStreamRef = makeStreamRef({ video: true });
    const cameraStreamRef = makeStreamRef({ video: true });
    const audioStreamRef = makeStreamRef({ audio: true });

    const { result } = renderHook(() =>
      useLiveKitPublisher({
        ...baseOpts,
        screenStreamRef,
        cameraStreamRef,
        audioStreamRef,
      })
    );

    await act(async () => {
      await result.current.startPublishing();
    });

    const publishTrack = roomInstances[0].localParticipant.publishTrack;
    expect(publishTrack).toHaveBeenCalledTimes(3);

    const sources = publishTrack.mock.calls.map((c) => (c[1] as { source: string }).source);
    expect(sources).toContain(Track.Source.ScreenShare);
    expect(sources).toContain(Track.Source.Camera);
    expect(sources).toContain(Track.Source.Microphone);
    expect(result.current.isPublishing).toBe(true);
  });

  it("registers an 'ended' listener on the raw screen track that stops publishing", async () => {
    const screenStreamRef = makeStreamRef({ video: true });
    const rawScreenTrack = screenStreamRef.current!.getVideoTracks()[0] as MediaStreamTrack & {
      addEventListener: ReturnType<typeof vi.fn>;
    };

    const { result } = renderHook(() => useLiveKitPublisher({ ...baseOpts, screenStreamRef }));

    await act(async () => {
      await result.current.startPublishing();
    });

    const endedCall = rawScreenTrack.addEventListener.mock.calls.find((c) => c[0] === "ended");
    expect(endedCall).toBeDefined();

    // Firing the 'ended' handler tears down publishing
    act(() => {
      (endedCall![1] as () => void)();
    });
    expect(roomInstances[0].disconnect).toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });

  it("does not publish a screen track when the screen stream has no video track", async () => {
    const screenStreamRef = makeStreamRef({ video: false });
    const { result } = renderHook(() => useLiveKitPublisher({ ...baseOpts, screenStreamRef }));
    await act(async () => {
      await result.current.startPublishing();
    });
    expect(roomInstances[0].localParticipant.publishTrack).not.toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(true);
  });

  it("does not start a second connection while already publishing", async () => {
    const { result } = renderHook(() => useLiveKitPublisher(baseOpts));
    await act(async () => {
      await result.current.startPublishing();
    });
    expect(roomInstances).toHaveLength(1);

    // isPublishing is now true; a second call should short-circuit
    await act(async () => {
      await result.current.startPublishing();
    });
    expect(roomInstances).toHaveLength(1);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("stopPublishing stops published tracks, disconnects the room, and clears state", async () => {
    const cameraStreamRef = makeStreamRef({ video: true });
    const { result } = renderHook(() => useLiveKitPublisher({ ...baseOpts, cameraStreamRef }));

    await act(async () => {
      await result.current.startPublishing();
    });
    expect(result.current.isPublishing).toBe(true);

    act(() => {
      result.current.stopPublishing();
    });

    expect(roomInstances[0].disconnect).toHaveBeenCalled();
    expect(result.current.isPublishing).toBe(false);
  });

  it("calls stopPublishing path (disconnect) when the connect call rejects", async () => {
    // Make connect throw to enter the catch branch
    connectControl.impl = async () => {
      throw new Error("connect failed");
    };

    const { result } = renderHook(() => useLiveKitPublisher(baseOpts));
    await act(async () => {
      await result.current.startPublishing();
    });

    expect(result.current.isPublishing).toBe(false);
    expect(roomInstances[0].disconnect).toHaveBeenCalled();
  });

  it("handles a rejected token request by not publishing", async () => {
    mockPost.mockRejectedValueOnce(new Error("token failed"));
    const { result } = renderHook(() => useLiveKitPublisher(baseOpts));
    await act(async () => {
      await result.current.startPublishing();
    });
    expect(result.current.isPublishing).toBe(false);
    expect(roomInstances).toHaveLength(0);
  });

  it("disconnects the room on unmount", async () => {
    const { result, unmount } = renderHook(() => useLiveKitPublisher(baseOpts));
    await act(async () => {
      await result.current.startPublishing();
    });
    const room = roomInstances[0];
    unmount();
    expect(room.disconnect).toHaveBeenCalled();
  });
});

// ── useLiveKitViewer ─────────────────────────────────────────────────────────
describe("useLiveKitViewer", () => {
  function makePublication(
    overrides: Partial<MockRemoteTrackPublication> = {}
  ): MockRemoteTrackPublication {
    return {
      source: Track.Source.ScreenShare,
      isSubscribed: false,
      setSubscribed: vi.fn(),
      ...overrides,
    };
  }
  function makeParticipant(
    identity: string,
    pubs: MockRemoteTrackPublication[]
  ): MockRemoteParticipant {
    const map = new Map<string, MockRemoteTrackPublication>();
    pubs.forEach((p, i) => map.set(String(i), p));
    return { identity, trackPublications: map };
  }

  it("returns default state and does nothing when workspaceId is null", () => {
    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: null, targetSubmissionId: null })
    );
    expect(result.current.screenTrack).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.connectionError).toBeNull();
    expect(roomInstances).toHaveLength(0);
  });

  it("fetches admin token and connects with autoSubscribe false", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    renderHook(() => useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: null }));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockPost).toHaveBeenCalledWith("/live-interviews/livekit-token", {
      workspace_id: "ws-1",
    });
    expect(roomInstances).toHaveLength(1);
    expect(roomInstances[0].connect).toHaveBeenCalledWith(expect.any(String), "admin-tok", {
      autoSubscribe: false,
    });
  });

  it("sets isConnected and syncs subscriptions on the Connected event", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const targetPub = makePublication({ source: Track.Source.ScreenShare });

    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-1" })
    );

    const created = roomInstances[roomInstances.length - 1];
    created.remoteParticipants.set("p1", makeParticipant("candidate-cand-1", [targetPub]));

    await act(async () => {
      created.emit(RoomEvent.Connected);
    });

    expect(result.current.isConnected).toBe(true);
    expect(targetPub.setSubscribed).toHaveBeenCalledWith(true);
  });

  it("subscribes to target candidate's screen share on TrackPublished", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    renderHook(() => useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-9" }));
    const room = roomInstances[roomInstances.length - 1];
    const pub = makePublication({ source: Track.Source.ScreenShare });

    await act(async () => {
      room.emit(RoomEvent.TrackPublished, pub, { identity: "candidate-cand-9" });
    });

    expect(pub.setSubscribed).toHaveBeenCalledWith(true);
  });

  it("ignores TrackPublished from non-target participants", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    renderHook(() => useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-9" }));
    const room = roomInstances[roomInstances.length - 1];
    const pub = makePublication({ source: Track.Source.ScreenShare });

    await act(async () => {
      room.emit(RoomEvent.TrackPublished, pub, { identity: "candidate-other" });
    });

    expect(pub.setSubscribed).not.toHaveBeenCalled();
  });

  it("sets screenTrack on TrackSubscribed for target's screen share, clears it on TrackUnsubscribed", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-3" })
    );
    const room = roomInstances[roomInstances.length - 1];
    const track = { source: Track.Source.ScreenShare } as unknown;

    await act(async () => {
      room.emit(RoomEvent.TrackSubscribed, track, {}, { identity: "candidate-cand-3" });
    });
    expect(result.current.screenTrack).toBe(track);

    await act(async () => {
      room.emit(RoomEvent.TrackUnsubscribed, track);
    });
    expect(result.current.screenTrack).toBeNull();
  });

  it("clears screenTrack and isConnected on the Disconnected event", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-3" })
    );
    const room = roomInstances[roomInstances.length - 1];
    const track = { source: Track.Source.ScreenShare } as unknown;

    await act(async () => {
      room.emit(RoomEvent.TrackSubscribed, track, {}, { identity: "candidate-cand-3" });
    });
    expect(result.current.screenTrack).toBe(track);

    await act(async () => {
      room.emit(RoomEvent.Disconnected);
    });
    expect(result.current.screenTrack).toBeNull();
    expect(result.current.isConnected).toBe(false);
  });

  it("sets connectionError when the token request fails", async () => {
    mockPost.mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-err", targetSubmissionId: null })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.connectionError).toBe("boom");
  });

  it("disconnects the room and removes listeners on unmount", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const { unmount } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: null })
    );
    const room = roomInstances[roomInstances.length - 1];
    unmount();
    expect(room.removeAllListeners).toHaveBeenCalled();
    expect(room.disconnect).toHaveBeenCalled();
  });

  it("resyncs subscriptions when targetSubmissionId changes after connection", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const targetPub = makePublication({
      source: Track.Source.ScreenShare,
      isSubscribed: false,
    });

    const { rerender } = renderHook(
      ({ target }: { target: string | null }) =>
        useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: target }),
      { initialProps: { target: "cand-1" as string | null } }
    );
    const room = roomInstances[roomInstances.length - 1];
    room.remoteParticipants.set("p1", makeParticipant("candidate-cand-2", [targetPub]));

    // Connect first
    await act(async () => {
      room.emit(RoomEvent.Connected);
    });
    targetPub.setSubscribed.mockClear();

    // Switch target to cand-2 — its screen share should now be subscribed
    await act(async () => {
      rerender({ target: "cand-2" });
    });

    expect(targetPub.setSubscribed).toHaveBeenCalledWith(true);
  });

  it("ignores TrackSubscribed when the track source is not screen share", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-3" })
    );
    const room = roomInstances[roomInstances.length - 1];
    const cameraTrack = { source: Track.Source.Camera } as unknown;

    await act(async () => {
      room.emit(RoomEvent.TrackSubscribed, cameraTrack, {}, { identity: "candidate-cand-3" });
    });

    expect(result.current.screenTrack).toBeNull();
  });

  it("keeps screenTrack on TrackUnsubscribed for a different (non-matching) track", async () => {
    mockPost.mockResolvedValue({ data: { data: { token: "admin-tok" } } });
    const { result } = renderHook(() =>
      useLiveKitViewer({ workspaceId: "ws-1", targetSubmissionId: "cand-3" })
    );
    const room = roomInstances[roomInstances.length - 1];
    const track = { source: Track.Source.ScreenShare } as unknown;
    const otherTrack = { source: Track.Source.ScreenShare } as unknown;

    await act(async () => {
      room.emit(RoomEvent.TrackSubscribed, track, {}, { identity: "candidate-cand-3" });
    });
    expect(result.current.screenTrack).toBe(track);

    // Unsubscribing a different track must not clear the active one (prev !== track).
    await act(async () => {
      room.emit(RoomEvent.TrackUnsubscribed, otherTrack);
    });
    expect(result.current.screenTrack).toBe(track);
  });
});
