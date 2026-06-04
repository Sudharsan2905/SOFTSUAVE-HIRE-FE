import { useCallback, useEffect, useRef, useState } from "react";

import {
  LocalVideoTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
  Room,
  RoomEvent,
  Track,
  createLocalScreenTracks,
} from "livekit-client";

import api from "@/utils/api";

// ─── Candidate publisher (screen track only) ──────────────────────────────────

interface PublisherOptions {
  submissionId: string;
  enabled: boolean;
  onScreenShareStop?: () => void;
}

interface PublisherState {
  isPublishing: boolean;
  startPublishing: () => Promise<void>;
  stopPublishing: () => void;
}

export function useLiveKitPublisher({
  submissionId,
  enabled,
  onScreenShareStop,
}: PublisherOptions): PublisherState {
  const roomRef = useRef<Room | null>(null);
  const screenTrackRef = useRef<LocalVideoTrack | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  const stopPublishing = useCallback(() => {
    screenTrackRef.current?.stop();
    screenTrackRef.current = null;
    roomRef.current?.disconnect();
    roomRef.current = null;
    setIsPublishing(false);
  }, []);

  const startPublishing = useCallback(async () => {
    if (!enabled || isPublishing) return;
    try {
      const { data } = await api.post(`/candidate/submission/${submissionId}/livekit-token`);
      const { token } = data.data;

      const room = new Room();
      roomRef.current = room;

      const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
      await room.connect(liveKitHost, token);

      const [screenTrack] = await createLocalScreenTracks({ audio: false });
      screenTrackRef.current = screenTrack as LocalVideoTrack;

      await room.localParticipant.publishTrack(screenTrackRef.current, {
        name: `screen-${submissionId}`,
        source: Track.Source.ScreenShare,
      });

      screenTrackRef.current.mediaStreamTrack.addEventListener("ended", () => {
        stopPublishing();
        onScreenShareStop?.();
      });

      setIsPublishing(true);
    } catch {
      stopPublishing();
    }
  }, [enabled, isPublishing, submissionId, stopPublishing, onScreenShareStop]);

  useEffect(() => {
    return () => {
      stopPublishing();
    };
  }, [stopPublishing]);

  return { isPublishing, startPublishing, stopPublishing };
}

// ─── Admin viewer (subscribe to one candidate's screen track) ─────────────────
//
// Design: connect ONCE per workspaceId (all candidates share the same room).
// Switching targetSubmissionId only re-filters which participant's track to show
// — no room disconnect/reconnect on every candidate click.

interface ViewerOptions {
  workspaceId: string | null;
  targetSubmissionId: string | null;
}

interface ViewerState {
  screenTrack: RemoteTrack | null;
  isConnected: boolean;
}

function findScreenTrack(room: Room, submissionId: string): RemoteTrack | null {
  const identity = `candidate-${submissionId}`;
  for (const participant of room.remoteParticipants.values()) {
    if (participant.identity !== identity) continue;
    for (const pub of participant.trackPublications.values()) {
      if (pub.track?.source === Track.Source.ScreenShare) return pub.track;
    }
  }
  return null;
}

export function useLiveKitViewer({ workspaceId, targetSubmissionId }: ViewerOptions): ViewerState {
  const roomRef = useRef<Room | null>(null);
  const [screenTrack, setScreenTrack] = useState<RemoteTrack | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  // Keep a ref so track-subscription handlers always see the latest target
  const targetRef = useRef(targetSubmissionId);

  useEffect(() => {
    targetRef.current = targetSubmissionId;
  }, [targetSubmissionId]);

  // ── Connect once per workspaceId ───────────────────────────────────────────
  useEffect(() => {
    if (!workspaceId) return;

    let active = true;
    const room = new Room();
    roomRef.current = room;

    room.on(RoomEvent.Connected, () => {
      if (!active) return;
      setIsConnected(true);
      // Resolve any track already published before we connected
      if (targetRef.current) {
        setScreenTrack(findScreenTrack(room, targetRef.current));
      }
    });

    room.on(RoomEvent.Disconnected, () => {
      setIsConnected(false);
      setScreenTrack(null);
    });

    room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (
          targetRef.current &&
          participant.identity === `candidate-${targetRef.current}` &&
          track.source === Track.Source.ScreenShare
        ) {
          setScreenTrack(track);
        }
      }
    );

    room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
      setScreenTrack((prev) => (prev === track ? null : prev));
    });

    api
      .post("/live-interviews/livekit-token", { workspace_id: workspaceId })
      .then(({ data }) => {
        if (!active) return;
        const liveKitHost = import.meta.env.VITE_LIVEKIT_HOST as string;
        return room.connect(liveKitHost, data.data.token as string);
      })
      .catch(() => {
        /* connection failed — isConnected stays false */
      });

    return () => {
      active = false;
      room.disconnect();
      roomRef.current = null;
      setScreenTrack(null);
      setIsConnected(false);
    };
  }, [workspaceId]);

  // ── Switch displayed track when target changes (no reconnect) ─────────────
  useEffect(() => {
    const room = roomRef.current;
    if (!room || !isConnected) return;
    setScreenTrack(targetSubmissionId ? findScreenTrack(room, targetSubmissionId) : null);
  }, [targetSubmissionId, isConnected]);

  return { screenTrack, isConnected };
}
