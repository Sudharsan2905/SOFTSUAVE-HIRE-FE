import { useCallback, useEffect, useRef, useState, RefObject } from "react";
import {
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
} from "livekit-client";
import api from "@/utils/api";
import { API_ENDPOINTS } from "@/constants/api";
import { CONFIG } from "@/constants/config";

// ─── Candidate publisher ──────────────────────────────────────────────────────

interface PublisherOptions {
  submissionId: string | null;
  enabled: boolean;
  screenStreamRef?: RefObject<MediaStream | null>;
  cameraStreamRef?: RefObject<MediaStream | null>;
  audioStreamRef?: RefObject<MediaStream | null>;
}

interface PublisherState {
  isPublishing: boolean;
  startPublishing: () => Promise<void>;
  stopPublishing: () => void;
}

const PUBLISH_RETRY_BASE_MS = 1_000;
const PUBLISH_RETRY_MAX_MS = 30_000;

/** Exponential back-off with jitter so 1000 candidates never retry in lock-step. */
export function publishBackoffMs(attempt: number): number {
  const ceiling = Math.min(PUBLISH_RETRY_BASE_MS * 2 ** attempt, PUBLISH_RETRY_MAX_MS);
  return Math.round(ceiling / 2 + Math.random() * (ceiling / 2));
}

export function useLiveKitPublisher({
  submissionId,
  enabled,
  screenStreamRef,
  cameraStreamRef,
  audioStreamRef,
}: PublisherOptions): PublisherState {
  const roomRef = useRef<Room | null>(null);
  const publishedTracksRef = useRef<(LocalVideoTrack | LocalAudioTrack)[]>([]);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const wantedRef = useRef(false); // true between startPublishing() and stopPublishing()
  const connectingRef = useRef(false);
  const screenEndedCleanupRef = useRef<(() => void) | null>(null);
  const connectRef = useRef<() => Promise<void>>(async () => undefined);
  const [isPublishing, setIsPublishing] = useState(false);

  /** Stop only the publisher's CLONES; the shared raw tracks (MediaPipe, recorder,
   * screenshots) keep running. */
  const teardownRoom = useCallback(() => {
    publishedTracksRef.current.forEach((t) => t.stop());
    publishedTracksRef.current = [];
    screenEndedCleanupRef.current?.();
    screenEndedCleanupRef.current = null;
    const room = roomRef.current;
    roomRef.current = null;
    if (room) {
      room.removeAllListeners();
      void room.disconnect();
    }
  }, []);

  // submissionId intentionally excluded — it is only used for logging, not logic.
  const stopPublishing = useCallback(() => {
    wantedRef.current = false;
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
    teardownRoom();
    setIsPublishing(false);
  }, [teardownRoom]);

  const scheduleRetry = useCallback(() => {
    if (!wantedRef.current || retryTimerRef.current) return;
    const delay = publishBackoffMs(attemptRef.current);
    attemptRef.current += 1;
    console.warn(`[LiveKit] Retrying publish in ${delay}ms (attempt ${attemptRef.current})`);
    retryTimerRef.current = setTimeout(() => {
      retryTimerRef.current = null;
      void connectRef.current();
    }, delay);
  }, []);

  const publishClone = useCallback(
    async (
      room: Room,
      raw: MediaStreamTrack | undefined,
      kind: "video" | "audio",
      name: string,
      source: Track.Source
    ) => {
      if (!raw) return;
      // Clone: stopping/unpublishing the clone never touches the shared original.
      const clone = raw.clone();
      const track = kind === "video" ? new LocalVideoTrack(clone) : new LocalAudioTrack(clone);
      publishedTracksRef.current.push(track);
      await room.localParticipant.publishTrack(track, { name, source });
      console.warn(`[LiveKit] Published ${kind} track: ${name}`);
    },
    []
  );

  const connectAndPublish = useCallback(async () => {
    if (!enabled || !submissionId || !wantedRef.current || connectingRef.current) return;
    connectingRef.current = true;
    teardownRoom();
    console.warn(`[LiveKit] Connecting: submission=${submissionId}`);
    try {
      const { data } = await api.post(
        API_ENDPOINTS.CANDIDATE.SUBMISSION_LIVEKIT_TOKEN(submissionId)
      );
      const { token } = data.data as { token: string };

      const room = new Room();
      roomRef.current = room;
      room.on(RoomEvent.Disconnected, () => {
        if (roomRef.current !== room || !wantedRef.current) return;
        console.warn("[LiveKit] Publisher disconnected — scheduling re-publish");
        setIsPublishing(false);
        teardownRoom();
        scheduleRetry();
      });
      await room.connect(CONFIG.LIVEKIT_URL, token);

      const screenRaw = screenStreamRef?.current?.getVideoTracks()[0];
      await publishClone(
        room,
        screenRaw,
        "video",
        `screen-${submissionId}`,
        Track.Source.ScreenShare
      );
      if (screenRaw) {
        // The user ending the share is a real stop: nothing left to publish.
        const onEnded = () => stopPublishing();
        screenRaw.addEventListener("ended", onEnded);
        screenEndedCleanupRef.current = () => screenRaw.removeEventListener("ended", onEnded);
      }
      await publishClone(
        room,
        cameraStreamRef?.current?.getVideoTracks()[0],
        "video",
        `camera-${submissionId}`,
        Track.Source.Camera
      );
      await publishClone(
        room,
        audioStreamRef?.current?.getAudioTracks()[0],
        "audio",
        `mic-${submissionId}`,
        Track.Source.Microphone
      );

      attemptRef.current = 0;
      setIsPublishing(true);
    } catch (err) {
      console.error(`[LiveKit] Publish failed: submission=${submissionId}`, err);
      teardownRoom();
      setIsPublishing(false);
      scheduleRetry();
    } finally {
      connectingRef.current = false;
    }
  }, [
    enabled,
    submissionId,
    teardownRoom,
    scheduleRetry,
    publishClone,
    stopPublishing,
    screenStreamRef,
    cameraStreamRef,
    audioStreamRef,
  ]);

  useEffect(() => {
    connectRef.current = connectAndPublish;
  }, [connectAndPublish]);

  const startPublishing = useCallback(async () => {
    if (!enabled || !submissionId || isPublishing || wantedRef.current) return;
    wantedRef.current = true;
    attemptRef.current = 0;
    await connectAndPublish();
  }, [enabled, submissionId, isPublishing, connectAndPublish]);

  useEffect(() => {
    return () => stopPublishing();
  }, [stopPublishing]);

  return { isPublishing, startPublishing, stopPublishing };
}

// ─── Admin viewer ─────────────────────────────────────────────────────────────

interface ViewerOptions {
  workspaceId: string | null;
  targetSubmissionId: string | null;
}

interface ViewerState {
  screenTrack: RemoteTrack | null;
  isConnected: boolean;
  connectionError: string | null;
}

/**
 * Ensures admin is subscribed ONLY to the target candidate's screen track.
 * Unsubscribes every other participant. Idempotent — safe to call multiple times.
 *
 * This is the core of targeted monitoring: one admin → one candidate stream,
 * regardless of how many other candidates are publishing in the same workspace room.
 */
function syncSubscriptions(room: Room, targetSubmissionId: string | null): void {
  const targetIdentity = targetSubmissionId ? `candidate-${targetSubmissionId}` : null;
  for (const participant of room.remoteParticipants.values()) {
    const isTarget = participant.identity === targetIdentity;
    for (const pub of participant.trackPublications.values()) {
      // Use pub.source (always available) not pub.track?.source (null when unsubscribed)
      const wantSubscribed = isTarget && pub.source === Track.Source.ScreenShare;
      if (wantSubscribed && !pub.isSubscribed) pub.setSubscribed(true);
      if (!wantSubscribed && pub.isSubscribed) pub.setSubscribed(false);
    }
  }
}

export function useLiveKitViewer({ workspaceId, targetSubmissionId }: ViewerOptions): ViewerState {
  const roomRef = useRef<Room | null>(null);
  const [screenTrack, setScreenTrack] = useState<RemoteTrack | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  // Ref keeps the event handlers' closure in sync with the latest selected candidate
  // without requiring the room effect to re-run and reconnect.
  const targetRef = useRef(targetSubmissionId);

  useEffect(() => {
    targetRef.current = targetSubmissionId;
  }, [targetSubmissionId]);

  // ── Room lifecycle — reconnects only when workspace changes ─────────────────
  useEffect(() => {
    if (!workspaceId) return;

    let active = true;
    setConnectionError(null);

    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.Connected, () => {
      if (!active) return;
      setIsConnected(true);
      // Subscribe to target candidate if they are already in the room and publishing
      syncSubscriptions(room, targetRef.current);
    });

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false);
      setScreenTrack(null);
    });

    // A participant published a new track — subscribe if it is our target candidate's
    // screen share. This covers the case where the candidate publishes AFTER the
    // admin has already connected (the Connected handler would have found nothing).
    room.on(
      RoomEvent.TrackPublished,
      (pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (!active) return;
        if (
          participant.identity === `candidate-${targetRef.current}` &&
          pub.source === Track.Source.ScreenShare
        ) {
          pub.setSubscribed(true);
        }
      }
    );

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (!active) return;
        if (
          targetRef.current &&
          participant.identity === `candidate-${targetRef.current}` &&
          track.source === Track.Source.ScreenShare
        ) {
          setScreenTrack(track);
        }
      }
    );

    // Reference equality ensures we only clear the track that was actually removed,
    // never accidentally clearing a freshly-set track from another candidate.
    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      setScreenTrack((prev) => (prev === track ? null : prev));
    });

    console.warn(`[LiveKit] Viewer: fetching admin token for workspace=${workspaceId}`);
    api
      .post(API_ENDPOINTS.LIVE_MONITORING.LIVEKIT_TOKEN, { workspace_id: workspaceId })
      .then(({ data }) => {
        if (!active) return;
        console.warn(`[LiveKit] Viewer: token received, connecting to ${CONFIG.LIVEKIT_URL}`);
        // autoSubscribe: false — admin explicitly subscribes only to the selected
        // candidate's screen track. Without this, LiveKit auto-subscribes to every
        // participant in the room (all candidates), wasting bandwidth at scale.
        return room.connect(CONFIG.LIVEKIT_URL, data.data.token as string, {
          autoSubscribe: false,
        });
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : String(err) || "Unknown connection error";
        console.error("[LiveKit] Viewer: connection failed:", err);
        setConnectionError(msg);
      });

    return () => {
      active = false;
      room.removeAllListeners();
      room.disconnect();
      roomRef.current = null;
      setScreenTrack(null);
      setIsConnected(false);
      setConnectionError(null);
    };
  }, [workspaceId]);

  // ── Target candidate switch — resync subscriptions without reconnecting ──────
  // Runs when admin selects a different candidate (or when room first connects).
  // syncSubscriptions unsubscribes the old candidate → TrackUnsubscribed clears
  // screenTrack. Subscribing new candidate → TrackSubscribed sets screenTrack.
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !isConnected) return;
    syncSubscriptions(room, targetSubmissionId);
  }, [targetSubmissionId, isConnected]);

  return { screenTrack, isConnected, connectionError };
}
