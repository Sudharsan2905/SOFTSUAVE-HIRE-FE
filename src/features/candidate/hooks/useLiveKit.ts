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

export function useLiveKitPublisher({
  submissionId,
  enabled,
  screenStreamRef,
  cameraStreamRef,
  audioStreamRef,
}: PublisherOptions): PublisherState {
  const roomRef = useRef<Room | null>(null);
  const publishedTracksRef = useRef<(LocalVideoTrack | LocalAudioTrack)[]>([]);
  const [isPublishing, setIsPublishing] = useState(false);

  // submissionId intentionally excluded — it is only used for logging, not logic.
  // Including it would recreate stopPublishing (and therefore startPublishing + the
  // cleanup effect) on every submission change, causing premature disconnection.
  const stopPublishing = useCallback(() => {
    publishedTracksRef.current.forEach((t) => t.stop());
    publishedTracksRef.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
    setIsPublishing(false);
  }, []);

  const startPublishing = useCallback(async () => {
    if (!enabled || !submissionId || isPublishing) return;
    console.warn(`[LiveKit] Connecting: submission=${submissionId}`);
    try {
      const { data } = await api.post(
        API_ENDPOINTS.CANDIDATE.SUBMISSION_LIVEKIT_TOKEN(submissionId)
      );
      const { token } = data.data as { token: string };

      const room = new Room();
      roomRef.current = room;
      const liveKitHost =
        (import.meta.env.VITE_LIVEKIT_HOST as string | undefined) ??
        `${globalThis.location.protocol === "https:" ? "wss" : "ws"}://${globalThis.location.host}/livekit`;
      await room.connect(liveKitHost, token);
      console.warn(`[LiveKit] Room connected: host=${liveKitHost} submission=${submissionId}`);

      // Screen share — reuse the pre-acquired stream (no second getDisplayMedia prompt)
      const screenStream = screenStreamRef?.current;
      if (screenStream) {
        const rawScreenTrack = screenStream.getVideoTracks()[0];
        if (rawScreenTrack) {
          const screenTrack = new LocalVideoTrack(rawScreenTrack);
          publishedTracksRef.current.push(screenTrack);
          await room.localParticipant.publishTrack(screenTrack, {
            name: `screen-${submissionId}`,
            source: Track.Source.ScreenShare,
          });
          console.warn(`[LiveKit] Published screen track: screen-${submissionId}`);
          rawScreenTrack.addEventListener("ended", stopPublishing);
        }
      }

      // Camera — reuse pre-acquired camera stream
      const cameraStream = cameraStreamRef?.current;
      if (cameraStream) {
        const rawCamTrack = cameraStream.getVideoTracks()[0];
        if (rawCamTrack) {
          const camTrack = new LocalVideoTrack(rawCamTrack);
          publishedTracksRef.current.push(camTrack);
          await room.localParticipant.publishTrack(camTrack, {
            name: `camera-${submissionId}`,
            source: Track.Source.Camera,
          });
          console.warn(`[LiveKit] Published camera track: camera-${submissionId}`);
        }
      }

      // Microphone — reuse pre-acquired audio stream
      const micStream = audioStreamRef?.current;
      if (micStream) {
        const rawAudioTrack = micStream.getAudioTracks()[0];
        if (rawAudioTrack) {
          const audioTrack = new LocalAudioTrack(rawAudioTrack);
          publishedTracksRef.current.push(audioTrack);
          await room.localParticipant.publishTrack(audioTrack, {
            name: `mic-${submissionId}`,
            source: Track.Source.Microphone,
          });
          console.warn(`[LiveKit] Published audio track: mic-${submissionId}`);
        }
      }

      setIsPublishing(true);
    } catch (err) {
      console.error(`[LiveKit] Publish failed: submission=${submissionId}`, err);
      stopPublishing();
    }
  }, [
    enabled,
    isPublishing,
    submissionId,
    stopPublishing,
    screenStreamRef,
    cameraStreamRef,
    audioStreamRef,
  ]);

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
        const liveKitHost =
          (import.meta.env.VITE_LIVEKIT_HOST as string | undefined) ??
          `${globalThis.location.protocol === "https:" ? "wss" : "ws"}://${globalThis.location.host}/livekit`;
        console.warn(`[LiveKit] Viewer: token received, connecting to ${liveKitHost}`);
        // autoSubscribe: false — admin explicitly subscribes only to the selected
        // candidate's screen track. Without this, LiveKit auto-subscribes to every
        // participant in the room (all candidates), wasting bandwidth at scale.
        return room.connect(liveKitHost, data.data.token as string, { autoSubscribe: false });
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
